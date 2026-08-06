/**
 * Typed client for the `TransactionValidationContract` (timestamp checks).
 *
 * Contract methods (see `contracts/transaction-validation/src/lib.rs`):
 *   process_transaction(tx_timestamp)
 */
import { type SorobanGateway } from '../client.js';
import { decode, u64, type ScVal } from '../convert.js';

export class TransactionValidationClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async processTransaction(txTimestamp: bigint): Promise<void> {
    const result = await this.gateway.submit(
      this.contractId,
      'process_transaction',
      [u64(txTimestamp)],
      decodeResult,
    );
    // `process_transaction` returns `Result<(), TimestampValidationError>`: Ok
    // has no payload, so check the on-chain status directly.
    if (result.status !== 'SUCCESS') {
      throw new Error(`process_transaction did not succeed (status=${result.status})`);
    }
  }
}

/** Decode a `Result<(), TimestampValidationError>`; throws on the Err variant. */
const decodeResult = (scVal: ScVal): undefined => {
  const raw = decode(scVal);
  if (Array.isArray(raw) && raw[0] === 'Err') {
    throw new Error(`Transaction validation failed: ${String(raw[1])}`);
  }
  return undefined;
};
