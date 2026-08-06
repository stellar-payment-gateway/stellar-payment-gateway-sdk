/**
 * Typed client for the `RewardsContract`.
 *
 * Contract methods (see `contracts/rewards/src/lib.rs`):
 *   initialize(admin), get_admin, is_initialized,
 *   register_account(participant), get_account(participant),
 *   credit_reward(participant, amount, reward_type),
 *   debit_reward(participant, amount, reward_type),
 *   get_transactions_for(participant)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  symbol,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type RewardType =
  | 'SpendingLimit'
  | 'SavingsGoal'
  | 'Streak'
  | 'Referral'
  | 'ManualGrant';

export type RewardStatus = 'Pending' | 'Confirmed' | 'Claimed' | 'Cancelled';

export interface RewardAccountRecord {
  owner: string;
  balance: bigint;
  lifetimeEarned: bigint;
  lifetimeClaimed: bigint;
  createdAt: bigint;
  lastUpdated: bigint;
}

export interface RewardTransactionRecord {
  id: bigint;
  recipient: string;
  amount: bigint;
  rewardType: RewardType;
  status: RewardStatus;
  createdAt: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class RewardsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  isInitialized(): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_initialized', [], decodeBool);
  }

  registerAccount(participant: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'register_account', [
      address(participant),
    ]);
  }

  getAccount(participant: string): Promise<RewardAccountRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_account',
      [address(participant)],
      decodeAccountOrNull,
    );
  }

  async creditReward(
    participant: string,
    amount: bigint,
    rewardType: RewardType,
  ): Promise<RewardTransactionRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'credit_reward',
        [address(participant), i128(amount), symbol(rewardType)],
        decodeTransaction,
      ),
      'credit_reward',
    );
  }

  async debitReward(
    participant: string,
    amount: bigint,
    rewardType: RewardType,
  ): Promise<RewardTransactionRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'debit_reward',
        [address(participant), i128(amount), symbol(rewardType)],
        decodeTransaction,
      ),
      'debit_reward',
    );
  }

  getTransactionsFor(participant: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_transactions_for',
      [address(participant)],
      decodeU64Vec,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeAccountOrNull = (scVal: ScVal): RewardAccountRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    owner: String(raw.owner),
    balance: BigInt(raw.balance as bigint),
    lifetimeEarned: BigInt(raw.lifetime_earned as bigint),
    lifetimeClaimed: BigInt(raw.lifetime_claimed as bigint),
    createdAt: BigInt(raw.created_at as bigint),
    lastUpdated: BigInt(raw.last_updated as bigint),
  };
};

const decodeTransaction = (scVal: ScVal): RewardTransactionRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: BigInt(raw.id as bigint),
    recipient: String(raw.recipient),
    amount: BigInt(raw.amount as bigint),
    rewardType: String(raw.reward_type ?? 'ManualGrant') as RewardType,
    status: String(raw.status ?? 'Pending') as RewardStatus,
    createdAt: BigInt(raw.created_at as bigint),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
