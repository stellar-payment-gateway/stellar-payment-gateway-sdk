/**
 * Typed client for the `AccessControlContract` (RBAC).
 *
 * Contract methods (see `contracts/access-control/src/lib.rs`):
 *   initialize(admin), grant_role(caller, user, role), revoke_role(caller,
 *     user, role), has_role(user, role), check_permission(user, role),
 *   get_user_roles(user), has_any_role(user), transfer_admin(current_admin,
 *     new_admin), get_admin(), get_total_role_assignments()
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, symbol, type ScVal } from '../convert.js';

export type Role = 'Admin' | 'User' | 'Operator' | 'Auditor';

export class AccessControlClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  grantRole(
    caller: string,
    user: string,
    role: Role,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'grant_role', [
      address(caller),
      address(user),
      symbol(role),
    ]);
  }

  revokeRole(
    caller: string,
    user: string,
    role: Role,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'revoke_role', [
      address(caller),
      address(user),
      symbol(role),
    ]);
  }

  hasRole(user: string, role: Role): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'has_role',
      [address(user), symbol(role)],
      decodeBool,
    );
  }

  checkPermission(user: string, role: Role): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'check_permission', [
      address(user),
      symbol(role),
    ]);
  }

  getUserRoles(user: string): Promise<Role[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_roles',
      [address(user)],
      decodeRoleVec,
    );
  }

  hasAnyRole(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'has_any_role',
      [address(user)],
      decodeBool,
    );
  }

  transferAdmin(
    currentAdmin: string,
    newAdmin: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'transfer_admin', [
      address(currentAdmin),
      address(newAdmin),
    ]);
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  getTotalRoleAssignments(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_role_assignments',
      [],
      decodeU64,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeRoleVec = (scVal: ScVal): Role[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map((r) => String(r) as Role) : [];
};
