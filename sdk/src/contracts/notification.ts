/**
 * Typed client for the `NotificationContract`.
 *
 * Contract methods (see `contracts/notification/src/lib.rs`):
 *   send_batch_notifications(Vec<Notification>), update_budget(used, limit),
 *   complete_goal(), emit_digest(user)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  string,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationInput {
  recipient: string;
  language: string;
  message: string;
}

export interface NotificationResultRecord {
  recipient: string;
  success: boolean;
  errorCode: number;
}

export interface DigestSummaryRecord {
  windowStart: bigint;
  windowEnd: bigint;
  eventCount: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class NotificationClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async sendBatchNotifications(
    notifications: NotificationInput[],
  ): Promise<NotificationResultRecord[]> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'send_batch_notifications',
        [
          vec(
            notifications.map((n) =>
              struct({
                recipient: address(n.recipient),
                language: string(n.language),
                message: string(n.message),
              }),
            ),
          ),
        ],
        decodeNotificationResultVec,
      ),
      'send_batch_notifications',
    );
  }

  updateBudget(used: bigint, limit: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_budget', [
      i128(used),
      i128(limit),
    ]);
  }

  completeGoal(): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'complete_goal', []);
  }

  emitDigest(user: string): Promise<DigestSummaryRecord | null> {
    return this.gateway.read(
      this.contractId,
      'emit_digest',
      [address(user)],
      decodeDigestOrNull,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeNotificationResultVec = (scVal: ScVal): NotificationResultRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    recipient: String(r.recipient),
    success: Boolean(r.success),
    errorCode: Number(r.error_code as number ?? 0),
  }));
};

const decodeDigestOrNull = (scVal: ScVal): DigestSummaryRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    windowStart: BigInt(raw.window_start as bigint),
    windowEnd: BigInt(raw.window_end as bigint),
    eventCount: Number(raw.event_count as number),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
