/**
 * Typed client for the `EscrowContract` (standalone escrow).
 *
 * Contract methods (see `contracts/escrow/src/lib.rs`):
 *   initialize(admin, token), create_escrow(depositor, recipient, arbiter,
 *     amount, deadline), release_escrow(caller, escrow_id),
 *   batch_release_escrows(caller, Vec<ReleaseRequest>),
 *   batch_reverse_escrows(caller, Vec<ReversalRequest>),
 *   get_escrow(escrow_id), get_user_escrows(user),
 *   get_admin, set_admin(current_admin, new_admin)
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
  voidScVal,
  type ScVal,
} from '../convert.js';

// ── Input types ──────────────────────────────────────────────────────────────

export interface EscrowReleaseRequest {
  escrowId: bigint;
}

export interface EscrowReversalRequest {
  escrowId: bigint;
}

// ── Result types ─────────────────────────────────────────────────────────────

export type ReleaseResultItem =
  | { status: 'success'; escrowId: bigint; recipient: string; amount: bigint }
  | { status: 'failure'; escrowId: bigint; errorCode: number };

export type ReversalResultItem =
  | { status: 'success'; escrowId: bigint; depositor: string; amount: bigint }
  | { status: 'failure'; escrowId: bigint; errorCode: number };

export interface BatchReleaseResult {
  batchId: bigint;
  totalRequests: number;
  successful: number;
  failed: number;
  totalReleased: bigint;
  results: ReleaseResultItem[];
}

export interface BatchReversalResult {
  batchId: bigint;
  totalRequests: number;
  successful: number;
  failed: number;
  totalReversed: bigint;
  results: ReversalResultItem[];
}

export interface EscrowRecord {
  escrowId: bigint;
  depositor: string;
  recipient: string;
  arbiter: string | null;
  token: string;
  amount: bigint;
  status: string;
  createdAt: bigint;
  deadline: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class EscrowClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string, token: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [
      address(admin),
      address(token),
    ]);
  }

  async createEscrow(
    depositor: string,
    recipient: string,
    arbiter: string | null,
    amount: bigint,
    deadline: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'create_escrow',
      [
        address(depositor),
        address(recipient),
        arbiter ? address(arbiter) : voidScVal(),
        i128(amount),
        u64(deadline),
      ],
      decodeU64,
    );
    return assertResult(result, 'create_escrow');
  }

  releaseEscrow(caller: string, escrowId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'release_escrow', [
      address(caller),
      u64(escrowId),
    ]);
  }

  async batchReleaseEscrows(
    caller: string,
    requests: EscrowReleaseRequest[],
  ): Promise<BatchReleaseResult> {
    const args = [
      address(caller),
      vec(requests.map((r) => struct({ escrow_id: u64(r.escrowId) }))),
    ];
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_release_escrows',
        args,
        decodeBatchReleaseResult,
      ),
      'batch_release_escrows',
    );
  }

  async batchReverseEscrows(
    caller: string,
    requests: EscrowReversalRequest[],
  ): Promise<BatchReversalResult> {
    const args = [
      address(caller),
      vec(requests.map((r) => struct({ escrow_id: u64(r.escrowId) }))),
    ];
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_reverse_escrows',
        args,
        decodeBatchReversalResult,
      ),
      'batch_reverse_escrows',
    );
  }

  getEscrow(escrowId: bigint): Promise<EscrowRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_escrow',
      [u64(escrowId)],
      decodeEscrowOrNull,
    );
  }

  getUserEscrows(user: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_escrows',
      [address(user)],
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
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeReleaseResultItem = (item: unknown): ReleaseResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [escrowId, extra, amount] = fields as unknown[];
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      escrowId: BigInt(escrowId as bigint),
      recipient: String(extra),
      amount: BigInt(amount as bigint),
    };
  }
  return {
    status: 'failure' as const,
    escrowId: BigInt(escrowId as bigint),
    errorCode: Number(extra),
  };
};

const decodeReversalResultItem = (item: unknown): ReversalResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [escrowId, extra, amount] = fields as unknown[];
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      escrowId: BigInt(escrowId as bigint),
      depositor: String(extra),
      amount: BigInt(amount as bigint),
    };
  }
  return {
    status: 'failure' as const,
    escrowId: BigInt(escrowId as bigint),
    errorCode: Number(extra),
  };
};

const decodeBatchReleaseResult = (scVal: ScVal): BatchReleaseResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  const items = (raw.results as unknown[]) ?? [];
  return {
    batchId: BigInt(raw.batch_id as bigint),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalReleased: BigInt(raw.total_released as bigint),
    results: items.map(decodeReleaseResultItem),
  };
};

const decodeBatchReversalResult = (scVal: ScVal): BatchReversalResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  const items = (raw.results as unknown[]) ?? [];
  return {
    batchId: BigInt(raw.batch_id as bigint),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalReversed: BigInt(raw.total_reversed as bigint),
    results: items.map(decodeReversalResultItem),
  };
};

const decodeEscrow = (raw: Record<string, unknown>): EscrowRecord => ({
  escrowId: BigInt(raw.escrow_id as bigint),
  depositor: String(raw.depositor),
  recipient: String(raw.recipient),
  arbiter: raw.arbiter ? String(raw.arbiter) : null,
  token: String(raw.token),
  amount: BigInt(raw.amount as bigint),
  status: String(raw.status),
  createdAt: BigInt(raw.created_at as bigint),
  deadline: BigInt(raw.deadline as bigint),
});

const decodeEscrowOrNull = (scVal: ScVal): EscrowRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeEscrow(decode(scVal) as Record<string, unknown>);
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
