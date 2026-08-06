/**
 * Domain types mirroring the `#[contracttype]` structs of the Stellar
 * Payment Gateway contracts.
 *
 * Conventions:
 *  - All monetary amounts are `bigint` (contract `i128` / `u64`).
 *  - All addresses are plain `C...`/`G...` strkeys.
 *  - Optional address fields are `string | null`.
 */

// ── Batch conversion ─────────────────────────────────────────────────────────

/** Input for a single conversion inside a batch (`ConversionRequest`). */
export interface ConversionRequestInput {
  user: string;
  fromAsset: string;
  toAsset: string;
  amountIn: bigint;
  minAmountOut: bigint;
}

/** Per-item outcome of a batch conversion (`ConversionResult` enum). */
export type ConversionResultItem =
  | {
      status: 'success';
      user: string;
      fromAsset: string;
      toAsset: string;
      amountIn: bigint;
      amountOut: bigint;
    }
  | {
      status: 'failure';
      user: string;
      fromAsset: string;
      toAsset: string;
      amountIn: bigint;
      errorCode: number;
    };

/** Aggregate result of `batch_convert_currency` (`BatchConversionResult`). */
export interface BatchConversionResult {
  totalRequests: number;
  successful: number;
  failed: number;
  totalConverted: bigint;
  results: ConversionResultItem[];
}

/** A configured exchange rate for an asset pair (`ConversionRate`). */
export interface ConversionRate {
  fromAsset: string;
  toAsset: string;
  rateNumerator: bigint;
  rateDenominator: bigint;
}

// ── Fee engine ───────────────────────────────────────────────────────────────

/** On-chain fee configuration (`FeeConfig`). */
export interface FeeConfig {
  admin: string;
  token: string;
  treasury: string;
  feeBps: number;
  minFee: bigint;
  maxFee: bigint;
  isLocked: boolean;
  currentCycle: bigint;
}

/** Outcome of a batched fee collection (`BatchFeeResult`). */
export interface BatchFeeResult {
  batchSize: number;
  totalAmount: bigint;
  cycle: bigint;
  pendingFees: bigint;
}

/** Escrow reconciliation outcome (`ReconciliationResult`). */
export interface ReconciliationResult {
  storedBalance: bigint;
  calculatedBalance: bigint;
  discrepancy: bigint;
  isReconciled: boolean;
}

// ── Account status ───────────────────────────────────────────────────────────

/** Freeze/status record for an account (`AccountStatusRecord`). */
export interface AccountStatusRecord {
  frozen: boolean;
  frozenBy: string | null;
  reason: string;
  frozenAt: bigint;
  expiresAt: bigint;
  freezeCount: number;
}

// ── Multi-currency wallet ────────────────────────────────────────────────────

/** A currency conversion request (`ConversionRequest`). */
export interface WalletConversionRequest {
  fromAsset: string;
  toAsset: string;
  amount: bigint;
  minReceived: bigint;
}

/** Outcome of a wallet conversion (`ConversionResult`). */
export interface WalletConversionResult {
  fromAmount: bigint;
  toAmount: bigint;
  rate: bigint;
  timestamp: bigint;
}
