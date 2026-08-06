/**
 * Typed client for the `ActivityFeedContract`.
 *
 * Contract methods (see `contracts/activity-feed/src/lib.rs`):
 *   record_event(event_type), get_feed(page, page_size), total_events()
 */
import { assertResult, type SorobanGateway } from '../client.js';
import { decode, symbol, u64, type ScVal } from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActivityEventRecord {
  eventType: string;
  timestamp: bigint;
  sequence: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class ActivityFeedClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async recordEvent(eventType: string): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'record_event',
      [symbol(eventType)],
      decodeU64,
    );
    return assertResult(result, 'record_event');
  }

  getFeed(page: bigint, pageSize: bigint): Promise<ActivityEventRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_feed',
      [u64(page), u64(pageSize)],
      decodeEventVec,
    );
  }

  totalEvents(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'total_events', [], decodeU64);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeEventVec = (scVal: ScVal): ActivityEventRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((e) => ({
    eventType: String(e.event_type ?? ''),
    timestamp: BigInt(e.timestamp as bigint),
    sequence: BigInt(e.sequence as bigint),
  }));
};
