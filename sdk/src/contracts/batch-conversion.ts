/**
 * Typed client for the `BatchConversionContract`.
 *
 * Contract methods (see `contracts/batch-conversion/src/lib.rs`):
 *   initialize(admin), batch_convert_currency(Vec<ConversionRequest>),
 *   get_total_batches, get_total_conversions_processed,
 *   get_total_volume_converted, get_batch_conversion_output(batch_id),
 *   set_conversion_rate(from, to, num, den), get_conversion_rate(from, to),
 *   get_liquidity(asset), withdraw_liquidity(asset, amount)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  decodeEnumItem,
  i128,
  struct,
  u64,
  vec,
  type ScVal,
} from '../convert.js';
import type {
  BatchConversionResult,
  ConversionRate,
  ConversionRequestInput,
} from '../types.js';

export class BatchConversionClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Initialize the contract with an admin address (admin-only). */
  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  /**
   * Execute a batch of currency conversions. The caller must be authorized as
   * one of the `user` addresses in the batch (or an integrator contract).
   */
  async batchConvertCurrency(
    conversions: ConversionRequestInput[],
  ): Promise<BatchConversionResult> {
    const args = [
      vec(
        conversions.map((c) =>
          struct({
            user: address(c.user),
            from_asset: address(c.fromAsset),
            to_asset: address(c.toAsset),
            amount_in: i128(c.amountIn),
            min_amount_out: i128(c.minAmountOut),
          }),
        ),
      ),
    ];
    return assertResult(
      await this.gateway.submit(this.contractId, 'batch_convert_currency', args, decodeBatchConversionResult),
      'batch_convert_currency',
    );
  }

  /** Total number of batches processed so far. */
  getTotalBatches(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_batches', [], decodeU64);
  }

  /** Total number of individual conversions processed. */
  getTotalConversionsProcessed(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_conversions_processed', [], decodeU64);
  }

  /** Total volume converted across all batches. */
  getTotalVolumeConverted(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_volume_converted', [], decodeI128);
  }

  /** Per-request output amounts for a completed batch. */
  getBatchConversionOutput(batchId: number): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_batch_conversion_output',
      [u64(batchId)],
      decodeI128Vec,
    );
  }

  /** Configure the exchange rate for an asset pair (admin only). */
  setConversionRate(
    fromAsset: string,
    toAsset: string,
    rateNumerator: bigint,
    rateDenominator: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'set_conversion_rate',
      [address(fromAsset), address(toAsset), i128(rateNumerator), i128(rateDenominator)],
    );
  }

  /** Read the configured rate for an asset pair, or null if unset. */
  getConversionRate(fromAsset: string, toAsset: string): Promise<ConversionRate | null> {
    return this.gateway.read(
      this.contractId,
      'get_conversion_rate',
      [address(fromAsset), address(toAsset)],
      decodeConversionRate,
    );
  }

  /** The contract's current on-chain liquidity for `asset`. */
  getLiquidity(asset: string): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_liquidity', [address(asset)], decodeI128);
  }

  /** Withdraw conversion liquidity to the admin (admin only). */
  withdrawLiquidity(asset: string, amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'withdraw_liquidity', [address(asset), i128(amount)]);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeI128Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

/** Decode `Option<ConversionRate>` (None serializes as `ScVal::Void`). */
const decodeConversionRate = (scVal: ScVal): ConversionRate | null => {
  if (isVoid(scVal)) {
    return null;
  }
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    fromAsset: String(raw.from_asset),
    toAsset: String(raw.to_asset),
    rateNumerator: BigInt(raw.rate_numerator as bigint),
    rateDenominator: BigInt(raw.rate_denominator as bigint),
  };
};

/** Decode `BatchConversionResult` (struct + `Vec<ConversionResult>` enum). */
const decodeBatchConversionResult = (scVal: ScVal): BatchConversionResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  const items = (raw.results as unknown[]) ?? [];
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalConverted: BigInt(raw.total_converted as bigint),
    results: items.map((item) => {
      const { variant, fields } = decodeEnumItem(item);
      const [user, fromAsset, toAsset, amountIn, out] = fields as unknown[];
      const base = {
        user: String(user),
        fromAsset: String(fromAsset),
        toAsset: String(toAsset),
        amountIn: BigInt(amountIn as bigint),
      };
      if (variant === 'Success') {
        return { ...base, status: 'success' as const, amountOut: BigInt(out as bigint) };
      }
      return { ...base, status: 'failure' as const, errorCode: Number(out) };
    }),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
