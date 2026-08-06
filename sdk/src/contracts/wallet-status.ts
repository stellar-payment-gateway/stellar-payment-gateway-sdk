/**
 * Typed client for the `WalletStatusContract`.
 *
 * Contract methods (see `contracts/wallet-status/src/lib.rs`):
 *   initialize(admin), get_wallet_status(wallet),
 *   set_wallet_status(caller, wallet, status)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, symbol, type ScVal } from '../convert.js';

export type WalletStatus = 'Active' | 'Paused' | 'Restricted';

export class WalletStatusClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  getWalletStatus(wallet: string): Promise<WalletStatus> {
    return this.gateway.read(
      this.contractId,
      'get_wallet_status',
      [address(wallet)],
      decodeStatus,
    );
  }

  setWalletStatus(
    caller: string,
    wallet: string,
    status: WalletStatus,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_wallet_status', [
      address(caller),
      address(wallet),
      symbol(status),
    ]);
  }
}

const decodeStatus = (scVal: ScVal): WalletStatus => String(decode(scVal)) as WalletStatus;
