/**
 * Typed client for the `AdminContract` (contract-wide admin ownership).
 *
 * Contract methods (see `contracts/admin/src/lib.rs`):
 *   initialize(admin), transfer_admin(current_admin, new_admin),
 *   get_admin(), is_initialized()
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, type ScVal } from '../convert.js';

export class AdminClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
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

  isInitialized(): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_initialized', [], decodeBool);
  }
}

const decodeAddress = (scVal: ScVal): string => String(decode(scVal));
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
