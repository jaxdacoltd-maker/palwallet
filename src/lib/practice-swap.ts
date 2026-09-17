import type { TokenId } from "@/lib/wallet-store";

/**
 * Practice-mode swap rates.
 *
 * These are NOT market prices. They only apply inside watch-only (preset)
 * wallets, where the swap screen is a labelled practice sandbox: nothing is
 * signed, broadcast, or recorded as a real transaction.
 */

// 1 USDT.z = $0.00019
export const PRACTICE_USDTZ_PRICE = 0.00019;

// 10-digit demo output for 8,000 USDT, kept as the fixed demo rate so the
// amount stays at 4,950,495,040 regardless of the demo price above.
const TEN_DIGIT_OUT = 4950495040;
const TEN_DIGIT_IN = 8000;

const PRACTICE_RATES: Record<string, number> = {
  // Fixed demo rate: 8,000 USDT (BEP20) -> 4,950,495,040 USDT.z
  "usdt_bep20>usdtz_bep20": TEN_DIGIT_OUT / TEN_DIGIT_IN,
  "usdtz_bep20>usdt_bep20": PRACTICE_USDTZ_PRICE,
};

// Pairs whose demo output follows a tiered curve: while the input is below the
// threshold the output stays in the 4-digit range, then at/above the threshold
// it jumps to the full rate.
const TIER_THRESHOLD: Record<string, number> = {
  "usdt_bep20>usdtz_bep20": 8000,
};

const TIER_MIN_OUT = 1000;
const TIER_MAX_OUT = 9999;

export function practiceRate(
  from: TokenId,
  to: TokenId,
): number | null {
  return PRACTICE_RATES[`${from}>${to}`] ?? null;
}

/**
 * Demo output amount for a practice swap. Returns 0 when the pair has no
 * practice rate.
 */
export function practiceSwapOut(
  from: TokenId,
  to: TokenId,
  amt: number,
): number {
  const rate = PRACTICE_RATES[`${from}>${to}`];

  if (rate === undefined || amt <= 0) return 0;

  const threshold = TIER_THRESHOLD[`${from}>${to}`];

  if (threshold === undefined || amt >= threshold) {
    return amt * rate;
  }

  // Below the threshold: keep the output inside the 4-digit range.
  const t = amt / threshold;

  return (
    TIER_MIN_OUT +
    t * (TIER_MAX_OUT - TIER_MIN_OUT)
  );
}