/**
 * Typed client for the `BalanceContract` (admin-managed balances).
 *
 * Contract methods (see `contracts/balance/src/lib.rs`):
 *   initialize(admin), set_user_balance(admin, user, amount),
 *   get_user_balance(user)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, i128, type ScVal } from '../convert.js';

export class BalanceClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  setUserBalance(
    admin: string,
    user: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_user_balance', [
      address(admin),
      address(user),
      i128(amount),
    ]);
  }

  getUserBalance(user: string): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_user_balance',
      [address(user)],
      decodeI128,
    );
  }
}

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
