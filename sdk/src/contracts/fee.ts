/**
 * Typed client for the `FeeContract`.
 *
 * Contract methods (see `contracts/fee/src/lib.rs`):
 *   initialize(admin, token, treasury, fee_bps, initial_cycle), init(...),
 *   collect_fee, collect_fee_batch, update_activity, get_last_active,
 *   release_fees, rollover_fees, lock, unlock, set_fee_bps, set_treasury,
 *   set_min_fee, set_max_fee, reset_fee_config, set_user_tier, get_user_tier,
 *   remove_user_tier, calculate_fee_amount, validate_config,
 *   get_reconciliation_status, reconcile_fees, and the get_* accessors.
 */
import { assertResult, type SorobanGateway } from '../client.js';
import { address, decode, i128, symbol, u32, u64, vec, type ScVal } from '../convert.js';
import type { BatchFeeResult, FeeConfig, ReconciliationResult } from '../types.js';

export class FeeClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Initialize the fee contract (admin-only). */
  initialize(
    admin: string,
    token: string,
    treasury: string,
    feeBps: number,
    initialCycle: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'initialize',
      [address(admin), address(token), address(treasury), u32(feeBps), u64(initialCycle)],
    );
  }

  /** Initialize with the default config: 3.00% fee (300 BPS), cycle 1. */
  init(admin: string, token: string, treasury: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'init',
      [address(admin), address(token), address(treasury)],
    );
  }

  /** Collect a fee from `payer`; returns the amount actually collected. */
  async collectFee(payer: string, amount: bigint): Promise<bigint> {
    return assertResult(
      await this.gateway.submit(this.contractId, 'collect_fee', [address(payer), i128(amount)], decodeI128),
      'collect_fee',
    );
  }

  /** Collect fees for a batch of amounts; returns batch accounting. */
  async collectFeeBatch(payer: string, amounts: bigint[]): Promise<BatchFeeResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'collect_fee_batch',
        [address(payer), vec(amounts.map((a) => i128(a)))],
        decodeBatchFeeResult,
      ),
      'collect_fee_batch',
    );
  }

  /** Record user activity (used to determine fee tiers). */
  updateActivity(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_activity', [address(user)]);
  }

  /** Ledger timestamp of the user's last activity. */
  getLastActive(user: string): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_active', [address(user)], decodeU64);
  }

  /** Release accumulated fees to the treasury for `cycle` (admin-only). */
  async releaseFees(admin: string, cycle: bigint): Promise<bigint> {
    return assertResult(
      await this.gateway.submit(this.contractId, 'release_fees', [address(admin), u64(cycle)], decodeI128),
      'release_fees',
    );
  }

  /** Roll pending fees into the next cycle (admin-only). */
  async rolloverFees(admin: string, nextCycle: bigint): Promise<bigint> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'rollover_fees',
        [address(admin), u64(nextCycle)],
        decodeI128,
      ),
      'rollover_fees',
    );
  }

  /** Pause fee collection (admin-only). */
  lock(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'lock', [address(admin)]);
  }

  /** Resume fee collection (admin-only). */
  unlock(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'unlock', [address(admin)]);
  }

  /** Set the fee in basis points (admin-only). */
  setFeeBps(admin: string, feeBps: number): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_fee_bps', [address(admin), u32(feeBps)]);
  }

  /** Set the treasury address (admin-only). */
  setTreasury(admin: string, treasury: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'set_treasury',
      [address(admin), address(treasury)],
    );
  }

  /** Set the minimum fee (admin-only). */
  setMinFee(admin: string, minFee: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_min_fee', [address(admin), i128(minFee)]);
  }

  /** Set the maximum fee (admin-only). */
  setMaxFee(admin: string, maxFee: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_max_fee', [address(admin), i128(maxFee)]);
  }

  /** Reset the fee configuration to defaults (admin-only). */
  resetFeeConfig(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'reset_fee_config', [address(admin)]);
  }

  /** Assign a fee tier symbol to a user (admin-only). */
  setUserTier(admin: string, user: string, tier: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'set_user_tier',
      [address(admin), address(user), symbol(tier)],
    );
  }

  /** Read a user's fee tier, or null if none is set. */
  getUserTier(user: string): Promise<string | null> {
    return this.gateway.read(this.contractId, 'get_user_tier', [address(user)], (scVal) => {
      if (scVal.switch().name === 'scvVoid') {
        return null;
      }
      return String(decode(scVal));
    });
  }

  /** Remove a user's fee tier (admin-only). */
  removeUserTier(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'remove_user_tier',
      [address(admin), address(user)],
    );
  }

  /** Pure fee calculation: `amount * bps / 10_000`. */
  calculateFeeAmount(amount: bigint, bps: number): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'calculate_fee_amount',
      [i128(amount), u32(bps)],
      decodeI128,
    );
  }

  /** Pure config validation: `fee_bps` within bounds and `min_fee` >= 0. */
  validateConfig(feeBps: number, minFee: bigint): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'validate_config',
      [u32(feeBps), i128(minFee)],
      decodeBool,
    );
  }

  /** Compare the stored escrow balance against the calculated balance. */
  getReconciliationStatus(): Promise<ReconciliationResult> {
    return this.gateway.read(
      this.contractId,
      'get_reconciliation_status',
      [],
      decodeReconciliationResult,
    );
  }

  /** Run a reconciliation pass (admin-only). */
  async reconcileFees(admin: string): Promise<ReconciliationResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'reconcile_fees',
        [address(admin)],
        decodeReconciliationResult,
      ),
      'reconcile_fees',
    );
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  getToken(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_token', [], decodeAddress);
  }

  getTreasury(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_treasury', [], decodeAddress);
  }

  getFeeBps(): Promise<number> {
    return this.gateway.read(this.contractId, 'get_fee_bps', [], decodeU32);
  }

  getFeeConfig(): Promise<FeeConfig> {
    return this.gateway.read(this.contractId, 'get_fee_config', [], decodeFeeConfig);
  }

  getMinFee(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_min_fee', [], decodeI128);
  }

  getMaxFee(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_max_fee', [], decodeI128);
  }

  isLocked(): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_locked', [], decodeBool);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeU32 = (scVal: ScVal): number => decode(scVal) as number;
const decodeBool = (scVal: ScVal): boolean => decode(scVal) as boolean;
const decodeAddress = (scVal: ScVal): string => decode(scVal) as string;

const decodeFeeConfig = (scVal: ScVal): FeeConfig => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    admin: String(raw.admin),
    token: String(raw.token),
    treasury: String(raw.treasury),
    feeBps: Number(raw.fee_bps as number),
    minFee: BigInt(raw.min_fee as bigint),
    maxFee: BigInt(raw.max_fee as bigint),
    isLocked: Boolean(raw.is_locked),
    currentCycle: BigInt(raw.current_cycle as bigint),
  };
};

const decodeBatchFeeResult = (scVal: ScVal): BatchFeeResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    batchSize: Number(raw.batch_size as number),
    totalAmount: BigInt(raw.total_amount as bigint),
    cycle: BigInt(raw.cycle as bigint),
    pendingFees: BigInt(raw.pending_fees as bigint),
  };
};

const decodeReconciliationResult = (scVal: ScVal): ReconciliationResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    storedBalance: BigInt(raw.stored_balance as bigint),
    calculatedBalance: BigInt(raw.calculated_balance as bigint),
    discrepancy: BigInt(raw.discrepancy as bigint),
    isReconciled: Boolean(raw.is_reconciled),
  };
};
