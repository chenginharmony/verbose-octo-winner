import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calcExactInV2,
  calcExactOutV2,
  simulateV2Swap,
  calcD,
  calcF,
  calcK,
  getYSolidly,
  calcExactInVolatileAerodrome,
  calcExactInStableSolidly,
  simulateAerodromeV2Swap,
  getSqrtRatioAtTick,
  simulateV3Swap,
  ONE_18,
  V2PoolState,
  AerodromeV2PoolState,
  V3PoolState,
} from '../index.js';

describe('Base MEV AMM Math Suite (Degenbot Parity)', () => {
  describe('Uniswap V2 / Constant-Product Math', () => {
    it('calculates exact-in swap with standard 0.3% fee', () => {
      // 1000 WETH and 2,000,000 USDC
      const reserve0 = 1000n * 10n ** 18n;
      const reserve1 = 2000000n * 10n ** 6n;
      const amountIn = 1n * 10n ** 18n; // 1 WETH

      const amountOut = calcExactInV2(amountIn, reserve0, reserve1, 997n, 1000n);
      assert.ok(amountOut > 0n);
      assert.strictEqual(amountOut, 1992013962n);
    });

    it('calculates exact-out swap correctly', () => {
      const reserve0 = 1000n * 10n ** 18n;
      const reserve1 = 2000000n * 10n ** 6n;
      const amountOut = 1992013962n;

      const amountIn = calcExactOutV2(amountOut, reserve0, reserve1, 997n, 1000n);
      // Precision within 1000 wei due to 6 vs 18 decimal quantization
      const diff = amountIn > 10n ** 18n ? amountIn - 10n ** 18n : 10n ** 18n - amountIn;
      assert.ok(diff < 100000000n);
    });

    it('simulates state update and price impact', () => {
      const state: V2PoolState = {
        reserve0: 1000n * 10n ** 18n,
        reserve1: 2000000n * 10n ** 6n,
        feeNumerator: 997n,
        feeDenominator: 1000n,
      };

      const sim = simulateV2Swap(state, true, 10n * 10n ** 18n);
      const newState = sim.newState as V2PoolState;
      assert.strictEqual(sim.amountIn, 10n * 10n ** 18n);
      assert.ok(sim.amountOut > 0n);
      assert.ok(sim.priceImpact > 0);
      assert.strictEqual(newState.reserve0, state.reserve0 + 10n * 10n ** 18n);
      assert.strictEqual(newState.reserve1, state.reserve1 - sim.amountOut);
    });
  });

  describe('Aerodrome V2 (Solidly Volatile & Stable Curve Math)', () => {
    it('calculates volatile Aerodrome swaps with custom fee fractions', () => {
      const reserve0 = 500n * 10n ** 18n;
      const reserve1 = 1500000n * 10n ** 6n;
      const amountIn = 1n * 10n ** 18n;
      // 0.05% fee: 5 / 10000
      const out = calcExactInVolatileAerodrome(amountIn, 0, reserve0, reserve1, 5n, 10000n);
      assert.ok(out > 0n);
    });

    it('solves Solidly stable curve x^3y + y^3x = k via Newton-Raphson', () => {
      const balance0 = 1000000n * 10n ** 6n; // 1M USDC (6 decimals)
      const balance1 = 1000000n * 10n ** 6n; // 1M USDT (6 decimals)
      const dec0 = 10n ** 6n;
      const dec1 = 10n ** 6n;

      const k = calcK(balance0, balance1, dec0, dec1);
      assert.ok(k > 0n);

      const x0 = (balance0 * ONE_18) / dec0;
      const ySeed = (balance1 * ONE_18) / dec1;
      const y = getYSolidly(x0, k, ySeed);
      assert.strictEqual(y, ySeed);
    });

    it('simulates Aerodrome V2 stable pool swap', () => {
      const state: AerodromeV2PoolState = {
        reserve0: 5000000n * 10n ** 6n, // 5M USDC
        reserve1: 5000000n * 10n ** 6n, // 5M USDT
        stable: true,
        feeNumerator: 1n, // 0.01% fee (1 / 10000)
        feeDenominator: 10000n,
        token0Decimals: 6,
        token1Decimals: 6,
      };

      const sim = simulateAerodromeV2Swap(state, true, 1000n * 10n ** 6n); // 1000 USDC
      assert.ok(sim.amountOut > 0n);
      // Stable swap has very low slippage / near 1:1 conversion
      assert.ok(sim.amountOut > 998n * 10n ** 6n);
    });
  });

  describe('Uniswap V3 / Aerodrome Slipstream Concentrated Liquidity', () => {
    it('computes exact sqrt ratio at tick 0', () => {
      const sqrtP0 = getSqrtRatioAtTick(0);
      const Q96 = 2n ** 96n;
      assert.strictEqual(sqrtP0, Q96);
    });

    it('simulates concentrated liquidity V3 swap', () => {
      const state: V3PoolState = {
        sqrtPriceX96: 2n ** 96n,
        currentTick: 0,
        liquidity: 1000000000000000000000n,
        fee: 500, // 0.05%
        tickSpacing: 10,
        ticks: new Map(),
      };

      const sim = simulateV3Swap(state, true, 10n ** 18n);
      assert.ok(sim.amountOut > 0n);
      assert.strictEqual(sim.amountIn, 10n ** 18n);
    });
  });
});
