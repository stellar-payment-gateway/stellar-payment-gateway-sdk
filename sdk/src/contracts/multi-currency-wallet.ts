/**
 * Typed client for the `MultiCurrencyWallet` contract.
 *
 * Contract methods (see `contracts/multi-currency-wallet/src/lib.rs`):
 *   initialize(owner, oracle_address, staleness_threshold, max_deviation_bps),
 *   add_balance(asset, amount), convert_currency(ConversionRequest),
 *   get_balance(asset), is_oracle_fresh(asset_a, asset_b)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  string,
  struct,
  u64,
  type ScVal,
} from '../convert.js';
import type { WalletConversionRequest, WalletConversionResult } from '../types.js';

export class MultiCurrencyWalletClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Initialize the wallet with oracle configuration (owner-only). */
  initialize(
    owner: string,
    oracleAddress: string,
    stalenessThreshold: bigint,
    maxDeviationBps: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'initialize',
      [address(owner), address(oracleAddress), u64(stalenessThreshold), i128(maxDeviationBps)],
    );
  }

  /** Add funds to the wallet's balance for `asset` (owner-only). */
  addBalance(asset: string, amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_balance', [string(asset), i128(amount)]);
  }

  /** Convert between assets using the oracle TWAP (owner-only). */
  async convertCurrency(request: WalletConversionRequest): Promise<WalletConversionResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'convert_currency',
        [
          struct({
            from_asset: string(request.fromAsset),
            to_asset: string(request.toAsset),
            amount: i128(request.amount),
            min_received: i128(request.minReceived),
          }),
        ],
        decodeConversionResult,
      ),
      'convert_currency',
    );
  }

  /** The wallet's current balance for `asset`. */
  getBalance(asset: string): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_balance', [string(asset)], decodeI128);
  }

  /** Whether the oracle's TWAP for the pair is within the staleness window. */
  isOracleFresh(assetA: string, assetB: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_oracle_fresh',
      [string(assetA), string(assetB)],
      (scVal) => decode(scVal) as boolean,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeConversionResult = (scVal: ScVal): WalletConversionResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    fromAmount: BigInt(raw.from_amount as bigint),
    toAmount: BigInt(raw.to_amount as bigint),
    rate: BigInt(raw.rate as bigint),
    timestamp: BigInt(raw.timestamp as bigint),
  };
};
