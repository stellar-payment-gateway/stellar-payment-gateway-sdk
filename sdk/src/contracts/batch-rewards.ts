/**
 * Typed client for the `BatchRewardsContract`.
 *
 * Contract methods (see `contracts/batch-rewards/src/lib.rs`):
 *   initialize(admin), distribute_rewards(caller, token, idempotency_token,
 *     Vec<RewardRequest>), get_admin, set_admin(caller, new_admin),
 *   get_total_batches, get_total_rewards_processed, get_total_volume_distributed
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bytes,
  decode,
  decodeEnumItem,
  i128,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RewardRequestInput {
  recipient: string;
  amount: bigint;
}

export type RewardResultItem =
  | { status: 'success'; recipient: string; amount: bigint }
  | { status: 'failure'; recipient: string; amount: bigint; errorCode: number };

export interface BatchRewardResult {
  totalRequests: number;
  successful: number;
  failed: number;
  totalDistributed: bigint;
  results: RewardResultItem[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchRewardsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async distributeRewards(
    caller: string,
    token: string,
    idempotencyToken: Buffer | Uint8Array,
    rewards: RewardRequestInput[],
  ): Promise<BatchRewardResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'distribute_rewards',
        [
          address(caller),
          address(token),
          bytes(idempotencyToken),
          vec(rewards.map((r) => struct({ recipient: address(r.recipient), amount: i128(r.amount) }))),
        ],
        decodeBatchRewardResult,
      ),
      'distribute_rewards',
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  setAdmin(caller: string, newAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_admin', [
      address(caller),
      address(newAdmin),
    ]);
  }

  getTotalBatches(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_batches', [], decodeU64);
  }

  getTotalRewardsProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_rewards_processed',
      [],
      decodeU64,
    );
  }

  getTotalVolumeDistributed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_volume_distributed',
      [],
      decodeI128,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeRewardResultItem = (item: unknown): RewardResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [recipient, amount, extra] = fields as unknown[];
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      recipient: String(recipient),
      amount: BigInt(amount as bigint),
    };
  }
  return {
    status: 'failure' as const,
    recipient: String(recipient),
    amount: BigInt(amount as bigint),
    errorCode: Number(extra),
  };
};

const decodeBatchRewardResult = (scVal: ScVal): BatchRewardResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalDistributed: BigInt(raw.total_distributed as bigint),
    results: ((raw.results as unknown[]) ?? []).map(decodeRewardResultItem),
  };
};
