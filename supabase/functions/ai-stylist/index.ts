// Supabase Edge Function: ai-stylist
// Authenticates the caller, loads only that user's permitted context, calls a
// configurable OpenAI-compatible provider, validates the structured output and
// persists the exchange. The provider key never leaves this function.
//
// Secrets (supabase secrets set …): AI_API_KEY, AI_MODEL, [AI_API_URL], [ALLOWED_ORIGIN]
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY = 12;
const MAX_WARDROBE_ITEMS = 60;
const HOURLY_LIMIT = 40;
const REFINEMENTS: Record<string, string> = {
  more_formal: 'Make the outfit more formal than your previous suggestion.',
  more_casual: 'Make the outfit more casual than your previous suggestion.',
  cheaper: 'Offer a more budget-friendly version of your previous suggestion.',
  alternatives: 'Offer different alternatives to your previous suggestion.',
  try_another_style: 'Suggest the same occasion in a clearly different style category.',
  from_wardrobe: "Build the outfit using ONLY items listed in the user's wardrobe.",
};

type Piece = {
  name: string; category: string; color?: string; fromWardrobe: boolean; wardrobeItemId?: string;
};
type Outfit = {
  name: string; occasion?: string; style?: string; pieces: Piece[]; colorPalette: string[];
  shoes?: string; accessories: string[]; outerwear?: string; whyItWorks: string;
  weatherNote?: string; budgetNote?: string; alternatives: string[]; caveats?: string;
};
type StylistResult = { reply: string; clarifyingQuestion?: string; outfits: Outfit[] };

const str = (v: unknown, max = 400): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
const strArr = (v: unknown, maxItems = 8, max = 80): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => !!x).slice(0, maxItems) : [];

/** Validate + sanitise whatever the model returned. Throws on unusable output. */
function validate(raw: unknown, wardrobeIds: Set<string>): StylistResult {
  if (!raw || typeof raw !== 'object') throw new Error('not an object');
  const r = raw as Record<string, unknown>;
  const reply = str(r.reply, 3000);
  if (!reply) throw new Error('missing reply');
  const outfitsRaw = Array.isArray(r.outfits) ? r.outfits.slice(0, 3) : [];
  const outfits: Outfit[] = [];
  for (const o of outfitsRaw) {
    if (!o || typeof o !== 'object') continue;
    const x = o as Record<string, unknown>;
    const name = str(x.name, 120);
    const why = str(x.whyItWorks, 1200);
    const piecesRaw = Array.isArray(x.pieces) ? x.pieces.slice(0, 8) : [];
    const pieces: Piece[] = [];
    for (const p of piecesRaw) {
      if (!p || typeof p !== 'object') continue;
      const pp = p as Record<string, unknown>;
      const pname = str(pp.name, 100);
      if (!pname) continue;
      const id = str(pp.wardrobeItemId, 64);
      // Never trust a wardrobe id the model made up: it must be one we sent.
      const validId = id && wardrobeIds.has(id) ? id : undefined;
      pieces.push({
        name: pname,
        category: str(pp.category, 30) ?? 'other',
        color: str(pp.color, 40),
        fromWardrobe: !!validId,
        wardrobeItemId: validId,
      });
    }
    if (!name || !why || pieces.length === 0) continue;
    outfits.push({
      name,
      occasion: str(x.occasion, 80),
      style: str(x.style, 60),
      pieces,
      colorPalette: strArr(x.colorPalette, 6, 30),
      shoes: str(x.shoes, 100),
      accessories: strArr(x.accessories, 6, 80),
      outerwear: str(x.outerwear, 100),
      whyItWorks: why,
      weatherNote: str(x.weatherNote, 300),
      budgetNote: str(x.budgetNote, 300),
      alternatives: strArr(x.alternatives, 4, 200),
      caveats: str(x.caveats, 400),
    });
  }
  return { reply, clarifyingQuestion: str(r.clarifyingQuestion, 400), outfits };
}

/** Models sometimes wrap JSON in <think> blocks or ``` fences. Return just the outermost JSON object. */
function extractJson(raw: string): string {
  const t = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', ar: 'Arabic', es: 'Spanish', de: 'German', it: 'Italian',
};
const languageName = (code: string) => LANGUAGE_NAMES[code] ?? 'English';

function systemPrompt(language: string): string {
  return `You are Sage, a warm, practical, respectful personal fashion stylist.

Rules:
- Reply in ${languageName(language)} (language code: ${language}). Write every user-facing string in that language, including outfit titles, item names and notes. Keep JSON keys and enum values in English.
- Be specific and practical. Name actual garments, colours and fits. Avoid generic motivation.
- Explain WHY each outfit works (colour harmony, proportions, formality, occasion).
- Respect the user's stated style, colours, budget and comfort. Never body-shame, make medical claims, or assume gender, size or body shape.
- Never assume the user owns anything. Only mark a piece as from their wardrobe if it appears in the WARDROBE list, and then copy its id into wardrobeItemId.
- If key details are missing (occasion, formality, weather), you may ask ONE short clarifyingQuestion, but still offer a useful first suggestion when possible.
- You have NOT verified prices, product availability, live weather or trends. Only mention weather if WEATHER context is provided, and call it as given. Budget notes must be rough guidance, never exact prices. Do not invent shops, brands' stock or links. Put any important uncertainty in "caveats".
- Keep to fashion and styling topics.

Respond with ONE JSON object only, no markdown, matching exactly:
{
  "reply": string,                       // short, friendly chat message (max ~120 words)
  "clarifyingQuestion": string | null,
  "outfits": [                           // 0-3 items; empty for pure Q&A (e.g. colour advice)
    {
      "name": string, "occasion": string, "style": string,
      "pieces": [{"name": string, "category": "tops|trousers|jeans|jackets|coats|shoes|bags|accessories|dresses|other", "color": string, "wardrobeItemId": string | null}],
      "colorPalette": [string],           // 2-5 colour names
      "shoes": string, "accessories": [string], "outerwear": string | null,
      "whyItWorks": string, "weatherNote": string | null, "budgetNote": string | null,
      "alternatives": [string], "caveats": string | null
    }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // ── configuration ────────────────────────────────────────────────────
    const apiKey = Deno.env.get('AI_API_KEY');
    const model = Deno.env.get('AI_MODEL');
    const apiUrl = Deno.env.get('AI_API_URL') ?? 'https://api.openai.com/v1/chat/completions';
    if (!apiKey || !model) {
      return json({ error: 'provider_not_configured',
        message: 'The AI provider is not configured. Set AI_API_KEY and AI_MODEL as Supabase secrets.' }, 503);
    }

    // ── authentication (never trust a client-supplied user id) ───────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const uid = userData.user.id;

    // ── input validation ─────────────────────────────────────────────────
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: 'invalid_body' }, 400);
    const action = typeof body.action === 'string' ? body.action : undefined;
    const refinement = action ? REFINEMENTS[action] : undefined;
    if (action && !refinement) return json({ error: 'invalid_action' }, 400);

    let message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message && refinement) message = refinement;
    if (!message) return json({ error: 'empty_message' }, 400);
    if (message.length > MAX_MESSAGE_CHARS) return json({ error: 'message_too_long' }, 400);

    let conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
    if (conversationId && !/^[0-9a-f-]{36}$/i.test(conversationId)) return json({ error: 'invalid_conversation' }, 400);

    // optional, user-provided weather snapshot (validated; it is only context)
    let weatherLine = '';
    const w = body.weather as Record<string, unknown> | undefined;
    if (w && typeof w.tempC === 'number' && typeof w.summary === 'string') {
      weatherLine = `Current conditions (${str(w.city, 60) ?? 'user location'}): ${Math.round(w.tempC)}°C, ${str(w.summary, 60)}` +
        (typeof w.maxC === 'number' && typeof w.minC === 'number'
          ? `. Today's forecast range: ${Math.round(w.minC)}–${Math.round(w.maxC)}°C` : '') +
        (typeof w.rainChance === 'number' ? `, rain chance ${Math.round(w.rainChance)}%` : '') + '.';
    }

    // ── rate limit (per user, rolling hour) ──────────────────────────────
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('role', 'user').gte('created_at', since);
    if ((count ?? 0) >= HOURLY_LIMIT) {
      return json({ error: 'rate_limited', message: 'You have reached the hourly message limit. Try again soon.' }, 429);
    }

    // ── conversation ownership (RLS also enforces this) ──────────────────
    if (conversationId) {
      const { data: conv } = await supabase.from('conversations').select('id').eq('id', conversationId).maybeSingle();
      if (!conv) return json({ error: 'conversation_not_found' }, 404);
    } else {
      const title = message.slice(0, 60);
      const { data: created, error } = await supabase.from('conversations')
        .insert({ user_id: uid, title }).select('id').single();
      if (error || !created) return json({ error: 'conversation_create_failed' }, 500);
      conversationId = created.id;
    }

    // ── permitted context ────────────────────────────────────────────────
    const { data: profile } = await supabase.from('profiles').select(
      'display_name, preferred_language, style_preferences, preferred_colors, preferred_occasions, preferred_categories, budget_preference, ai_share_wardrobe',
    ).eq('id', uid).maybeSingle();

    let wardrobe: Array<Record<string, unknown>> = [];
    if (profile?.ai_share_wardrobe !== false) {
      const { data } = await supabase.from('wardrobe_items')
        .select('id, name, category, color, season, style_tags')
        .order('created_at', { ascending: false }).limit(MAX_WARDROBE_ITEMS);
      wardrobe = data ?? [];
    }
    const wardrobeIds = new Set(wardrobe.map((i) => String(i.id)));

    const { data: hist } = await supabase.from('messages').select('role, content')
      .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(MAX_HISTORY);
    const history = (hist ?? []).reverse();

    const language = profile?.preferred_language ?? 'en';
    // Only preference data is sent — no email, no exact location, no sizes.
    const context = [
      `USER PREFERENCES (nickname: ${profile?.display_name ?? 'unknown'})`,
      `Styles: ${(profile?.style_preferences ?? []).join(', ') || 'not set'}`,
      `Colours: ${(profile?.preferred_colors ?? []).join(', ') || 'not set'}`,
      `Occasions: ${(profile?.preferred_occasions ?? []).join(', ') || 'not set'}`,
      `Budget: ${profile?.budget_preference ?? 'not set'}`,
      weatherLine ? `WEATHER: ${weatherLine}` : 'WEATHER: not provided',
      wardrobe.length
        ? `WARDROBE (user-owned items; only these may use wardrobeItemId):\n` +
          wardrobe.map((i) => `- id=${i.id} | ${i.name} | ${i.category} | ${i.color ?? 'n/a'} | ${i.season}`).join('\n')
        : 'WARDROBE: empty or not shared',
    ].join('\n');

    const llmMessages = [
      { role: 'system', content: systemPrompt(language) + '\n\n' + context },
      ...history.map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: 'user', content: message },
    ];

    // ── provider call ────────────────────────────────────────────────────
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    let providerRes: Response;
    try {
      providerRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages: llmMessages, temperature: 0.7, max_tokens: 3000,
          response_format: { type: 'json_object' },
          // Optional, for reasoning models (e.g. gpt-oss): "low" | "medium" | "high".
          ...(Deno.env.get('AI_REASONING_EFFORT') ? { reasoning_effort: Deno.env.get('AI_REASONING_EFFORT') } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch (_e) {
      return json({ error: 'provider_unreachable', message: 'The AI provider did not respond in time.' }, 504);
    } finally {
      clearTimeout(timer);
    }

    if (providerRes.status === 429) return json({ error: 'provider_rate_limited', message: 'The AI provider is busy. Please retry shortly.' }, 429);
    if (!providerRes.ok) return json({ error: 'provider_error', message: 'The AI provider returned an error.' }, 502);

    const payload = await providerRes.json().catch(() => null);
    const text: unknown = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      console.error('ai-stylist: no text in provider answer, finish_reason =', payload?.choices?.[0]?.finish_reason, 'keys =', Object.keys(payload ?? {}));
      return json({ error: 'malformed_output', message: 'The AI returned an unreadable answer.' }, 502);
    }

    let result: StylistResult;
    try {
      result = validate(JSON.parse(extractJson(text)), wardrobeIds);
    } catch (e) {
      // Logs the start of the model's answer (never keys) so you can see what the model actually returned.
      console.error('ai-stylist: could not parse model answer:', e instanceof Error ? e.message : e, '| finish_reason =', payload?.choices?.[0]?.finish_reason, '| text =', text.slice(0, 400));
      return json({ error: 'malformed_output', message: 'The AI returned an unreadable answer. Please retry.' }, 502);
    }

    // ── persist exchange (RLS-checked) ───────────────────────────────────
    const structured = { outfits: result.outfits, clarifyingQuestion: result.clarifyingQuestion ?? null };
    const { error: insErr } = await supabase.from('messages').insert([
      { conversation_id: conversationId, user_id: uid, role: 'user', content: message },
      { conversation_id: conversationId, user_id: uid, role: 'assistant', content: result.reply, structured },
    ]);
    if (insErr) return json({ error: 'persist_failed' }, 500);
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    return json({ conversationId, reply: result.reply, ...structured });
  } catch (_e) {
    return json({ error: 'internal_error' }, 500);
  }
});