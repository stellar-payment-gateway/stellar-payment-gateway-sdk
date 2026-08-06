/**
 * Core gateway client for interacting with the Stellar Payment Gateway
 * contracts on a Soroban network (testnet, public, or a local dev node).
 *
 * Handles the full transaction lifecycle:
 *   read   → build + simulate, return the decoded return value (no state change)
 *   submit → build + prepare + sign + send + wait, return the decoded result
 */
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';

import type { ScVal } from './convert.js';
import { returnValueFromMeta } from './convert.js';

/** A signer that produces a signed transaction (for wallet integrations). */
export type TransactionSigner = (tx: Transaction) => Promise<Transaction> | Transaction;

export interface GatewayOptions {
  /** Soroban RPC endpoint, e.g. `https://soroban-testnet.stellar.org`. */
  rpcUrl: string;
  /** Network passphrase, e.g. `Test SDF Network ; September 2015`. */
  networkPassphrase: string;
  /** The address that signs and pays for transactions. */
  publicKey: string;
  /**
   * Keypair used to sign transactions, or a custom signer function.
   * If omitted, `submit` throws unless a signer is provided per-call.
   */
  signer?: Keypair | TransactionSigner;
  /** Transaction fee in stroops (defaults to `BASE_FEE`). */
  fee?: string;
  /** Transaction timeout in seconds (defaults to 30). */
  timeout?: number;
  /** How long to poll for a submitted transaction (ms, defaults to 30s). */
  waitTimeoutMs?: number;
  /** Poll interval while waiting for a submitted transaction (ms, defaults to 1s). */
  pollIntervalMs?: number;
}

export interface SubmitOptions {
  signer?: TransactionSigner;
}

export interface SubmitResult<T = unknown> {
  /** Transaction hash (hex). */
  hash: string;
  /** Final on-chain status. */
  status: 'SUCCESS' | 'FAILED';
  /** Decoded contract return value (undefined when the tx failed). */
  result?: T;
}

/** Error raised when a Soroban RPC call or submitted transaction fails. */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** Default Soroban RPC endpoint + passphrase for the public Stellar network. */
export const MAINNET = {
  rpcUrl: 'https://soroban-rpc.stellar.org',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
} as const;

/** Default Soroban RPC endpoint + passphrase for Stellar testnet. */
export const TESTNET = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
} as const;

/** Poll interval when waiting for a submitted transaction. */
const POLL_INTERVAL_MS = 1_000;

export class SorobanGateway {
  readonly server: Server;
  readonly networkPassphrase: string;
  readonly publicKey: string;

  private readonly signer?: Keypair | TransactionSigner;
  private readonly fee: string;
  private readonly timeout: number;
  private readonly waitTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: GatewayOptions) {
    this.server = new Server(options.rpcUrl);
    this.networkPassphrase = options.networkPassphrase;
    this.publicKey = options.publicKey;
    this.signer = options.signer;
    this.fee = options.fee ?? BASE_FEE;
    this.timeout = options.timeout ?? 30;
    this.waitTimeoutMs = options.waitTimeoutMs ?? 30_000;
    this.pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  }

  /**
   * Simulate a read-only contract call and return the decoded return value.
   * No transaction is submitted and no state changes.
   */
  async read<T>(
    contractId: string,
    method: string,
    args: ScVal[],
    decodeResult: (scVal: ScVal) => T = decodeVoid as unknown as (scVal: ScVal) => T,
  ): Promise<T> {
    const tx = await this.buildTransaction(contractId, method, args);
    const simulation = await this.server.simulateTransaction(tx);
    if ('error' in simulation) {
      throw new GatewayError(
        `Simulation failed for ${method}: ${simulation.error}`,
        this.extractContractErrorCode(simulation.error),
      );
    }
    const retval = simulation.result?.retval;
    if (!retval) {
      throw new GatewayError(`Simulation for ${method} returned no result`);
    }
    return decodeResult(retval);
  }

  /**
   * Submit a state-changing contract call and wait for the result.
   * Returns the decoded contract return value on success.
   */
  async submit<T>(
    contractId: string,
    method: string,
    args: ScVal[],
    decodeResult: (scVal: ScVal) => T = decodeVoid as unknown as (scVal: ScVal) => T,
    options: SubmitOptions = {},
  ): Promise<SubmitResult<T>> {
    const tx = await this.buildTransaction(contractId, method, args);
    const prepared = await this.server.prepareTransaction(tx);
    await this.sign(prepared, options.signer ?? this.signer);

    const sent = await this.server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new GatewayError(
        `Transaction rejected: ${sent.errorResult?.toXDR('base64') ?? 'unknown error'}`,
      );
    }

    const response = await this.waitForTransaction(sent.hash);
    if (response.status !== 'SUCCESS') {
      return { hash: sent.hash, status: response.status };
    }

    const result = decodeResult(returnValueFromMeta(response.resultMetaXdr));
    return { hash: sent.hash, status: response.status, result };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async buildTransaction(
    contractId: string,
    method: string,
    args: ScVal[],
  ): Promise<Transaction> {
    const account: Account = await this.server.getAccount(this.publicKey);
    const contract = new Contract(contractId);
    return new TransactionBuilder(account, {
      fee: this.fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(this.timeout)
      .build();
  }

  private async sign(tx: Transaction, signer?: Keypair | TransactionSigner): Promise<void> {
    if (typeof signer === 'function') {
      await signer(tx);
      return;
    }
    if (signer instanceof Keypair) {
      tx.sign(signer);
      return;
    }
    throw new GatewayError(
      'No signer configured: provide a Keypair or signer function in GatewayOptions (or per call)',
    );
  }

  private async waitForTransaction(hash: string): Promise<{
    status: 'SUCCESS' | 'FAILED';
    resultMetaXdr: xdr.TransactionMeta;
  }> {
    const deadline = Date.now() + this.waitTimeoutMs;
    for (;;) {
      const response = await this.server.getTransaction(hash);
      if (response.status === 'SUCCESS' || response.status === 'FAILED') {
        return { status: response.status, resultMetaXdr: response.resultMetaXdr };
      }
      if (Date.now() >= deadline) {
        throw new GatewayError(`Timed out waiting for transaction ${hash}`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  /** Best-effort extraction of a contract error code from a simulation error. */
  private extractContractErrorCode(error: string): number | undefined {
    // Soroban contract errors surface as `Error(Contract, #<code>)` or
    // `HostError: Error(Contract, #<code>)` in simulation messages.
    const match = /Error\(Contract,\s*#(\d+)\)/.exec(error);
    return match ? Number(match[1]) : undefined;
  }
}

function decodeVoid(): undefined {
  return undefined;
}

/**
 * Unwrap a `SubmitResult`, throwing a `GatewayError` that preserves the
 * transaction hash and final status when the call failed on-chain.
 */
export function assertResult<T>(result: SubmitResult<T>, method: string): T {
  if (result.status !== 'SUCCESS' || result.result === undefined) {
    throw new GatewayError(
      `Contract call ${method} did not succeed (status=${result.status}, hash=${result.hash})`,
    );
  }
  return result.result;
}
