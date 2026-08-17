import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StateDeltaValidator, GroundTruthTraceInput } from '../index.js';

describe('Ground Truth State Delta Validator Suite', () => {
  it('validates Aerodrome V2 volatile swap against ground truth with 0 wei error', () => {
    const validator = new StateDeltaValidator(1n);

    // Initial pool state: 500 WETH ($1.5M), 1,500,000 USDC ($1.5M), 0.3% fee
    const trace: GroundTruthTraceInput = {
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: 15200300,
      poolAddress: '0xB4885Bc63399BF55161A639B07AE3a9e0Ecb50E4',
      protocol: 'aerodrome_v2',
      zeroForOne: true,
      amountIn: 1n * 10n ** 18n, // 1 WETH
      actualAmountOut: 2985047814n, // Exact: (997e15 * 1.5e12) / (500e18 + 997e15)
      preState: {
        reserve0: 500n * 10n ** 18n,
        reserve1: 1500000n * 10n ** 6n,
        stable: false,
        feeNumerator: 30n,
        feeDenominator: 10000n,
        token0Decimals: 18,
        token1Decimals: 6,
      },
      actualPostState: {
        reserve0: 500n * 10n ** 18n + 1n * 10n ** 18n,
        reserve1: 1500000n * 10n ** 6n - 2985047814n,
      },
    };

    const result = validator.verifySwapTrace(trace);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.status, 'EXACT_MATCH');
    assert.strictEqual(result.amountOutDeltaWei, 0n);
    assert.strictEqual(result.reserve0DeltaWei, 0n);
    assert.strictEqual(result.reserve1DeltaWei, 0n);
  });

  it('runs batch reality check across multiple pool traces', () => {
    const validator = new StateDeltaValidator(2n);

    const traces: GroundTruthTraceInput[] = [
      {
        txHash: '0xaaa1',
        blockNumber: 15200301,
        poolAddress: '0xB4885Bc63399BF55161A639B07AE3a9e0Ecb50E4',
        protocol: 'aerodrome_v2',
        zeroForOne: true,
        amountIn: 2n * 10n ** 18n,
        actualAmountOut: 5958238544n,
        preState: {
          reserve0: 500n * 10n ** 18n,
          reserve1: 1500000n * 10n ** 6n,
          stable: false,
          feeNumerator: 30n,
          feeDenominator: 10000n,
          token0Decimals: 18,
          token1Decimals: 6,
        },
      },
      {
        txHash: '0xaaa2',
        blockNumber: 15200302,
        poolAddress: '0x32A6f3F3A06B956553B81F28C3408a2872A4b61B',
        protocol: 'aerodrome_v2',
        zeroForOne: false,
        amountIn: 100000n * 10n ** 18n, // 100,000 BRETT
        actualAmountOut: 331232537201367455n, // Exact: (99700e18 * 100e18) / (30099700e18)
        preState: {
          reserve0: 100n * 10n ** 18n, // 100 WETH
          reserve1: 30000000n * 10n ** 18n, // 30M BRETT
          stable: false,
          feeNumerator: 30n,
          feeDenominator: 10000n,
          token0Decimals: 18,
          token1Decimals: 18,
        },
      },
    ];

    const batchRes = validator.verifyBatch(traces);
    assert.strictEqual(batchRes.passed, true);
    assert.strictEqual(batchRes.discrepancies, 0);
    assert.ok(batchRes.exactMatches + batchRes.acceptableRounding === 2);
  });
});
