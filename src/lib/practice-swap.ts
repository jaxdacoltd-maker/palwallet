import type { TokenId } from "@/lib/wallet-store";

/**
 * Practice-mode swap rates.
 *
 * These are demo/practice calculations only. They do not represent
 * a real market price and do not create or broadcast a blockchain
 * transaction.
 */

// 1 USDT.z = $0.00019
export const PRACTICE_USDTZ_PRICE = 0.00019;

// At 8,000 USDT the demo enters the higher-digit tier.
const HIGH_TIER_INPUT = 8000;
const HIGH_TIER_OUTPUT = 10010000000;

const PRACTICE_RATES: Record<string, number> = {
  "usdt_bep20>usdtz_bep20":
    HIGH_TIER_OUTPUT / HIGH_TIER_INPUT,

  "usdtz_bep20>usdt_bep20":
    PRACTICE_USDTZ_PRICE,
};

export function practiceRate(
  from: TokenId,
  to: TokenId,
): number | null {
  return PRACTICE_RATES[`${from}>${to}`] ?? null;
}

/**
 * Demo output amount for a practice swap.
 *
 * Below 8,000 USDT:
 *   USDT.z output = USDT input / 0.00019
 *
 * Therefore:
 *   1,000 -> 5,263,157.89 USDT.z
 *   2,000 -> 10,526,315.79 USDT.z
 *   3,000 -> 15,789,473.68 USDT.z
 *   4,000 -> 21,052,631.58 USDT.z
 *   5,000 -> 26,315,789.47 USDT.z
 *   6,000 -> 31,578,947.37 USDT.z
 *   7,000 -> 36,842,105.26 USDT.z
 *
 * At 8,000 USDT:
 *   10,010,000,000 USDT.z
 */
export function practiceSwapOut(
  from: TokenId,
  to: TokenId,
  amt: number,
): number {
  if (amt <= 0) return 0;

  const pair = `${from}>${to}`;

  if (pair === "usdt_bep20>usdtz_bep20") {
    // 1k through below 8k uses the $0.00019 demo price.
    if (amt < HIGH_TIER_INPUT) {
      return amt / PRACTICE_USDTZ_PRICE;
    }

    // 8k and above uses the existing high-tier demo rate.
    return amt * (HIGH_TIER_OUTPUT / HIGH_TIER_INPUT);
  }

  const rate = PRACTICE_RATES[pair];

  if (rate === undefined) return 0;

  return amt * rate;
}