// Unit test: an unknown / unpriced currency must be rejected with
// CURRENCY_NOT_PRICED instead of silently falling back to base_price.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function resolveMonthly(prices: Record<string, number>, currency: string, basePrice: number) {
  const monthly = prices[currency];
  if (monthly === undefined || monthly === null) {
    return { ok: false as const, code: "CURRENCY_NOT_PRICED" };
  }
  return { ok: true as const, monthly };
}

Deno.test("priced currency -> returns explicit amount", () => {
  const r = resolveMonthly({ XOF: 8990, NGN: 22500 }, "NGN", 13.99);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.monthly, 22500);
});

Deno.test("unpriced currency -> rejected, never falls back to base_price", () => {
  const r = resolveMonthly({ XOF: 8990 }, "BRL", 13.99);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "CURRENCY_NOT_PRICED");
});