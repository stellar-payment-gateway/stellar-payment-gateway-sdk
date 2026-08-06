/**
 * Typed client for the `UserContract` (minimal user registry).
 *
 * Contract methods (see `contracts/user/src/lib.rs`):
 *   register_user(user), user_exists(user)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, type ScVal } from '../convert.js';

export class UserClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  registerUser(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'register_user', [address(user)]);
  }

  userExists(user: string): Promise<boolean> {
    return this.gateway.read(this.contractId, 'user_exists', [address(user)], decodeBool);
  }
}

const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
