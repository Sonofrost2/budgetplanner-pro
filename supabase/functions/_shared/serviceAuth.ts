import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of the incoming Authorization header against the
 * expected `Bearer <SUPABASE_SERVICE_ROLE_KEY>` value. Mirrors the pattern
 * used in paystack-webhook for HMAC signature comparison.
 *
 * Returns true only if the service key env var is set AND the header matches
 * exactly (length + bytes). Length inequality short-circuits before the
 * constant-time compare (timingSafeEqual throws on length mismatch).
 */
export function isServiceRoleAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return false;
  const header = req.headers.get('Authorization');
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${serviceKey}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}