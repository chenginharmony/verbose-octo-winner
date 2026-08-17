import { V2PoolState, SwapSimulationResult } from './types.js';

/**
 * Uniswap V2 / Constant-Product Invariant Math
 * Matching degenbot-v2-math implementation.
 */

export function calcExactInV2(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNumerator: bigint = 997n,
  feeDenominator: bigint = 1000n
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0n;
  }

  // amountInWithFee = amountIn * feeNumerator
  const amountInWithFee = amountIn * feeNumerator;
  // numerator = amountInWithFee * reserveOut
  const numerator = amountInWithFee * reserveOut;
  // denominator = (reserveIn * feeDenominator) + amountInWithFee
  const denominator = reserveIn * feeDenominator + amountInWithFee;

  return numerator / denominator;
}

export function calcExactOutV2(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNumerator: bigint = 997n,
  feeDenominator: bigint = 1000n
): bigint {
  if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= amountOut) {
    throw new Error('Invalid output amount or insufficient liquidity');
  }

  const numerator = reserveIn * amountOut * feeDenominator;
  const denominator = (reserveOut - amountOut) * feeNumerator;

  return (numerator / denominator) + 1n;
}

export function simulateV2Swap(
  state: V2PoolState,
  zeroForOne: boolean,
  amountIn: bigint
): SwapSimulationResult {
  const reserveIn = zeroForOne ? state.reserve0 : state.reserve1;
  const reserveOut = zeroForOne ? state.reserve1 : state.reserve0;

  const amountOut = calcExactInV2(
    amountIn,
    reserveIn,
    reserveOut,
    state.feeNumerator,
    state.feeDenominator
  );

  // Price impact calculation:
  // initialPrice = reserveOut / reserveIn
  // marginalPriceAfter = (reserveOut - amountOut) / (reserveIn + amountIn)
  const initialPrice = Number(reserveOut) / Number(reserveIn);
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const newPrice = Number(newReserveOut) / Number(newReserveIn);
  const priceImpact = Math.abs(initialPrice - newPrice) / initialPrice;
  const effectivePrice = amountIn > 0n ? Number(amountOut) / Number(amountIn) : 0;

  const newState: V2PoolState = {
    reserve0: zeroForOne ? newReserveIn : newReserveOut,
    reserve1: zeroForOne ? newReserveOut : newReserveIn,
    feeNumerator: state.feeNumerator,
    feeDenominator: state.feeDenominator,
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
