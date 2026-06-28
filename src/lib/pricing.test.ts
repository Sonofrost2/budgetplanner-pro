import { describe, it, expect } from "vitest";
import {
  ANNUAL_DISCOUNT_RATE,
  ANNUAL_DISCOUNT_PERCENT,
  getDiscountedMonthly,
  getAnnualTotal,
} from "./pricing";

describe("pricing constants", () => {
  it("annual discount rate is 0.8 (20% off)", () => {
    expect(ANNUAL_DISCOUNT_RATE).toBe(0.8);
    expect(ANNUAL_DISCOUNT_PERCENT).toBe(20);
  });
});

describe("getDiscountedMonthly", () => {
  it("rounds to integer for CFA currencies (XOF)", () => {
    // 2990 * 0.8 = 2392
    expect(getDiscountedMonthly(2990, "XOF")).toBe(2392);
    expect(getDiscountedMonthly(8990, "XAF")).toBe(7192);
    expect(getDiscountedMonthly(10000, "GNF")).toBe(8000);
  });

  it("keeps 2 decimals for non-CFA currencies (EUR/USD)", () => {
    // 4.99 * 0.8 = 3.992 -> 3.99
    expect(getDiscountedMonthly(4.99, "EUR")).toBeCloseTo(3.99, 2);
    expect(getDiscountedMonthly(9.99, "USD")).toBeCloseTo(7.99, 2);
  });

  it("defaults to fractional rounding when currency is missing", () => {
    expect(getDiscountedMonthly(10, undefined)).toBe(8);
    expect(getDiscountedMonthly(10, null)).toBe(8);
  });
});

describe("getAnnualTotal", () => {
  it("returns 12 * monthly * discount", () => {
    // 2990 * 12 * 0.8 = 28704
    expect(getAnnualTotal(2990, "XOF")).toBe(28704);
    // 4.99 * 12 * 0.8 = 47.904 -> rounded 48
    expect(getAnnualTotal(4.99, "EUR")).toBe(48);
  });

  it("free plan (0) stays 0", () => {
    expect(getAnnualTotal(0, "XOF")).toBe(0);
  });

  it("annual total is strictly less than 12x monthly (20% saving)", () => {
    const monthly = 8990;
    const annual = getAnnualTotal(monthly, "XOF");
    expect(annual).toBeLessThan(monthly * 12);
    expect(annual / (monthly * 12)).toBeCloseTo(0.8, 5);
  });
});