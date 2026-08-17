import { AerodromeV2PoolState, SwapSimulationResult } from './types.js';

export const ONE_18 = 10n ** 18n;

/**
 * Aerodrome / Solidly Invariant Math
 * Direct 1:1 port of degenbot-solidly-math (rust/crates/degenbot-solidly-math/src/solidly.rs)
 */

export function calcD(x0: bigint, y: bigint): bigint {
  const three = 3n;
  const yy = (y * y) / ONE_18;
  const term1 = (three * x0 * yy) / ONE_18;
  const x0x0 = (x0 * x0) / ONE_18;
  const term2 = (x0x0 * x0) / ONE_18;
  return term1 + term2;
}

export function calcF(x0: bigint, y: bigint): bigint {
  const a = (x0 * y) / ONE_18;
  const b = ((x0 * x0) / ONE_18) + ((y * y) / ONE_18);
  return (a * b) / ONE_18;
}

export function calcK(
  balance0: bigint,
  balance1: bigint,
  decimals0: bigint,
  decimals1: bigint
): bigint {
  if (decimals0 === 0n || decimals1 === 0n) {
    throw new Error('Division by zero in decimals');
  }
  const x = (balance0 * ONE_18) / decimals0;
  const y = (balance1 * ONE_18) / decimals1;
  const a = (x * y) / ONE_18;
  const b = ((x * x) / ONE_18) + ((y * y) / ONE_18);
  return (a * b) / ONE_18;
}

export function getYSolidly(
  x0: bigint,
  xy: bigint,
  ySeed: bigint
): bigint {
  let y = ySeed;
  for (let i = 0; i < 255; i++) {
    const k = calcF(x0, y);
    if (k < xy) {
      const d = calcD(x0, y);
      if (d === 0n) break;
      const dy = ((xy - k) * ONE_18) / d;
      if (dy === 0n) {
        if (k === xy) return y;
        const yPlusOne = y + 1n;
        if (calcF(x0, yPlusOne) > xy) {
          return yPlusOne;
        }
        y = yPlusOne;
      } else {
        y += dy;
      }
    } else {
      const d = calcD(x0, y);
      if (d === 0n) break;
      const dy = ((k - xy) * ONE_18) / d;
      if (dy === 0n) {
        if (k === xy) return y;
        const yMinusOne = y - 1n;
        if (calcF(x0, yMinusOne) < xy) {
          return y;
        }
        y = yMinusOne;
      } else {
        y = y > dy ? y - dy : 0n;
      }
    }
  }
  return y;
}

export function calcExactInVolatileAerodrome(
  amountIn: bigint,
  tokenIn: 0 | 1,
  reserve0: bigint,
  reserve1: bigint,
  feeNumerator: bigint,
  feeDenominator: bigint
): bigint {
  if (amountIn <= 0n) return 0n;
  const fee = (amountIn * feeNumerator) / feeDenominator;
  const amountInAfterFee = amountIn - fee;

  const [reserveIn, reserveOut] = tokenIn === 0 ? [reserve0, reserve1] : [reserve1, reserve0];
  const numerator = amountInAfterFee * reserveOut;
  const denominator = reserveIn + amountInAfterFee;

  return numerator / denominator;
}

export function calcExactInStableSolidly(
  amountIn: bigint,
  tokenIn: 0 | 1,
  reserve0: bigint,
  reserve1: bigint,
  feeNumerator: bigint,
  feeDenominator: bigint,
  token0Decimals: number,
  token1Decimals: number
): bigint {
  if (amountIn <= 0n) return 0n;
  const fee = (amountIn * feeNumerator) / feeDenominator;
  const amountInAfterFee = amountIn - fee;

  const dec0 = 10n ** BigInt(token0Decimals);
  const dec1 = 10n ** BigInt(token1Decimals);

  const k = calcK(reserve0, reserve1, dec0, dec1);

  if (tokenIn === 0) {
    const x0 = ((reserve0 + amountInAfterFee) * ONE_18) / dec0;
    const ySeed = (reserve1 * ONE_18) / dec1;
    const yNew = getYSolidly(x0, k, ySeed);
    const reserve1New = (yNew * dec1) / ONE_18;
    return reserve1 > reserve1New ? reserve1 - reserve1New : 0n;
  } else {
    const x0 = ((reserve1 + amountInAfterFee) * ONE_18) / dec1;
    const ySeed = (reserve0 * ONE_18) / dec0;
    const yNew = getYSolidly(x0, k, ySeed);
    const reserve0New = (yNew * dec0) / ONE_18;
    return reserve0 > reserve0New ? reserve0 - reserve0New : 0n;
  }
}

export function simulateAerodromeV2Swap(
  state: AerodromeV2PoolState,
  zeroForOne: boolean,
  amountIn: bigint
): SwapSimulationResult {
  const tokenIn = zeroForOne ? 0 : 1;
  let amountOut: bigint;

  if (!state.stable) {
    amountOut = calcExactInVolatileAerodrome(
      amountIn,
      tokenIn,
      state.reserve0,
      state.reserve1,
      state.feeNumerator,
      state.feeDenominator
    );
  } else {
    amountOut = calcExactInStableSolidly(
      amountIn,
      tokenIn,
      state.reserve0,
      state.reserve1,
      state.feeNumerator,
      state.feeDenominator,
      state.token0Decimals,
      state.token1Decimals
    );
  }

  const reserveIn = zeroForOne ? state.reserve0 : state.reserve1;
  const reserveOut = zeroForOne ? state.reserve1 : state.reserve0;
  const initialPrice = Number(reserveOut) / Number(reserveIn);
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const newPrice = Number(newReserveOut) / Number(newReserveIn);
  const priceImpact = Math.abs(initialPrice - newPrice) / (initialPrice || 1);
  const effectivePrice = amountIn > 0n ? Number(amountOut) / Number(amountIn) : 0;

  const newState: AerodromeV2PoolState = {
    ...state,
    reserve0: zeroForOne ? newReserveIn : newReserveOut,
    reserve1: zeroForOne ? newReserveOut : newReserveIn,
  };

  return {
    amountIn,
    amountOut,
    zeroForOne,
    priceImpact,
    effectivePrice,
    newState,
  };
}
