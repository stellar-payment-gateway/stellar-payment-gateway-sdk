/**
 * Typed client for the `AccountStatusContract`.
 *
 * Contract methods (see `contracts/account_status.rs`):
 *   initialize(super_admin), add_admin, remove_admin, freeze_account(caller,
 *   target, reason, expires_at), unfreeze_account, assert_not_frozen,
 *   get_status, is_frozen, is_admin, total_freeze_count, get_admins
 */
import type { SorobanGateway } from '../client.js';
import {
  address,
  decode,
  string,
  u64,
  type ScVal,
} from '../convert.js';
import type { AccountStatusRecord } from '../types.js';

export class AccountStatusClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Initialize with a super-admin address (super-admin only). */
  initialize(superAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(superAdmin)]);
  }

  /** Add an admin (admin-only). */
  addAdmin(caller: string, newAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'add_admin',
      [address(caller), address(newAdmin)],
    );
  }

  /** Remove an admin (admin-only). */
  removeAdmin(caller: string, admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'remove_admin',
      [address(caller), address(admin)],
    );
  }

  /**
   * Freeze an account. `expiresAt` of 0 means the freeze is indefinite.
   * (admin-only)
   */
  freezeAccount(
    caller: string,
    target: string,
    reason: string,
    expiresAt: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'freeze_account',
      [address(caller), address(target), string(reason), u64(expiresAt)],
    );
  }

  /** Lift a freeze (admin-only). */
  unfreezeAccount(caller: string, target: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'unfreeze_account',
      [address(caller), address(target)],
    );
  }

  /** Panics on-chain if the account is frozen; safe to call before payments. */
  assertNotFrozen(account: string): Promise<void> {
    return this.gateway.read(this.contractId, 'assert_not_frozen', [address(account)], () => undefined);
  }

  /** Full freeze/status record for an account. */
  getStatus(account: string): Promise<AccountStatusRecord> {
    return this.gateway.read(this.contractId, 'get_status', [address(account)], decodeStatus);
  }

  /** Whether the account is currently frozen. */
  isFrozen(account: string): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_frozen', [address(account)], decodeBool);
  }

  /** Whether `addr` is an admin of the contract. */
  isAdmin(addr: string): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_admin', [address(addr)], decodeBool);
  }

  /** Total number of freezes ever applied (across all accounts). */
  totalFreezeCount(): Promise<number> {
    return this.gateway.read(this.contractId, 'total_freeze_count', [], decodeU32);
  }

  /** All admin addresses. */
  getAdmins(): Promise<string[]> {
    return this.gateway.read(this.contractId, 'get_admins', [], decodeAddressVec);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeBool = (scVal: ScVal): boolean => decode(scVal) as boolean;
const decodeU32 = (scVal: ScVal): number => decode(scVal) as number;

const decodeAddressVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as string[]) : [];
};

const decodeStatus = (scVal: ScVal): AccountStatusRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  // `None` (ScVal::Void) decodes to null; keep `string | null` in the type.
  const frozenBy = raw.frozen_by == null ? null : String(raw.frozen_by);
  return {
    frozen: Boolean(raw.frozen),
    frozenBy,
    reason: String(raw.reason),
    frozenAt: BigInt(raw.frozen_at as bigint),
    expiresAt: BigInt(raw.expires_at as bigint),
    freezeCount: Number(raw.freeze_count as number),
  };
};
