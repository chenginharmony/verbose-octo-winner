import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BundleBuilder, StagingHarness, CanonicalSandwichOpportunity } from '../index.js';

test('BundleBuilder constructs valid Flashbots/Flashblocks private bundle', () => {
  const builder = new BundleBuilder({ defaultMaxTimestampWindowMs: 3000 });

  const mockOpp: CanonicalSandwichOpportunity = {
    id: 'opp-bundle-test-1',
    chainId: 8453,
    timestamp: Date.now(),
    blockNumber: 22000000,
    targetTransaction: {
      hash: '0xvictim1234567890abcdef',
      sender: '0x1111111111111111111111111111111111111111',
      router: '0x2222222222222222222222222222222222222222',
      pool: '0x3333333333333333333333333333333333333333',
      tokenIn: 'WETH',
      tokenOut: 'USDC',
      amountIn: 1000000000000000000n,
    },
    targetPool: {
      address: '0x3333333333333333333333333333333333333333',
      name: 'Aerodrome V2 WETH/USDC',
      chainId: 8453,
      factoryAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      protocol: 'aerodrome_v2',
      token0: { address: '0x1', symbol: 'WETH', decimals: 18 },
      token1: { address: '0x2', symbol: 'USDC', decimals: 6 },
      feeNumerator: 997n,
      feeDenominator: 1000n,
    },
    targetToken: { address: '0x1', symbol: 'WETH', decimals: 18 },
    victimAmountUsd: 3000,
    recommendedFrontRunSizeUsd: 1.0,
    frontRunAmountIn: 333333333333333n,
    frontRunAmountOut: 1000000n,
    victimOutputEstimated: 2990000000n,
    backRunAmountIn: 1000000n,
    backRunAmountOut: 345000000000000n,
    grossProfitUsd: 0.035,
    estimatedGasCostUsd: 0.005,
    estimatedL1DataFeeUsd: 0.002,
    estimatedOrderingCostUsd: 0,
    estimatedFailureCostUsd: 0,
    estimatedNetProfitUsd: 0.028,
    executionProbability: 0.95,
    survivalProbability: 0.92,
    expectedValueUsd: 0.024,
    capitalEfficiency: 0.024,
    detectionLatencyMs: 10,
    decisionLatencyMs: 4,
    riskScore: 5,
    priceImpact: 0.002,
    status: 'STAGED',
  };

  const frontRunRawHex = '0x02frontrun';
  const backRunRawHex = '0x02backrun';
  const bundle = builder.buildBundle(mockOpp, frontRunRawHex, backRunRawHex);

  assert.equal(bundle.txs.length, 3);
  assert.equal(bundle.txs[0], frontRunRawHex);
  assert.equal(bundle.txs[1], '0xvictim1234567890abcdef');
  assert.equal(bundle.txs[2], backRunRawHex);
  assert.equal(bundle.blockNumber, `0x${(22000001).toString(16)}`);

  const rpcReq = builder.formatJsonRpcRequest(bundle);
  assert.equal(rpcReq.method, 'eth_sendBundle');
  assert.equal(rpcReq.jsonrpc, '2.0');
});

test('StagingHarness performs preflight validation and enforces hurdles', async () => {
  const harness = new StagingHarness(0.01);
  const mockOpp: CanonicalSandwichOpportunity = {
    id: 'opp-harness-test',
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
    grossProfitUsd: 0.05,
    estimatedGasCostUsd: 0.01,
    estimatedL1DataFeeUsd: 0.005,
    estimatedOrderingCostUsd: 0,
    estimatedFailureCostUsd: 0,
    estimatedNetProfitUsd: 0.035,
    executionProbability: 0.9,
    survivalProbability: 0.9,
    expectedValueUsd: 0.028,
    capitalEfficiency: 0.028,
    detectionLatencyMs: 12,
    decisionLatencyMs: 5,
    riskScore: 10,
    priceImpact: 0.001,
    status: 'STAGED',
  };

  const builder = new BundleBuilder();
  const bundle = builder.buildBundle(mockOpp, '0xfront', '0xback');
  const preflight = await harness.simulatePreflight(mockOpp, bundle);

  assert.equal(preflight.simulated, true);
  assert.equal(preflight.hurdleCleared, true);
  assert.equal(preflight.success, true);
  assert.equal(preflight.expectedGrossProfitUsd, 0.05);
  assert.equal(preflight.totalCostUsd, 0.015);
  assert.equal(preflight.expectedNetProfitUsd, 0.035);
});
