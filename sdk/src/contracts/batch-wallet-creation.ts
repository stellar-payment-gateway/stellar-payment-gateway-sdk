/**
 * Typed client for the `BatchWalletCreationContract`.
 *
 * Contract methods (see `contracts/batch-wallet-creation/src/lib.rs`):
 *   initialize(admin), batch_create_wallets(caller, Vec<WalletCreateRequest>),
 *   batch_recover_wallets(caller, Vec<WalletRecoveryRequest>),
 *   get_admin, set_admin, get_total_batches, get_total_wallets_created,
 *   get_wallet(address)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  decodeEnumItem,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletCreateRequestInput {
  owner: string;
}

export interface WalletRecoveryRequestInput {
  oldOwner: string;
  newOwner: string;
}

export interface WalletRecord {
  id: bigint;
  owner: string;
  createdAt: bigint;
}

export type WalletCreateResultItem =
  | { status: 'success'; wallet: string }
  | { status: 'failure'; owner: string; errorCode: number };

export type WalletRecoveryResultItem =
  | { status: 'success'; oldOwner: string; newOwner: string }
  | { status: 'failure'; oldOwner: string; newOwner: string; errorCode: number };

export interface BatchCreateResult {
  totalRequests: number;
  successful: number;
  failed: number;
  results: WalletCreateResultItem[];
}

export interface BatchRecoveryResult {
  totalRequests: number;
  successful: number;
  failed: number;
  results: WalletRecoveryResultItem[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchWalletCreationClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchCreateWallets(
    caller: string,
    requests: WalletCreateRequestInput[],
  ): Promise<BatchCreateResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_create_wallets',
        [
          address(caller),
          vec(requests.map((r) => struct({ owner: address(r.owner) }))),
        ],
        decodeBatchCreateResult,
      ),
      'batch_create_wallets',
    );
  }

  async batchRecoverWallets(
    caller: string,
    requests: WalletRecoveryRequestInput[],
  ): Promise<BatchRecoveryResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_recover_wallets',
        [
          address(caller),
          vec(
            requests.map((r) =>
              struct({ old_owner: address(r.oldOwner), new_owner: address(r.newOwner) }),
            ),
          ),
        ],
        decodeBatchRecoveryResult,
      ),
      'batch_recover_wallets',
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

  getTotalWalletsCreated(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_wallets_created',
      [],
      decodeU64,
    );
  }

  getWallet(addressStr: string): Promise<WalletRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_wallet',
      [address(addressStr)],
      decodeWalletOrNull,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeCreateItem = (item: unknown): WalletCreateResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [owner, errorCode] = fields as unknown[];
  if (variant === 'Success') {
    return { status: 'success' as const, wallet: String(owner) };
  }
  return { status: 'failure' as const, owner: String(owner), errorCode: Number(errorCode) };
};

const decodeRecoveryItem = (item: unknown): WalletRecoveryResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  const [oldOwner, newOwner, errorCode] = fields as unknown[];
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      oldOwner: String(oldOwner),
      newOwner: String(newOwner),
    };
  }
  return {
    status: 'failure' as const,
    oldOwner: String(oldOwner),
    newOwner: String(newOwner),
    errorCode: Number(errorCode),
  };
};

const decodeBatchCreateResult = (scVal: ScVal): BatchCreateResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeCreateItem),
  };
};

const decodeBatchRecoveryResult = (scVal: ScVal): BatchRecoveryResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeRecoveryItem),
  };
};

const decodeWalletOrNull = (scVal: ScVal): WalletRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: BigInt(raw.id as bigint),
    owner: String(raw.owner),
    createdAt: BigInt(raw.created_at as bigint),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
