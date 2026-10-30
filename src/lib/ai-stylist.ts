import { supabase } from './supabase';
import type { StylistRequest, StylistResponse } from '@/types';

/**
 * AI service layer. The browser only talks to our own Edge Function; the provider,
 * model and API key live server-side (see supabase/functions/ai-stylist). To switch
 * provider, change the function's secrets, not this file.
 */
export class StylistError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  provider_not_configured: 'The AI provider is not configured yet.',
  rate_limited: 'You have reached the hourly message limit. Try again in a little while.',
  provider_rate_limited: 'The AI provider is busy right now. Please retry in a moment.',
  provider_unreachable: 'The AI provider did not respond in time. Please retry.',
  provider_error: 'The AI provider returned an error. Please retry.',
  malformed_output: 'Sage could not put together a readable answer. Please retry.',
  message_too_long: 'That message is too long. Please shorten it.',
  unauthorized: 'Your session expired. Please sign in again.',
};

export async function sendToStylist(req: StylistRequest): Promise<StylistResponse> {
  if (!supabase) {
    throw new StylistError(
      'demo_mode',
      'The AI stylist needs a Supabase project with the ai-stylist function deployed. Demo mode does not call any AI.',
    );
  }
  const { data, error } = await supabase.functions.invoke('ai-stylist', { body: req });
  if (error) {
    let code = 'unreachable';
    let message = 'Could not reach the stylist. Check that the ai-stylist Edge Function is deployed.';
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      try {
        const j = await (ctx as Response).json();
        code = j.error ?? 'internal_error';
        message = j.message ?? FRIENDLY[code] ?? 'Something went wrong on our side. Please retry.';
      } catch {
        code = 'internal_error';
        message = 'Something went wrong on our side. Please retry.';
      }
    }
    throw new StylistError(code, FRIENDLY[code] ?? message);
  }
  const d = data as Partial<StylistResponse> | null;
  if (!d || typeof d.reply !== 'string' || typeof d.conversationId !== 'string') {
    throw new StylistError('malformed_output', FRIENDLY.malformed_output);
  }
  return {
    conversationId: d.conversationId,
    reply: d.reply,
    outfits: Array.isArray(d.outfits) ? d.outfits : [],
    clarifyingQuestion: d.clarifyingQuestion ?? null,
  };
}
