import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RiskProfileManager, RISK_PROFILES } from '../index.js';
import type { CanonicalSandwichOpportunity } from '@base-mev/adapters';

test('RiskProfileManager initializes with default Balanced profile', () => {
  const manager = new RiskProfileManager();
  const profile = manager.getProfile();
  assert.equal(profile.type, 'BALANCED');
  assert.equal(profile.minEvHurdleUsd, 0.05);
  assert.equal(profile.maxSlippageTolerance, 0.003);
});

test('RiskProfileManager updates profile and changes evaluation criteria', () => {
  const manager = new RiskProfileManager();
  
  // Set to CONSERVATIVE
  manager.setProfile('CONSERVATIVE');
  const conservative = manager.getProfile();
  assert.equal(conservative.type, 'CONSERVATIVE');
  assert.equal(conservative.minEvHurdleUsd, 0.10);
  assert.equal(conservative.maxSlippageTolerance, 0.001);

  const mockOpp: CanonicalSandwichOpportunity = {
    id: 'opp-risk-test-1',
    chainId: 8453,
    timestamp: Date.now(),
    blockNumber: 100,
    targetTransaction: {
      hash: '0x1',
      sender: '0x2',
      router: '0x3',
      pool: '0x4',
      tokenIn: 'A',
      tokenOut: 'B',
      amountIn: 100n,
    },
    targetPool: {
      address: '0x4',
      name: 'Test Pool',
      chainId: 8453,
      factoryAddress: '0x123',
      protocol: 'uniswap_v2',
      token0: { address: '0x1', symbol: 'A', decimals: 18 },
      token1: { address: '0x2', symbol: 'B', decimals: 18 },
      feeNumerator: 997n,
      feeDenominator: 1000n,
    },
    targetToken: { address: '0x1', symbol: 'A', decimals: 18 },
    victimAmountUsd: 100,
    recommendedFrontRunSizeUsd: 1.0,
    frontRunAmountIn: 10n,
    frontRunAmountOut: 20n,
    victimOutputEstimated: 50n,
    backRunAmountIn: 20n,
    backRunAmountOut: 12n,
    grossProfitUsd: 0.04,
    estimatedGasCostUsd: 0.01,
    estimatedL1DataFeeUsd: 0.005,
    estimatedOrderingCostUsd: 0,
    estimatedFailureCostUsd: 0,
    estimatedNetProfitUsd: 0.025, // Above Aggressive, below Conservative
    executionProbability: 0.88,
    survivalProbability: 0.85,
    expectedValueUsd: 0.022, // Below Conservative $0.10
    capitalEfficiency: 0.022,
    detectionLatencyMs: 12,
    decisionLatencyMs: 5,
    riskScore: 10,
    priceImpact: 0.002, // 0.2% - Exceeds Conservative 0.1%, but within Balanced 0.3% and Aggressive 0.5%
    status: 'STAGED',
  };

  // Conservative should reject
  const resConservative = manager.evaluateOpportunity(mockOpp);
  assert.equal(resConservative.eligible, false);

  // Aggressive should allow
  manager.setProfile('AGGRESSIVE');
  const resAggressive = manager.evaluateOpportunity(mockOpp);
  assert.equal(resAggressive.eligible, true);
});
