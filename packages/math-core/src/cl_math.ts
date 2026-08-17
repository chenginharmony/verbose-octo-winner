import { V3PoolState, SwapSimulationResult } from './types.js';

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

const Q96 = 2n ** 96n;
const Q128 = 2n ** 128n;

export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = Math.abs(tick);
  if (absTick > MAX_TICK) {
    throw new Error(`Tick ${tick} exceeds bounds`);
  }

  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594ba1n : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135b97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f0091d612n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    ratio = (2n ** 256n - 1n) / ratio;
  }

  // Convert to Q96
  return (ratio >> 32n) + (ratio % (1n << 32n) > 0n ? 1n : 0n);
}

export function getAmount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  const [sqrtA, sqrtB] = sqrtRatioAX96 > sqrtRatioBX96 ? [sqrtRatioBX96, sqrtRatioAX96] : [sqrtRatioAX96, sqrtRatioBX96];
  if (sqrtA <= 0n) return 0n;

  const numerator1 = liquidity << 96n;
  const numerator2 = sqrtB - sqrtA;

  if (roundUp) {
    const num = (numerator1 * numerator2) / sqrtB;
    return (num + sqrtA - 1n) / sqrtA;
  } else {
    return (numerator1 * numerator2) / sqrtB / sqrtA;
  }
}

export function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  const [sqrtA, sqrtB] = sqrtRatioAX96 > sqrtRatioBX96 ? [sqrtRatioBX96, sqrtRatioAX96] : [sqrtRatioAX96, sqrtRatioBX96];
  if (roundUp) {
    return (liquidity * (sqrtB - sqrtA) + Q96 - 1n) / Q96;
  } else {
    return (liquidity * (sqrtB - sqrtA)) / Q96;
  }
}

export function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (amount === 0n) return sqrtPX96;
  const numerator1 = liquidity << 96n;

  if (add) {
    const product = amount * sqrtPX96;
    if (product / amount === sqrtPX96) {
      const denominator = numerator1 + product;
      if (denominator >= numerator1) {
        return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
      }
    }
    return (numerator1 + (numerator1 / sqrtPX96) + amount - 1n) / ((numerator1 / sqrtPX96) + amount);
  } else {
    const product = amount * sqrtPX96;
    const denominator = numerator1 - product;
    return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
  }
}

export function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (add) {
    const quotient = (amount << 96n) / liquidity;
    return sqrtPX96 + quotient;
  } else {
    const quotient = (amount << 96n + liquidity - 1n) / liquidity;
    return sqrtPX96 - quotient;
  }
}

export function computeSwapStep(
  sqrtRatioCurrentX96: bigint,
  sqrtRatioTargetX96: bigint,
  liquidity: bigint,
  amountRemaining: bigint,
  feePips: number
): {
  sqrtRatioNextX96: bigint;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
} {
  const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
  const exactIn = amountRemaining >= 0n;

  let sqrtRatioNextX96: bigint;
  let amountIn: bigint = 0n;
  let amountOut: bigint = 0n;
  let feeAmount: bigint = 0n;

  const feeDenominator = 1000000n;
  const feeNumerator = BigInt(feePips);

  if (exactIn) {
    const amountRemainingLessFee = (amountRemaining * (feeDenominator - feeNumerator)) / feeDenominator;
    amountIn = zeroForOne
      ? getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
      : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);

    if (amountRemainingLessFee >= amountIn) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = zeroForOne
        ? getNextSqrtPriceFromAmount0RoundingUp(sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, true)
        : getNextSqrtPriceFromAmount1RoundingDown(sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, true);
    }
  } else {
    amountOut = zeroForOne
      ? getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
      : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);

    if (-amountRemaining >= amountOut) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = zeroForOne
        ? getNextSqrtPriceFromAmount1RoundingDown(sqrtRatioCurrentX96, liquidity, -amountRemaining, false)
        : getNextSqrtPriceFromAmount0RoundingUp(sqrtRatioCurrentX96, liquidity, -amountRemaining, false);
    }
  }

  const isMax = sqrtRatioNextX96 === sqrtRatioTargetX96;

  if (zeroForOne) {
    amountIn = isMax && exactIn ? amountIn : getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
    amountOut = isMax && !exactIn ? amountOut : getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
  } else {
    amountIn = isMax && exactIn ? amountIn : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
    amountOut = isMax && !exactIn ? amountOut : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
  }

  if (exactIn && sqrtRatioNextX96 !== sqrtRatioTargetX96) {
    feeAmount = amountRemaining - amountIn;
  } else {
    feeAmount = (amountIn * feeNumerator + feeDenominator - feeNumerator - 1n) / (feeDenominator - feeNumerator);
  }

  return {
    sqrtRatioNextX96,
    amountIn,
    amountOut,
    feeAmount,
  };
}

export function simulateV3Swap(
  state: V3PoolState,
  zeroForOne: boolean,
  amountSpecified: bigint,
  sqrtPriceLimitX96?: bigint
): SwapSimulationResult {
  const sqrtPriceLimit = sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n);

  let stateCurrent = {
    amountSpecifiedRemaining: amountSpecified,
    amountCalculated: 0n,
    sqrtPriceX96: state.sqrtPriceX96,
    tick: state.currentTick,
    liquidity: state.liquidity,
  };

  const initialPrice = Number(state.sqrtPriceX96) / Number(Q96);

  // Single-tick or multi-tick step simulation
  // For bounded research, compute step to target limit
  const step = computeSwapStep(
    stateCurrent.sqrtPriceX96,
    sqrtPriceLimit,
    stateCurrent.liquidity,
    stateCurrent.amountSpecifiedRemaining,
    state.fee
  );

  stateCurrent.amountSpecifiedRemaining -= (step.amountIn + step.feeAmount);
  stateCurrent.amountCalculated += step.amountOut;
  stateCurrent.sqrtPriceX96 = step.sqrtRatioNextX96;

  const finalPrice = Number(stateCurrent.sqrtPriceX96) / Number(Q96);
  const priceImpact = Math.abs(initialPrice - finalPrice) / (initialPrice || 1);
  const effectivePrice = amountSpecified > 0n ? Number(stateCurrent.amountCalculated) / Number(amountSpecified) : 0;

  const newState: V3PoolState = {
    ...state,
    sqrtPriceX96: stateCurrent.sqrtPriceX96,
    currentTick: stateCurrent.tick,
    liquidity: stateCurrent.liquidity,
  };

  return {
    amountIn: amountSpecified,
    amountOut: stateCurrent.amountCalculated,
    zeroForOne,
    priceImpact,
    effectivePrice,
    executionPriceX96: stateCurrent.sqrtPriceX96,
    newState,
  };
}
