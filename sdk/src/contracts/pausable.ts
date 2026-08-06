/**
 * Typed client for the `PausableContract` (circuit breaker).
 *
 * Contract methods (see `contracts/pausable/src/lib.rs`):
 *   initialize(admin), pause(caller), unpause(caller), is_paused(),
 *   get_admin(), set_admin(current_admin, new_admin)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, type ScVal } from '../convert.js';

export class PausableClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  pause(caller: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'pause', [address(caller)]);
  }

  unpause(caller: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'unpause', [address(caller)]);
  }

  isPaused(): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_paused', [], decodeBool);
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

const decodeAddress = (scVal: ScVal): string => String(decode(scVal));
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
