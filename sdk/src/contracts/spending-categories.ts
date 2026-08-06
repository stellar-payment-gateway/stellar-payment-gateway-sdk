/**
 * Typed client for the `SpendingCategoriesContract`.
 *
 * Contract methods (see `contracts/spending-categories/src/lib.rs`):
 *   initialize(admin), create_category(caller, user, name),
 *   rename_category(caller, category_id, new_name), get_category(category_id),
 *   get_user_categories(user), category_exists(user, name), get_admin,
 *   set_admin(current_admin, new_admin), get_total_categories
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  symbol,
  u64,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpendingCategoryRecord {
  categoryId: bigint;
  user: string;
  name: string;
  createdAt: bigint;
  isActive: boolean;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SpendingCategoriesClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async createCategory(
    caller: string,
    user: string,
    name: string,
  ): Promise<SpendingCategoryRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'create_category',
        [address(caller), address(user), symbol(name)],
        decodeCategory,
      ),
      'create_category',
    );
  }

  async renameCategory(
    caller: string,
    categoryId: bigint,
    newName: string,
  ): Promise<SpendingCategoryRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'rename_category',
        [address(caller), u64(categoryId), symbol(newName)],
        decodeCategory,
      ),
      'rename_category',
    );
  }

  getCategory(categoryId: bigint): Promise<SpendingCategoryRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_category',
      [u64(categoryId)],
      decodeCategoryOrNull,
    );
  }

  getUserCategories(user: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_categories',
      [address(user)],
      decodeU64Vec,
    );
  }

  categoryExists(user: string, name: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'category_exists',
      [address(user), symbol(name)],
      decodeBool,
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

  getTotalCategories(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_categories', [], decodeU64);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeCategory = (scVal: ScVal): SpendingCategoryRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    categoryId: BigInt(raw.category_id as bigint),
    user: String(raw.user),
    name: String(raw.name ?? ''),
    createdAt: BigInt(raw.created_at as bigint ?? 0n),
    isActive: Boolean(raw.is_active ?? true),
  };
};

const decodeCategoryOrNull = (scVal: ScVal): SpendingCategoryRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeCategory(scVal);
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
