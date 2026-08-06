/**
 * Typed client for the `UsersContract` (full user registry).
 *
 * Contract methods (see `contracts/users/src/lib.rs`):
 *   initialize(admin), register_user(user), get_user_count,
 *   get_all_users_count, is_user_registered, check_user_exists,
 *   get_all_users(caller), reset_user_data(user), set_default_currency(user,
 *     currency), get_default_currency(user), deactivate_user(user),
 *   is_user_active(user), update_user_profile(user, new_currency, is_active),
 *   get_admin(), get_user_active_status(user), set_user_currency(user,
 *     currency), get_user_currency(user), set_user_last_login(user,
 *     timestamp), get_user_last_login(user)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bool,
  decode,
  string,
  u64,
  voidScVal,
  type ScVal,
} from '../convert.js';

export class UsersClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async registerUser(user: string): Promise<boolean> {
    const result = await this.gateway.submit(
      this.contractId,
      'register_user',
      [address(user)],
      decodeBool,
    );
    return assertResult(result, 'register_user');
  }

  getUserCount(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_user_count', [], decodeU64);
  }

  getAllUsersCount(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_all_users_count', [], decodeU64);
  }

  isUserRegistered(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_user_registered',
      [address(user)],
      decodeBool,
    );
  }

  checkUserExists(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'check_user_exists',
      [address(user)],
      decodeBool,
    );
  }

  getAllUsers(caller: string): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_all_users',
      [address(caller)],
      decodeAddressVec,
    );
  }

  async resetUserData(user: string): Promise<boolean> {
    const result = await this.gateway.submit(
      this.contractId,
      'reset_user_data',
      [address(user)],
      decodeBool,
    );
    return assertResult(result, 'reset_user_data');
  }

  setDefaultCurrency(
    user: string,
    currency: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_default_currency', [
      address(user),
      string(currency),
    ]);
  }

  getDefaultCurrency(user: string): Promise<string | null> {
    return this.gateway.read(
      this.contractId,
      'get_default_currency',
      [address(user)],
      decodeStringOrNull,
    );
  }

  async deactivateUser(user: string): Promise<boolean> {
    const result = await this.gateway.submit(
      this.contractId,
      'deactivate_user',
      [address(user)],
      decodeBool,
    );
    return assertResult(result, 'deactivate_user');
  }

  isUserActive(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_user_active',
      [address(user)],
      decodeBool,
    );
  }

  getUserActiveStatus(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'get_user_active_status',
      [address(user)],
      decodeBool,
    );
  }

  async updateUserProfile(
    user: string,
    newCurrency: string | null,
    isActive: boolean | null,
  ): Promise<boolean> {
    const result = await this.gateway.submit(
      this.contractId,
      'update_user_profile',
      [
        address(user),
        newCurrency ? string(newCurrency) : voidScVal(),
        isActive !== null ? bool(isActive) : voidScVal(),
      ],
      decodeBool,
    );
    return assertResult(result, 'update_user_profile');
  }

  setUserCurrency(
    user: string,
    currency: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_user_currency', [
      address(user),
      string(currency),
    ]);
  }

  getUserCurrency(user: string): Promise<string> {
    return this.gateway.read(
      this.contractId,
      'get_user_currency',
      [address(user)],
      decodeString,
    );
  }

  setUserLastLogin(
    user: string,
    timestamp: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_user_last_login', [
      address(user),
      u64(timestamp),
    ]);
  }

  getUserLastLogin(user: string): Promise<bigint | null> {
    return this.gateway.read(
      this.contractId,
      'get_user_last_login',
      [address(user)],
      decodeU64OrNull,
    );
  }

  getAdmin(): Promise<string | null> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddressOrNull);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeString = (scVal: ScVal): string => String(decode(scVal));

const decodeStringOrNull = (scVal: ScVal): string | null => {
  if (isVoid(scVal)) return null;
  return String(decode(scVal));
};

const decodeU64OrNull = (scVal: ScVal): bigint | null => {
  if (isVoid(scVal)) return null;
  return decode(scVal) as bigint;
};

const decodeAddressOrNull = (scVal: ScVal): string | null => {
  if (isVoid(scVal)) return null;
  return String(decode(scVal));
};

const decodeAddressVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
