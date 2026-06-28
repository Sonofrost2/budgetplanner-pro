// Unit test: annual flag must yield 365-day period, monthly => 30.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function resolveCycle(annual: boolean) {
  const periodDays = annual ? 365 : 30;
  const billingCycle = annual ? "annual" : "monthly";
  return { periodDays, billingCycle };
}

Deno.test("annual subscription -> 365 days", () => {
  const r = resolveCycle(true);
  assertEquals(r.periodDays, 365);
  assertEquals(r.billingCycle, "annual");
});

Deno.test("monthly subscription -> 30 days", () => {
  const r = resolveCycle(false);
  assertEquals(r.periodDays, 30);
  assertEquals(r.billingCycle, "monthly");
});