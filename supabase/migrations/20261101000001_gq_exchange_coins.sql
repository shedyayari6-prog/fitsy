alter table public.store_credit_ledger
  drop constraint if exists store_credit_ledger_reason_check;

alter table public.store_credit_ledger
  add constraint store_credit_ledger_reason_check
  check (reason in ('purchase', 'coupon', 'quest_exchange'));

create or replace function public.gq_exchange_coins()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.gq_profiles;
  v_account public.store_credit_accounts;
  v_converted integer;
  v_spent integer;
  v_balance integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select * into v_profile
    from public.gq_profiles
   where user_id = v_uid
   for update;

  if not found then
    perform public.gq_ensure_profile('UTC');
    select * into v_profile
      from public.gq_profiles
     where user_id = v_uid
     for update;
  end if;

  insert into public.store_credit_accounts (user_id, balance, earned_total)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;

  select * into v_account
    from public.store_credit_accounts
   where user_id = v_uid
   for update;

  v_converted := v_profile.coins / 10;
  if v_converted < 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_enough',
      'coins', v_profile.coins,
      'balance', v_account.balance,
      'converted', 0
    );
  end if;

  v_spent := v_converted * 10;

  update public.gq_profiles
     set coins = coins - v_spent
   where user_id = v_uid;

  update public.store_credit_accounts
     set balance = balance + v_converted,
         earned_total = earned_total + v_converted
   where user_id = v_uid
   returning balance into v_balance;

  insert into public.store_credit_ledger (user_id, delta, reason)
  values (v_uid, v_converted, 'quest_exchange');

  return jsonb_build_object(
    'ok', true,
    'coins', v_profile.coins - v_spent,
    'balance', v_balance,
    'converted', v_converted
  );
end;
$$;

revoke all on function public.gq_exchange_coins() from public, anon;
grant execute on function public.gq_exchange_coins() to authenticated;

notify pgrst, 'reload schema';