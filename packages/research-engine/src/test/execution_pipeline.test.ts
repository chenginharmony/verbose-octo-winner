import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DisabledExecutionAdapter,
  SimulationExecutionAdapter,
  StagingExecutionAdapter,
  ExecutionAdapterFactory,
  TransactionBuilder,
  CanonicalSandwichOpportunity,
} from '@base-mev/adapters';
import {
  CapitalManager,
  ProfitabilityGate,
  ExecutionKillSwitch,
  ExecutionAuditLogger,
} from '../index.js';

test('ExecutionAdapter Hierarchy & Safety Boundaries', async () => {
  const disabledAdapter = new DisabledExecutionAdapter();
  assert.equal(disabledAdapter.getMode(), 'disabled');
  assert.equal(disabledAdapter.isLive(), false);

  const mockOpp: CanonicalSandwichOpportunity = {
    id: 'opp-test-1',
    chainId: 8453,
    timestamp: Date.now(),
    blockNumber: 18000000,
    targetTransaction: {
      hash: '0xtest-tx',
      sender: '0x1111111111111111111111111111111111111111',
      router: '0x2222222222222222222222222222222222222222',
      pool: '0xb4885Bc63399bF55161A639b07ae3A9e0ecB50e4',
      tokenIn: 'WETH',
      tokenOut: 'USDC',
      amountIn: 1000000000000000000n,
    },
    targetPool: {
      chainId: 8453,
      name: 'Aerodrome V2 WETH/USDC',
      address: '0xb4885Bc63399bF55161A639b07ae3A9e0ecB50e4',
      factoryAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      protocol: 'aerodrome_v2',
      token0: { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
      token1: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
      feeNumerator: 30n,
      feeDenominator: 10000n,
    },
    targetToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    victimAmountUsd: 3000,
    recommendedFrontRunSizeUsd: 2.50,
    frontRunAmountIn: 833333333333333n,
    frontRunAmountOut: 2490000n,
    victimOutputEstimated: 2975000000n,
    backRunAmountIn: 2490000n,
    backRunAmountOut: 875000000000000n,
    grossProfitUsd: 0.125,
    estimatedGasCostUsd: 0.020,
    estimatedL1DataFeeUsd: 0.005,
    estimatedOrderingCostUsd: 0.010,
    estimatedFailureCostUsd: 0.005,
    estimatedNetProfitUsd: 0.085,
    executionProbability: 0.90,
    survivalProbability: 0.95,
    expectedValueUsd: 0.072675,
    capitalEfficiency: 0.029,
    detectionLatencyMs: 2.5,
    decisionLatencyMs: 1.2,
    riskScore: 15,
    priceImpact: 0.0008,
    status: 'QUALIFIED',
  };

  const resDisabled = await disabledAdapter.execute(mockOpp);
  assert.equal(resDisabled.success, false);
  assert.equal(resDisabled.status, 'LIVE_EXECUTION_DISABLED');

  // Staging Adapter
  const stagingAdapter = new StagingExecutionAdapter();
  assert.equal(stagingAdapter.getMode(), 'staging');
  const txBuilder = new TransactionBuilder();
  const txPayload = txBuilder.buildTransaction(mockOpp);
  const resStaging = await stagingAdapter.execute(mockOpp, txPayload);
  assert.equal(resStaging.success, true);
  assert.equal(resStaging.status, 'STAGED');
  assert.ok(resStaging.transactionHash?.startsWith('0xstaging-'));
});

test('TransactionBuilder Parameter & Destination Validation', () => {
  const txBuilder = new TransactionBuilder();
  const mockOpp: CanonicalSandwichOpportunity = {
    id: 'opp-test-2',
    chainId: 8453,
    timestamp: Date.now(),
    blockNumber: 18000001,
    targetTransaction: {
      hash: '0xtest-tx-2',
      sender: '0x1111111111111111111111111111111111111111',
      router: '0x2222222222222222222222222222222222222222',
      pool: '0xb4885Bc63399bF55161A639b07ae3A9e0ecB50e4',
      tokenIn: 'WETH',
      tokenOut: 'USDC',
      amountIn: 1000000000000000000n,
    },
    targetPool: {
      chainId: 8453,
      name: 'Aerodrome V2 WETH/USDC',
      address: '0xb4885Bc63399bF55161A639b07ae3A9e0ecB50e4',
      factoryAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      protocol: 'aerodrome_v2',
      token0: { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
      token1: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
      feeNumerator: 30n,
      feeDenominator: 10000n,
    },
    targetToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    victimAmountUsd: 3000,
    recommendedFrontRunSizeUsd: 2.50,
    frontRunAmountIn: 833333333333333n,
    frontRunAmountOut: 2490000n,
    victimOutputEstimated: 2975000000n,
    backRunAmountIn: 2490000n,
    backRunAmountOut: 875000000000000n,
    grossProfitUsd: 0.125,
    estimatedGasCostUsd: 0.020,
    estimatedL1DataFeeUsd: 0.005,
    estimatedOrderingCostUsd: 0.010,
    estimatedFailureCostUsd: 0.005,
    estimatedNetProfitUsd: 0.085,
    executionProbability: 0.90,
    survivalProbability: 0.95,
    expectedValueUsd: 0.072675,
    capitalEfficiency: 0.029,
    detectionLatencyMs: 2.5,
    decisionLatencyMs: 1.2,
    riskScore: 15,
    priceImpact: 0.0008,
    status: 'QUALIFIED',
  };

  const payload = txBuilder.buildTransaction(mockOpp);
  assert.equal(payload.chainId, 8453);
  assert.equal(payload.to, mockOpp.targetPool.address);
  assert.ok(payload.data.startsWith('0x38ed1739'));

  const validation = txBuilder.validateTransaction(payload, mockOpp);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  // Test invalid chain rejection
  const invalidChainPayload = { ...payload, chainId: 999999 };
  const invalidValidation = txBuilder.validateTransaction(invalidChainPayload);
  assert.equal(invalidValidation.valid, false);
  assert.ok(invalidValidation.errors[0].includes('Invalid chain ID'));
});

test('ProfitabilityGate Hurdle & EV Filtering', () => {
  const gate = new ProfitabilityGate({
    minNetProfitUsd: 0.05,
    minExpectedValueUsd: 0.02,
    maxAllowedLatencyMs: 100,
  });

  const qualifiedOpp: CanonicalSandwichOpportunity = {
    id: 'opp-gate-1',
    chainId: 8453,
    timestamp: Date.now(),
    blockNumber: 18000002,
    targetTransaction: {
      hash: '0xhash1',
      sender: '0x111',
      router: '0x222',
      pool: '0x333',
      tokenIn: 'WETH',
      tokenOut: 'USDC',
      amountIn: 1000n,
    },
    targetPool: {} as any,
    targetToken: { address: '0x', symbol: 'USDC', decimals: 6 },
    victimAmountUsd: 5000,
    recommendedFrontRunSizeUsd: 5.0,
    frontRunAmountIn: 1000n,
    frontRunAmountOut: 1000n,
    victimOutputEstimated: 1000n,
    backRunAmountIn: 1000n,
    backRunAmountOut: 1000n,
    grossProfitUsd: 0.20,
    estimatedGasCostUsd: 0.02,
    estimatedL1DataFeeUsd: 0.01,
    estimatedOrderingCostUsd: 0.01,
    estimatedFailureCostUsd: 0.005,
    estimatedNetProfitUsd: 0.155,
    executionProbability: 0.90,
    survivalProbability: 0.90,
    expectedValueUsd: 0.125,
    capitalEfficiency: 0.025,
    detectionLatencyMs: 10,
    decisionLatencyMs: 5,
    riskScore: 10,
    priceImpact: 0.001,
    status: 'SIMULATED',
  };

  const qualRes = gate.evaluate(qualifiedOpp);
  assert.equal(qualRes.passed, true);

  // Test high latency rejection
  const staleOpp = { ...qualifiedOpp, detectionLatencyMs: 150 };
  const staleRes = gate.evaluate(staleOpp);
  assert.equal(staleRes.passed, false);
  assert.equal(staleRes.rejectionReason, 'LATENCY_EXCEEDED');
});

test('CapitalManager Concurrency, Locking, and Settlement', () => {
  const capManager = new CapitalManager({
    initialCapitalUsd: 10.0,
    maxConcurrentPositions: 1,
    maxPositionSizeUsd: 500.0,
  });

  const state1 = capManager.getState();
  assert.equal(state1.balanceUsd, 10.0);
  assert.equal(state1.availableCapitalUsd, 10.0);

  // 1. Reserve $2.50
  const res1 = capManager.reserveCapital('opp-cap-1', 2.50, 2000);
  assert.equal(res1.success, true);
  assert.ok(res1.lockId);

  const state2 = capManager.getState();
  assert.equal(state2.availableCapitalUsd, 7.50);
  assert.equal(state2.reservedCapitalUsd, 2.50);
  assert.equal(state2.activePositionsCount, 1);

  // 2. Second concurrent reservation must fail (max 1 position)
  const res2 = capManager.reserveCapital('opp-cap-2', 2.00, 2000);
  assert.equal(res2.success, false);
  assert.ok(res2.reason?.includes('Max concurrent positions'));

  // 3. Commit and settle winning trade (+$0.15 gross, $0.03 fee -> +$0.12 net)
  capManager.commitCapital(res1.lockId!);
  const settleRes = capManager.settleTrade(res1.lockId!, 0.15, 0.03, false);
  assert.equal(settleRes.status, 'WON');
  assert.equal(settleRes.netProfitUsd, 0.12);

  const state3 = capManager.getState();
  assert.equal(state3.balanceUsd, 10.12);
  assert.equal(state3.availableCapitalUsd, 10.12);
  assert.equal(state3.reservedCapitalUsd, 0);
  assert.equal(state3.activePositionsCount, 0);
});

test('ExecutionKillSwitch Emergency Stop & Automated Tripping', () => {
  const killSwitch = new ExecutionKillSwitch();
  assert.equal(killSwitch.isActive(), false);

  // Manual Trip
  killSwitch.trip('Manual operator stop', 'MANUAL_USER');
  assert.equal(killSwitch.isActive(), true);
  assert.equal(killSwitch.getStatus().reason, 'Manual operator stop');

  // Reset
  killSwitch.reset();
  assert.equal(killSwitch.isActive(), false);

  // Automated Revert Circuit Breaker (3 consecutive reverts)
  killSwitch.recordRevert();
  killSwitch.recordRevert();
  assert.equal(killSwitch.isActive(), false);
  killSwitch.recordRevert();
  assert.equal(killSwitch.isActive(), true);
  assert.equal(killSwitch.getStatus().tripSource, 'CIRCUIT_BREAKER_REVERTS');
});
