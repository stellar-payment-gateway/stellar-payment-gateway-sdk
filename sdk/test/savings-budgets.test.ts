import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';

import { SavingsGoalsClient } from '../src/contracts/savings-goals.js';
import { BudgetClient } from '../src/contracts/budget.js';
import { SharedBudgetsClient } from '../src/contracts/shared-budgets.js';
import { BudgetAllocationClient } from '../src/contracts/budget-allocation.js';
import { SpendingLimitsClient } from '../src/contracts/spending-limits.js';
import { SpendingPolicyClient } from '../src/contracts/spending-policy.js';
import { TreasuryClient } from '../src/contracts/treasury.js';

import {
  invokedArgs,
  invokedFunctionName,
  makeGateway,
  metaWithReturnValue,
  mockPrepareTransaction,
  scvAddress,
  scvBool,
  scvEnumWithFields,
  scvI128,
  scvStruct,
  scvSymbol,
  scvU32,
  scvU64,
  scvVec,
  scvVoid,
  successSimulation,
  testAccount,
  TEST_CONTRACT,
} from './helpers.js';

const USER = Keypair.random().publicKey();
const ADMIN = Keypair.random().publicKey();
const TOKEN = Keypair.random().publicKey();

function mockSimulate(gateway: ReturnType<typeof makeGateway>, retval: xdr.ScVal) {
  vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
  vi.spyOn(gateway.server, 'simulateTransaction').mockResolvedValue(successSimulation(retval));
}

function mockSubmit(gateway: ReturnType<typeof makeGateway>, retval: xdr.ScVal) {
  mockPrepareTransaction(gateway);
  vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
  vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
    status: 'PENDING',
    hash: 'h',
    latestLedger: 1,
    latestLedgerCloseTime: 1,
    oldestLedger: 1,
    id: '1',
  } as never);
  vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
    status: 'SUCCESS',
    resultMetaXdr: metaWithReturnValue(retval),
    latestLedger: 1,
    latestLedgerCloseTime: 1,
    oldestLedger: 1,
    ledger: 1,
    createdAt: 1,
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr: {} as never,
    resultXdr: {} as never,
    id: '1',
  } as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SavingsGoalsClient', () => {
  it('encodes SavingsGoalRequest structs and decodes a BatchGoalResult', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(
        scvStruct({
          batch_id: scvU64(1n),
          total_requests: scvU32(1),
          successful: scvU32(1),
          failed: scvU32(0),
          results: scvVec([
            scvEnumWithFields('Success', [
              scvStruct({
                goal_id: scvU64(5n),
                user: scvAddress(USER),
                goal_name: scvSymbol('vacation'),
                target_amount: scvI128(1_000_000n),
                current_amount: scvI128(0n),
                deadline: scvU64(1_700_000_000n),
                created_at: scvU64(1_600_000_000n),
              }),
            ]),
          ]),
          metrics: scvStruct({
            total_requests: scvU32(1),
            successful_goals: scvU32(1),
            failed_goals: scvU32(0),
            total_target_amount: scvI128(1_000_000n),
            total_initial_contributions: scvI128(0n),
            avg_goal_amount: scvI128(1_000_000n),
            processed_at: scvU64(1_600_000_000n),
          }),
        }),
      ),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new SavingsGoalsClient(gateway, TEST_CONTRACT);
    const result = await client.batchSetSavingsGoals(ADMIN, [
      {
        user: USER,
        goalName: 'vacation',
        targetAmount: 1_000_000n,
        deadline: 1_700_000_000n,
        initialContribution: 0n,
        priority: 1,
      },
    ]);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('batch_set_savings_goals');
    const args = invokedArgs(call);
    const decoded = scValToNative(args[1]!);
    const first = (decoded as Array<Record<string, unknown>>)[0]!;
    expect(first.goal_name).toBe('vacation');
    expect(first.target_amount).toBe(1_000_000n);

    expect(result.batchId).toBe(1n);
    expect(result.successful).toBe(1);
    expect(result.results[0]?.status).toBe('success');
    if (result.results[0]?.status === 'success') {
      expect(result.results[0].goal.goalName).toBe('vacation');
    }
  });

  it('decodes get_goal as a SavingsGoal or null', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        goal_id: scvU64(5n),
        user: scvAddress(USER),
        goal_name: scvSymbol('house'),
        target_amount: scvI128(500_000n),
        current_amount: scvI128(200_000n),
        deadline: scvU64(1_700_000_000n),
        created_at: scvU64(1_600_000_000n),
      }),
    );
    const client = new SavingsGoalsClient(gateway, TEST_CONTRACT);
    const goal = await client.getGoal(5n);
    expect(goal?.goalId).toBe(5n);
    expect(goal?.currentAmount).toBe(200_000n);

    mockSimulate(gateway, scvVoid());
    await expect(client.getGoal(99n)).resolves.toBeNull();
  });
});

describe('BudgetClient', () => {
  it('encodes update_budget with a nullable asset', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(scvVoid()),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new BudgetClient(gateway, TEST_CONTRACT);
    await client.updateBudget(ADMIN, USER, 1_000n, TOKEN);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    const args = invokedArgs(call);
    expect(args[3]?.switch().name).toBe('scvAddress');
  });

  it('decodes get_budget with an optional asset', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        user: scvAddress(USER),
        amount: scvI128(10_000n),
        asset: scvAddress(TOKEN),
        last_updated: scvU64(1_600_000_000n),
        expires_at: scvVoid(),
        is_active: scvBool(true),
        is_archived: scvBool(false),
      }),
    );
    const client = new BudgetClient(gateway, TEST_CONTRACT);
    const budget = await client.getBudget(USER);
    expect(budget?.amount).toBe(10_000n);
    expect(budget?.asset).toEqual(expect.any(String));
    expect(budget?.expiresAt).toBeNull();
  });
});

describe('SharedBudgetsClient', () => {
  it('encodes create_budget spending rules as a vec of maps', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(scvU64(3n)),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new SharedBudgetsClient(gateway, TEST_CONTRACT);
    const budgetId = await client.createBudget(USER, 'team', [USER, ADMIN], TOKEN, [
      {
        applicableTo: USER,
        percentageThreshold: 50,
        requiresApproval: true,
        description: 'cap',
      },
    ]);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('create_budget');
    const decoded = scValToNative(invokedArgs(call)[4]!);
    const rule = (decoded as Array<Record<string, unknown>>)[0]!;
    expect(rule.percentage_threshold).toBe(50);
    expect(rule.requires_approval).toBe(true);
    expect(budgetId).toBe(3n);
  });

  it('decodes get_budget_utilization_band as a unit enum string', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, scvSymbol('Low'));
    const client = new SharedBudgetsClient(gateway, TEST_CONTRACT);
    await expect(client.getBudgetUtilizationBand(1n)).resolves.toBe('Low');
  });
});

describe('BudgetAllocationClient', () => {
  it('decodes BatchBudgetResult from batch_allocate_budget', async () => {
    const gateway = makeGateway();
    mockSubmit(
      gateway,
      scvStruct({
        successful: scvU32(2),
        failed: scvU32(1),
        total_amount: scvI128(30_000n),
      }),
    );

    const client = new BudgetAllocationClient(gateway, TEST_CONTRACT);
    const result = await client.batchAllocateBudget(ADMIN, [
      { user: USER, amount: 10_000n },
      { user: ADMIN, amount: 20_000n },
      { user: TOKEN, amount: -1n },
    ]);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.totalAmount).toBe(30_000n);
  });
});

describe('SpendingLimitsClient', () => {
  it('decodes BatchLimitResult with mixed success/failure items', async () => {
    const gateway = makeGateway();
    mockSubmit(
      gateway,
      scvStruct({
        batch_id: scvU64(1n),
        total_requests: scvU32(2),
        successful: scvU32(1),
        failed: scvU32(1),
        results: scvVec([
          scvEnumWithFields('Success', [
            scvStruct({
              user: scvAddress(USER),
              monthly_limit: scvI128(1_000n),
              daily_limit: scvI128(100n),
              hourly_limit: scvI128(10n),
              reset_window_seconds: scvU64(86_400n),
              current_spending: scvI128(0n),
            }),
          ]),
          scvEnumWithFields('Failure', [scvAddress(ADMIN), scvU32(6)]),
        ]),
        metrics: scvStruct({
          total_requests: scvU32(2),
          successful_updates: scvU32(1),
          failed_updates: scvU32(1),
          total_limits_value: scvI128(1_000n),
          avg_limit_amount: scvI128(500n),
          processed_at: scvU64(1_600_000_000n),
        }),
      }),
    );

    const client = new SpendingLimitsClient(gateway, TEST_CONTRACT);
    const result = await client.batchUpdateSpendingLimits(ADMIN, [
      { user: USER, monthlyLimit: 1_000n, dailyLimit: 100n, hourlyLimit: 10n, resetWindowSeconds: 86_400n },
      { user: ADMIN, monthlyLimit: 500n, dailyLimit: 50n, hourlyLimit: 5n, resetWindowSeconds: 86_400n },
    ]);
    expect(result.batchId).toBe(1n);
    expect(result.results[0]?.status).toBe('success');
    if (result.results[0]?.status === 'success') {
      expect(result.results[0].limit.monthlyLimit).toBe(1_000n);
    }
    expect(result.results[1]?.status).toBe('failure');
  });
});

describe('SpendingPolicyClient', () => {
  it('decodes a Rejected evaluation with its reason', async () => {
    const gateway = makeGateway();
    mockSubmit(gateway, scvVec([scvSymbol('Rejected'), scvSymbol('OutsideTimeWindow')]));
    const client = new SpendingPolicyClient(gateway, TEST_CONTRACT);
    const evalResult = await client.evaluateTransaction(USER, ADMIN, 500n, null);
    expect(evalResult.status).toBe('rejected');
    if (evalResult.status === 'rejected') {
      expect(evalResult.reason).toBe('OutsideTimeWindow');
    }
  });

  it('decodes a PendingApproval evaluation with the pending id', async () => {
    const gateway = makeGateway();
    mockSubmit(gateway, scvVec([scvSymbol('PendingApproval'), scvU64(42n)]));
    const client = new SpendingPolicyClient(gateway, TEST_CONTRACT);
    const evalResult = await client.evaluateTransaction(USER, ADMIN, 1_000n, 'travel');
    expect(evalResult.status).toBe('pending_approval');
    if (evalResult.status === 'pending_approval') {
      expect(evalResult.pendingId).toBe(42n);
    }
  });
});

describe('TreasuryClient', () => {
  it('returns the proposal id from propose_disbursement', async () => {
    const gateway = makeGateway();
    mockSubmit(gateway, scvU64(7n));

    const client = new TreasuryClient(gateway, TEST_CONTRACT);
    const pid = await client.proposeDisbursement(USER, ADMIN, 5_000n, 'ops');
    expect(pid).toBe(7n);
  });

  it('decodes get_proposal', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        id: scvU64(7n),
        recipient: scvAddress(ADMIN),
        amount: scvI128(5_000n),
        reason: scvSymbol('ops'),
        proposer: scvAddress(USER),
        created_at: scvU64(1_600_000_000n),
        approval_count: scvU32(1),
      }),
    );
    const client = new TreasuryClient(gateway, TEST_CONTRACT);
    const proposal = await client.getProposal(7n);
    expect(proposal?.id).toBe(7n);
    expect(proposal?.reason).toBe('ops');
    expect(proposal?.approvalCount).toBe(1);
  });
});
