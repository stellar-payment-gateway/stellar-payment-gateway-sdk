/**
 * Typed client for the `SavingsContract` (savings rewards).
 *
 * Contract methods (see `contracts/savings/src/lib.rs`):
 *   claim_reward(user, goal_id), set_reward_amount(amount)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import { address, decode, i128, u64, type ScVal } from '../convert.js';

export class SavingsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  /** Claim the reward accrued for a completed savings goal. Returns the claimed amount. */
  async claimReward(user: string, goalId: bigint): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'claim_reward',
      [address(user), u64(goalId)],
      decodeI128,
    );
    return assertResult(result, 'claim_reward');
  }

  /** Set the reward amount paid out per completed goal (admin). */
  setRewardAmount(amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_reward_amount', [i128(amount)]);
  }
}

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
