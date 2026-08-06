/**
 * Typed client for the `BatchTransferContract`.
 *
 * Contract methods (see `contracts/batch-transfer/src/lib.rs`):
 *   initialize(admin), batch_transfer(caller, token, Vec<TransferRequest>),
 *   batch_burn(caller, token, Vec<BurnRequest>),
 *   get_admin, set_admin(current_admin, new_admin),
 *   get_total_batches, get_total_transfers_processed,
 *   get_total_volume_transferred
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  decodeEnumItem,
  i128,
  struct,
  vec,
  type ScVal,
} from '../convert.js';

// ── Input types ──────────────────────────────────────────────────────────────

export interface TransferRequestInput {
  recipient: string;
  amount: bigint;
}

export interface BurnRequestInput {
  owner: string;
  amount: bigint;
}

// ── Result types ─────────────────────────────────────────────────────────────

export type TransferResultItem =
  | { status: 'success'; recipient: string; amount: bigint }
  | { status: 'failure'; recipient: string; amount: bigint; errorCode: number };

export type BurnResultItem =
  | { status: 'success'; owner: string; amount: bigint }
  | { status: 'failure'; owner: string; amount: bigint; errorCode: number };

export interface BatchTransferResult {
  totalRequests: number;
  successful: number;
  failed: number;
  totalTransferred: bigint;
  results: TransferResultItem[];
}

export interface BatchBurnResult {
  totalRequests: number;
  successful: number;
  failed: number;
  totalBurned: bigint;
  results: BurnResultItem[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchTransferClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchTransfer(
    caller: string,
    token: string,
    transfers: TransferRequestInput[],
  ): Promise<BatchTransferResult> {
    const args = [
      address(caller),
      address(token),
      vec(
        transfers.map((t) =>
          struct({ recipient: address(t.recipient), amount: i128(t.amount) }),
        ),
      ),
    ];
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_transfer',
        args,
        decodeBatchTransferResult,
      ),
      'batch_transfer',
    );
  }

  async batchBurn(
    caller: string,
    token: string,
    burns: BurnRequestInput[],
  ): Promise<BatchBurnResult> {
    const args = [
      address(caller),
      address(token),
      vec(
        burns.map((b) =>
          struct({ owner: address(b.owner), amount: i128(b.amount) }),
        ),
      ),
    ];
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_burn',
        args,
        decodeBatchBurnResult,
      ),
      'batch_burn',
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

  getTotalBatches(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_batches', [], decodeU64);
  }

  getTotalTransfersProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_transfers_processed',
      [],
      decodeU64,
    );
  }

  getTotalVolumeTransferred(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_volume_transferred',
      [],
      decodeI128,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeTransferResultItem = (item: unknown): TransferResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [recipient, amount, extra] = fields as unknown[];
  const base = {
    recipient: String(recipient),
    amount: BigInt(amount as bigint),
  };
  if (variant === 'Success') {
    return { ...base, status: 'success' as const };
  }
  return { ...base, status: 'failure' as const, errorCode: Number(extra) };
};

const decodeBurnResultItem = (item: unknown): BurnResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [owner, amount, extra] = fields as unknown[];
  const base = {
    owner: String(owner),
    amount: BigInt(amount as bigint),
  };
  if (variant === 'Success') {
    return { ...base, status: 'success' as const };
  }
  return { ...base, status: 'failure' as const, errorCode: Number(extra) };
};

const decodeBatchTransferResult = (scVal: ScVal): BatchTransferResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  const items = (raw.results as unknown[]) ?? [];
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalTransferred: BigInt(raw.total_transferred as bigint),
    results: items.map(decodeTransferResultItem),
  };
};

const decodeBatchBurnResult = (scVal: ScVal): BatchBurnResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  const items = (raw.results as unknown[]) ?? [];
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalBurned: BigInt(raw.total_burned as bigint),
    results: items.map(decodeBurnResultItem),
  };
};
