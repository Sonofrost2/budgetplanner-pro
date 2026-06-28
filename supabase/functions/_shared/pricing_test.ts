// Server-side pricing unit tests. Must stay in sync with src/lib/pricing.test.ts.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ANNUAL_DISCOUNT_RATE, getAnnualTotal } from "./pricing.ts";

Deno.test("ANNUAL_DISCOUNT_RATE = 0.8 (server)", () => {
  assertEquals(ANNUAL_DISCOUNT_RATE, 0.8);
});

Deno.test("getAnnualTotal: XOF Pro 2990 -> 28704", () => {
  assertEquals(getAnnualTotal(2990), 28704);
});

Deno.test("getAnnualTotal: XOF Premium 8990 -> 86304", () => {
  // 8990 * 12 * 0.8 = 86304
  assertEquals(getAnnualTotal(8990), 86304);
});

Deno.test("getAnnualTotal: free plan stays 0", () => {
  assertEquals(getAnnualTotal(0), 0);
});

Deno.test("client and server annual total match (XOF Pro)", () => {
  const monthly = 2990;
  // Mirror of src/lib/pricing.ts getAnnualTotal
  const clientValue = Math.round(monthly * 12 * 0.8);
  assertEquals(getAnnualTotal(monthly), clientValue);
});