/**
 * Typed client for the `BatchNotificationContract`.
 *
 * Contract methods (see `contracts/batch-notifications/src/lib.rs`):
 *   batch_notify(admin, Vec<NotificationPayload>)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  string,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPayloadInput {
  user: string;
  message: string;
}

export interface BatchNotificationResult {
  successfulCount: number;
  failedAddresses: string[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchNotificationsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async batchNotify(
    admin: string,
    payloads: NotificationPayloadInput[],
  ): Promise<BatchNotificationResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_notify',
        [
          address(admin),
          vec(payloads.map((p) => struct({ user: address(p.user), message: string(p.message) }))),
        ],
        decodeBatchResult,
      ),
      'batch_notify',
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeBatchResult = (scVal: ScVal): BatchNotificationResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    successfulCount: Number(raw.successful_count as number),
    failedAddresses: ((raw.failed_addresses as unknown[]) ?? []).map(String),
  };
};
