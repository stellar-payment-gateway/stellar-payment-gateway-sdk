/**
 * Typed client for the `ZkVerifierContract`.
 *
 * Contract methods (see `contracts/zk-verifier/src/lib.rs`):
 *   initialize(admin, verifier_pk), set_verifier_pk(admin, new_pk),
 *   get_verifier_pk(), verify_spending_proof(user, proof)
 *
 * Proofs are `[64-byte ed25519 signature][payload]`; verification fails
 * closed when no verifier key is configured.
 */
import type { SorobanGateway } from '../client.js';
import { address, bytes, bytesN, decode } from '../convert.js';

const VERIFIER_PK_LENGTH = 32;

export class ZkVerifierClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Initialize the verifier with the prover service's ed25519 public key. */
  initialize(admin: string, verifierPk: Buffer | Uint8Array): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'initialize',
      [address(admin), bytesN(verifierPk, VERIFIER_PK_LENGTH)],
    );
  }

  /** Rotate the prover service public key (admin-only). */
  setVerifierPk(admin: string, newPk: Buffer | Uint8Array): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(
      this.contractId,
      'set_verifier_pk',
      [address(admin), bytesN(newPk, VERIFIER_PK_LENGTH)],
    );
  }

  /** The configured prover public key, or null if unset. */
  getVerifierPk(): Promise<Buffer | null> {
    return this.gateway.read(this.contractId, 'get_verifier_pk', [], (scVal) => {
      if (scVal.switch().name === 'scvVoid') {
        return null;
      }
      const raw = decode(scVal);
      return Buffer.from(raw as Uint8Array);
    });
  }

  /** Verify a signed spending-limit proof for a user. */
  verifySpendingProof(user: string, proof: Buffer | Uint8Array): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'verify_spending_proof',
      [address(user), bytes(proof)],
      (scVal) => decode(scVal) as boolean,
    );
  }
}
