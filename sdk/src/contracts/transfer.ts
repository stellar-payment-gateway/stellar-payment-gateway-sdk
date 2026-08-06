/**
 * Typed client for the `TransferContract`.
 *
 * Contract methods (see `contracts/transfer/src/lib.rs`):
 *   execute_transfer(from, to, amount, description)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import { address, decode, i128, string, type ScVal } from '../convert.js';

export class TransferClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async executeTransfer(
    from: string,
    to: string,
    amount: bigint,
    description: string,
  ): Promise<string> {
    const result = await this.gateway.submit(
      this.contractId,
      'execute_transfer',
      [address(from), address(to), i128(amount), string(description)],
      decodeResultString,
    );
    return assertResult(result, 'execute_transfer');
  }
}

/** Decode a `Result<String, SharedError>`; returns the string or throws on Err. */
const decodeResultString = (scVal: ScVal): string => {
  const raw = decode(scVal);
  if (Array.isArray(raw)) {
    const [variant, value] = raw as [string, unknown];
    if (variant === 'Ok') return String(value);
    throw new Error(`Transfer rejected: ${String(value)}`);
  }
  return String(raw);
};
