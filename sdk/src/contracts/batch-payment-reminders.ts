/**
 * Typed client for the `BatchPaymentRemindersContract`.
 *
 * Contract methods (see `contracts/batch-payment-reminders/src/lib.rs`):
 *   dispatch_batch_reminders(admin, Vec<PaymentReminderRequest>)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  u64,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaymentReminderRequestInput {
  user: string;
  dueDate: bigint;
}

export interface BatchReminderResult {
  successfulCount: number;
  failedAddresses: string[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchPaymentRemindersClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async dispatchBatchReminders(
    admin: string,
    requests: PaymentReminderRequestInput[],
  ): Promise<BatchReminderResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'dispatch_batch_reminders',
        [
          address(admin),
          vec(requests.map((r) => struct({ user: address(r.user), due_date: u64(r.dueDate) }))),
        ],
        decodeBatchReminderResult,
      ),
      'dispatch_batch_reminders',
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeBatchReminderResult = (scVal: ScVal): BatchReminderResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    successfulCount: Number(raw.successful_count as number),
    failedAddresses: ((raw.failed_addresses as unknown[]) ?? []).map(String),
  };
};
