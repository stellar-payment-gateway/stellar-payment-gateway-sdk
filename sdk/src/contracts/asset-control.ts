/**
 * Typed client for the `AssetControlContract` (asset blacklist).
 *
 * Contract methods (see `contracts/asset_control/src/lib.rs`):
 *   initialize(admin), add_to_blacklist(asset), remove_from_blacklist(asset),
 *   is_blacklisted(asset), check_asset(asset)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, type ScVal } from '../convert.js';

export class AssetControlClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  addToBlacklist(asset: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_to_blacklist', [address(asset)]);
  }

  removeFromBlacklist(asset: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_from_blacklist', [
      address(asset),
    ]);
  }

  isBlacklisted(asset: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_blacklisted',
      [address(asset)],
      decodeBool,
    );
  }

  checkAsset(asset: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'check_asset', [address(asset)]);
  }
}

const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
