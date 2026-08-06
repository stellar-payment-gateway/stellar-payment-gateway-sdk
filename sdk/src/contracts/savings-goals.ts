/**
 * Typed client for the `SavingsGoalsContract`.
 *
 * Contract methods (see `contracts/savings-goals/src/lib.rs`):
 *   initialize(admin), batch_set_savings_goals(caller, Vec<SavingsGoalRequest>),
 *   batch_mark_milestones(caller, Vec<MilestoneAchievementRequest>),
 *   contribute_to_goal(caller, goal_id, amount, idempotency_token),
 *   reverse_contribution(caller, goal_id, contrib_id),
 *   clone_savings_goal(caller, goal_id, new_goal_name),
 *   withdraw_from_goal(caller, goal_id, amount),
 *   partial_withdraw(caller, goal_id, amount),
 *   update_goal_name(caller, goal_id, new_name),
 *   merge_goals(caller, source_goal_id, target_goal_id),
 *   set_goal_beneficiary(caller, goal_id, new_beneficiary),
 *   auto_allocate(caller, AutoAllocationRequest),
 *   set_default_alert_thresholds(caller, Vec<u64>),
 *   set_goal_alert_thresholds(caller, goal_id, Vec<u64>),
 *   set_penalty_contract(caller, penalty_contract),
 *   get_goal / get_goal_progress / get_user_goals / get_contribution_record /
 *   get_milestone / get_goal_milestones / get_goal_certificate /
 *   get_goal_beneficiary / get_goal_closed_at / get_goal_alert_thresholds /
 *   get_goal_alerts_emitted / get_admin / set_admin, get_last_batch_id,
 *   get_last_goal_id, get_total_goals_created, get_total_batches_processed,
 *   get_last_milestone_id, get_total_milestones_achieved
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bytes,
  decode,
  decodeEnumItem,
  i128,
  symbol,
  u32,
  u64,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Input types ──────────────────────────────────────────────────────────────

export interface SavingsGoalRequestInput {
  user: string;
  goalName: string;
  targetAmount: bigint;
  deadline: bigint;
  initialContribution?: bigint;
  priority?: number;
  lockDurationSeconds?: bigint;
}

export interface MilestoneAchievementRequestInput {
  goalId: bigint;
  user: string;
  milestonePercentage: number;
  achievedAt: bigint;
}

export interface AllocationGoalInput {
  goalId: bigint;
  percentage: number;
}

export interface AutoAllocationRequestInput {
  user: string;
  totalAmount: bigint;
  allocations: AllocationGoalInput[];
  idempotencyToken: Buffer | Uint8Array;
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface SavingsGoalRecord {
  goalId: bigint;
  user: string;
  goalName: string;
  targetAmount: bigint;
  currentAmount: bigint;
  deadline: bigint;
  createdAt: bigint;
  isActive: boolean;
  isComplete: boolean;
}

export interface SavingsGoalProgressRecord {
  goalId: bigint;
  currentAmount: bigint;
  targetAmount: bigint;
  progressPercentage: number;
  isComplete: boolean;
}

export interface ContributionRecord {
  amount: bigint;
  contributedAt: bigint;
  idempotencyToken: Buffer;
  reversed: boolean;
}

export interface GoalCertificateRecord {
  goalId: bigint;
  user: string;
  targetAmount: bigint;
  issuedAt: bigint;
}

export interface MilestoneAchievementRecord {
  milestoneId: bigint;
  goalId: bigint;
  user: string;
  milestonePercentage: number;
  goalAmountAtAchievement: bigint;
  achievedAt: bigint;
}

export interface BatchGoalMetricsRecord {
  totalRequests: number;
  successfulGoals: number;
  failedGoals: number;
  totalTargetAmount: bigint;
  totalInitialContributions: bigint;
  avgGoalAmount: bigint;
  processedAt: bigint;
}

export interface BatchMilestoneMetricsRecord {
  totalRequests: number;
  successfulMilestones: number;
  failedMilestones: number;
  totalPercentagePoints: number;
  avgPercentage: number;
  processedAt: bigint;
}

export type GoalResultItem =
  | { status: 'success'; goal: SavingsGoalRecord }
  | { status: 'failure'; user: string; errorCode: number };

export type MilestoneResultItem =
  | { status: 'success'; milestone: MilestoneAchievementRecord }
  | { status: 'failure'; goalId: bigint; errorCode: number };

export interface BatchGoalResult {
  batchId: bigint;
  totalRequests: number;
  successful: number;
  failed: number;
  results: GoalResultItem[];
  metrics: BatchGoalMetricsRecord;
}

export interface BatchMilestoneResult {
  batchId: bigint;
  totalRequests: number;
  successful: number;
  failed: number;
  results: MilestoneResultItem[];
  metrics: BatchMilestoneMetricsRecord;
}

export interface AutoAllocationResult {
  success: boolean;
  goalsAllocated: number;
  goalsFailed: number;
  totalDistributed: bigint;
  contributionIds: bigint[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SavingsGoalsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchSetSavingsGoals(
    caller: string,
    requests: SavingsGoalRequestInput[],
  ): Promise<BatchGoalResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_set_savings_goals',
        [address(caller), vec(requests.map(encodeGoalRequest))],
        decodeBatchGoalResult,
      ),
      'batch_set_savings_goals',
    );
  }

  async batchMarkMilestones(
    caller: string,
    requests: MilestoneAchievementRequestInput[],
  ): Promise<BatchMilestoneResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_mark_milestones',
        [address(caller), vec(requests.map(encodeMilestoneRequest))],
        decodeBatchMilestoneResult,
      ),
      'batch_mark_milestones',
    );
  }

  async contributeToGoal(
    caller: string,
    goalId: bigint,
    amount: bigint,
    idempotencyToken: Buffer | Uint8Array,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'contribute_to_goal',
      [address(caller), u64(goalId), i128(amount), bytes(idempotencyToken)],
      decodeU64,
    );
    return assertResult(result, 'contribute_to_goal');
  }

  async reverseContribution(
    caller: string,
    goalId: bigint,
    contribId: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'reverse_contribution',
      [address(caller), u64(goalId), u64(contribId)],
      decodeI128,
    );
    return assertResult(result, 'reverse_contribution');
  }

  async cloneSavingsGoal(
    caller: string,
    goalId: bigint,
    newGoalName: string,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'clone_savings_goal',
      [address(caller), u64(goalId), symbol(newGoalName)],
      decodeU64,
    );
    return assertResult(result, 'clone_savings_goal');
  }

  async withdrawFromGoal(
    caller: string,
    goalId: bigint,
    amount: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'withdraw_from_goal',
      [address(caller), u64(goalId), i128(amount)],
      decodeI128,
    );
    return assertResult(result, 'withdraw_from_goal');
  }

  partialWithdraw(
    caller: string,
    goalId: bigint,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'partial_withdraw', [
      address(caller),
      u64(goalId),
      i128(amount),
    ]);
  }

  updateGoalName(
    caller: string,
    goalId: bigint,
    newName: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_goal_name', [
      address(caller),
      u64(goalId),
      symbol(newName),
    ]);
  }

  mergeGoals(
    caller: string,
    sourceGoalId: bigint,
    targetGoalId: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'merge_goals', [
      address(caller),
      u64(sourceGoalId),
      u64(targetGoalId),
    ]);
  }

  setGoalBeneficiary(
    caller: string,
    goalId: bigint,
    newBeneficiary: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_goal_beneficiary', [
      address(caller),
      u64(goalId),
      address(newBeneficiary),
    ]);
  }

  async autoAllocate(
    caller: string,
    request: AutoAllocationRequestInput,
  ): Promise<AutoAllocationResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'auto_allocate',
        [address(caller), encodeAutoAllocationRequest(request)],
        decodeAutoAllocationResult,
      ),
      'auto_allocate',
    );
  }

  setDefaultAlertThresholds(
    caller: string,
    thresholds: bigint[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_default_alert_thresholds', [
      address(caller),
      vec(thresholds.map(u64)),
    ]);
  }

  setGoalAlertThresholds(
    caller: string,
    goalId: bigint,
    thresholds: bigint[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_goal_alert_thresholds', [
      address(caller),
      u64(goalId),
      vec(thresholds.map(u64)),
    ]);
  }

  setPenaltyContract(
    caller: string,
    penaltyContract: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_penalty_contract', [
      address(caller),
      address(penaltyContract),
    ]);
  }

  getGoal(goalId: bigint): Promise<SavingsGoalRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_goal',
      [u64(goalId)],
      decodeGoalOrNull,
    );
  }

  getGoalProgress(goalId: bigint): Promise<SavingsGoalProgressRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_goal_progress',
      [u64(goalId)],
      decodeGoalProgressOrNull,
    );
  }

  getUserGoals(user: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_goals',
      [address(user)],
      decodeU64Vec,
    );
  }

  getContributionRecord(
    goalId: bigint,
    contributionId: bigint,
  ): Promise<ContributionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_contribution_record',
      [u64(goalId), u64(contributionId)],
      decodeContributionOrNull,
    );
  }

  getMilestone(milestoneId: bigint): Promise<MilestoneAchievementRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_milestone',
      [u64(milestoneId)],
      decodeMilestoneOrNull,
    );
  }

  getGoalMilestones(goalId: bigint): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_goal_milestones',
      [u64(goalId)],
      decodeU64Vec,
    );
  }

  getGoalCertificate(goalId: bigint): Promise<GoalCertificateRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_goal_certificate',
      [u64(goalId)],
      decodeCertificateOrNull,
    );
  }

  getGoalBeneficiary(goalId: bigint): Promise<string | null> {
    return this.gateway.read(
      this.contractId,
      'get_goal_beneficiary',
      [u64(goalId)],
      decodeAddressOrNull,
    );
  }

  getGoalClosedAt(goalId: bigint): Promise<bigint | null> {
    return this.gateway.read(
      this.contractId,
      'get_goal_closed_at',
      [u64(goalId)],
      decodeU64OrNull,
    );
  }

  getGoalAlertThresholds(goalId: bigint): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_goal_alert_thresholds',
      [u64(goalId)],
      decodeU64Vec,
    );
  }

  getGoalAlertsEmitted(goalId: bigint): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_goal_alerts_emitted',
      [u64(goalId)],
      decodeU64Vec,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  setAdmin(currentAdmin: string, newAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_admin', [
      address(currentAdmin),
      address(newAdmin),
    ]);
  }

  getLastBatchId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_batch_id', [], decodeU64);
  }

  getLastGoalId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_goal_id', [], decodeU64);
  }

  getTotalGoalsCreated(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_goals_created', [], decodeU64);
  }

  getTotalBatchesProcessed(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_batches_processed', [], decodeU64);
  }

  getLastMilestoneId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_milestone_id', [], decodeU64);
  }

  getTotalMilestonesAchieved(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_milestones_achieved',
      [],
      decodeU64,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeGoalRequest = (r: SavingsGoalRequestInput): ScVal =>
  struct({
    user: address(r.user),
    goal_name: symbol(r.goalName),
    target_amount: i128(r.targetAmount),
    deadline: u64(r.deadline),
    initial_contribution: i128(r.initialContribution ?? 0n),
    priority: u32(r.priority ?? 0),
    lock_duration_seconds: u64(r.lockDurationSeconds ?? 0n),
  });

const encodeMilestoneRequest = (r: MilestoneAchievementRequestInput): ScVal =>
  struct({
    goal_id: u64(r.goalId),
    user: address(r.user),
    milestone_percentage: u32(r.milestonePercentage),
    achieved_at: u64(r.achievedAt),
  });

const encodeAutoAllocationRequest = (r: AutoAllocationRequestInput): ScVal =>
  struct({
    user: address(r.user),
    total_amount: i128(r.totalAmount),
    allocations: vec(
      r.allocations.map((a) =>
        struct({ goal_id: u64(a.goalId), percentage: u32(a.percentage) }),
      ),
    ),
    idempotency_token: bytes(r.idempotencyToken),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeU64OrNull = (scVal: ScVal): bigint | null => {
  if (isVoid(scVal)) return null;
  return decode(scVal) as bigint;
};

const decodeAddressOrNull = (scVal: ScVal): string | null => {
  if (isVoid(scVal)) return null;
  return String(decode(scVal));
};

const decodeGoal = (raw: Record<string, unknown>): SavingsGoalRecord => ({
  goalId: BigInt(raw.goal_id as bigint),
  user: String(raw.user),
  goalName: String(raw.goal_name ?? ''),
  targetAmount: BigInt(raw.target_amount as bigint),
  currentAmount: BigInt(raw.current_amount as bigint),
  deadline: BigInt(raw.deadline as bigint),
  createdAt: BigInt(raw.created_at as bigint),
  isActive: Boolean(raw.is_active ?? true),
  isComplete: Boolean(raw.is_complete ?? false),
});

const decodeGoalOrNull = (scVal: ScVal): SavingsGoalRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeGoal(decode(scVal) as Record<string, unknown>);
};

const decodeGoalProgressOrNull = (scVal: ScVal): SavingsGoalProgressRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    goalId: BigInt(raw.goal_id as bigint),
    currentAmount: BigInt(raw.current_amount as bigint),
    targetAmount: BigInt(raw.target_amount as bigint),
    progressPercentage: Number(raw.progress_percentage as number),
    isComplete: Boolean(raw.is_complete),
  };
};

const decodeContributionOrNull = (scVal: ScVal): ContributionRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    amount: BigInt(raw.amount as bigint),
    contributedAt: BigInt(raw.contributed_at as bigint),
    idempotencyToken: Buffer.from(raw.idempotency_token as Uint8Array),
    reversed: Boolean(raw.reversed),
  };
};

const decodeCertificateOrNull = (scVal: ScVal): GoalCertificateRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    goalId: BigInt(raw.goal_id as bigint),
    user: String(raw.user),
    targetAmount: BigInt(raw.target_amount as bigint),
    issuedAt: BigInt(raw.issued_at as bigint),
  };
};

const decodeMilestone = (raw: Record<string, unknown>): MilestoneAchievementRecord => ({
  milestoneId: BigInt(raw.milestone_id as bigint),
  goalId: BigInt(raw.goal_id as bigint),
  user: String(raw.user),
  milestonePercentage: Number(raw.milestone_percentage as number),
  goalAmountAtAchievement: BigInt(raw.goal_amount_at_achievement as bigint),
  achievedAt: BigInt(raw.achieved_at as bigint),
});

const decodeMilestoneOrNull = (scVal: ScVal): MilestoneAchievementRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeMilestone(decode(scVal) as Record<string, unknown>);
};

const decodeGoalMetrics = (raw: Record<string, unknown>): BatchGoalMetricsRecord => ({
  totalRequests: Number(raw.total_requests as number),
  successfulGoals: Number(raw.successful_goals as number),
  failedGoals: Number(raw.failed_goals as number),
  totalTargetAmount: BigInt(raw.total_target_amount as bigint),
  totalInitialContributions: BigInt(raw.total_initial_contributions as bigint),
  avgGoalAmount: BigInt(raw.avg_goal_amount as bigint),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeMilestoneMetrics = (
  raw: Record<string, unknown>,
): BatchMilestoneMetricsRecord => ({
  totalRequests: Number(raw.total_requests as number),
  successfulMilestones: Number(raw.successful_milestones as number),
  failedMilestones: Number(raw.failed_milestones as number),
  totalPercentagePoints: Number(raw.total_percentage_points as number),
  avgPercentage: Number(raw.avg_percentage as number),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeGoalResultItem = (item: unknown): GoalResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  if (variant === 'Success') {
    return { status: 'success' as const, goal: decodeGoal(fields[0] as Record<string, unknown>) };
  }
  const [user, errorCode] = fields as unknown[];
  return { status: 'failure' as const, user: String(user), errorCode: Number(errorCode) };
};

const decodeMilestoneResultItem = (item: unknown): MilestoneResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      milestone: decodeMilestone(fields[0] as Record<string, unknown>),
    };
  }
  const [goalId, errorCode] = fields as unknown[];
  return { status: 'failure' as const, goalId: BigInt(goalId as bigint), errorCode: Number(errorCode) };
};

const decodeBatchGoalResult = (scVal: ScVal): BatchGoalResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    batchId: BigInt(raw.batch_id as bigint),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeGoalResultItem),
    metrics: decodeGoalMetrics((raw.metrics as Record<string, unknown>) ?? {}),
  };
};

const decodeBatchMilestoneResult = (scVal: ScVal): BatchMilestoneResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    batchId: BigInt(raw.batch_id as bigint),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeMilestoneResultItem),
    metrics: decodeMilestoneMetrics((raw.metrics as Record<string, unknown>) ?? {}),
  };
};

const decodeAutoAllocationResult = (scVal: ScVal): AutoAllocationResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    success: Boolean(raw.success),
    goalsAllocated: Number(raw.goals_allocated as number),
    goalsFailed: Number(raw.goals_failed as number),
    totalDistributed: BigInt(raw.total_distributed as bigint),
    contributionIds: ((raw.contribution_ids as unknown[]) ?? []).map(
      (id) => BigInt(id as bigint),
    ),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
