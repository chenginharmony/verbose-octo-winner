import {
  V2PoolState,
  AerodromeV2PoolState,
  V3PoolState,
  SwapSimulationResult,
} from './types.js';
import { simulateV2Swap } from './v2_math.js';
import { simulateAerodromeV2Swap } from './solidly_math.js';
import { simulateV3Swap } from './cl_math.js';

export interface GroundTruthTraceInput {
  txHash: string;
  blockNumber: number;
  poolAddress: string;
  protocol: string;
  zeroForOne: boolean;
  amountIn: bigint;
  actualAmountOut: bigint;
  preState: {
    reserve0?: bigint;
    reserve1?: bigint;
    stable?: boolean;
    feeNumerator?: bigint;
    feeDenominator?: bigint;
    token0Decimals?: number;
    token1Decimals?: number;
    sqrtPriceX96?: bigint;
    currentTick?: number;
    liquidity?: bigint;
    fee?: number;
    tickSpacing?: number;
    ticks?: Map<number, any>;
  };
  actualPostState?: {
    reserve0?: bigint;
    reserve1?: bigint;
    sqrtPriceX96?: bigint;
    currentTick?: number;
  };
}

export interface StateDeltaVerificationResult {
  txHash: string;
  blockNumber: number;
  protocol: string;
  predictedAmountOut: bigint;
  actualAmountOut: bigint;
  amountOutDeltaWei: bigint;
  relativeErrorPercentage: number;
  reserve0DeltaWei: bigint;
  reserve1DeltaWei: bigint;
  passed: boolean;
  status: 'EXACT_MATCH' | 'ACCEPTABLE_ROUNDING' | 'DISCREPANCY';
  details: string;
}

export class StateDeltaValidator {
  /**
   * Maximum acceptable integer rounding difference for EVM fixed-point arithmetic (in wei).
   * Standard AMM integer division truncates, yielding max 1-2 wei differences across compilers.
   */
  private readonly maxRoundingDeltaWei: bigint;

  constructor(maxRoundingDeltaWei: bigint = 2n) {
    this.maxRoundingDeltaWei = maxRoundingDeltaWei;
  }

  public verifySwapTrace(trace: GroundTruthTraceInput): StateDeltaVerificationResult {
    let simResult: SwapSimulationResult;

    if (trace.protocol === 'aerodrome_v2') {
      const state: AerodromeV2PoolState = {
        reserve0: trace.preState.reserve0 ?? 0n,
        reserve1: trace.preState.reserve1 ?? 0n,
        stable: trace.preState.stable ?? false,
        feeNumerator: trace.preState.feeNumerator ?? 30n,
        feeDenominator: trace.preState.feeDenominator ?? 10000n,
        token0Decimals: trace.preState.token0Decimals ?? 18,
        token1Decimals: trace.preState.token1Decimals ?? 6,
      };
      simResult = simulateAerodromeV2Swap(state, trace.zeroForOne, trace.amountIn);
    } else if (trace.protocol === 'uniswap_v3' || trace.protocol === 'aerodrome_v3') {
      const state: V3PoolState = {
        sqrtPriceX96: trace.preState.sqrtPriceX96 ?? 0n,
        currentTick: trace.preState.currentTick ?? 0,
        liquidity: trace.preState.liquidity ?? 0n,
        fee: trace.preState.fee ?? 500,
        tickSpacing: trace.preState.tickSpacing ?? 10,
        ticks: trace.preState.ticks ?? new Map(),
      };
      simResult = simulateV3Swap(state, trace.zeroForOne, trace.amountIn);
    } else {
      // Standard V2
      const state: V2PoolState = {
        reserve0: trace.preState.reserve0 ?? 0n,
        reserve1: trace.preState.reserve1 ?? 0n,
        feeNumerator: trace.preState.feeNumerator ?? 997n,
        feeDenominator: trace.preState.feeDenominator ?? 1000n,
      };
      simResult = simulateV2Swap(state, trace.zeroForOne, trace.amountIn);
    }

    const predictedOut = simResult.amountOut;
    const actualOut = trace.actualAmountOut;

    const deltaWei = predictedOut > actualOut ? predictedOut - actualOut : actualOut - predictedOut;

    let relativeError = 0;
    if (actualOut > 0n) {
      relativeError = Math.abs(Number(deltaWei) / Number(actualOut)) * 100;
    }

    let reserve0DeltaWei = 0n;
    let reserve1DeltaWei = 0n;

    if (trace.actualPostState && 'reserve0' in simResult.newState) {
      const simNewState = simResult.newState as V2PoolState;
      if (trace.actualPostState.reserve0 !== undefined) {
        reserve0DeltaWei =
          simNewState.reserve0 > trace.actualPostState.reserve0
            ? simNewState.reserve0 - trace.actualPostState.reserve0
            : trace.actualPostState.reserve0 - simNewState.reserve0;
      }
      if (trace.actualPostState.reserve1 !== undefined) {
        reserve1DeltaWei =
          simNewState.reserve1 > trace.actualPostState.reserve1
            ? simNewState.reserve1 - trace.actualPostState.reserve1
            : trace.actualPostState.reserve1 - simNewState.reserve1;
      }
    }

    let status: 'EXACT_MATCH' | 'ACCEPTABLE_ROUNDING' | 'DISCREPANCY' = 'DISCREPANCY';
    if (deltaWei === 0n && reserve0DeltaWei === 0n && reserve1DeltaWei === 0n) {
      status = 'EXACT_MATCH';
    } else if (deltaWei <= this.maxRoundingDeltaWei && reserve0DeltaWei <= this.maxRoundingDeltaWei && reserve1DeltaWei <= this.maxRoundingDeltaWei) {
      status = 'ACCEPTABLE_ROUNDING';
    }

    const passed = status === 'EXACT_MATCH' || status === 'ACCEPTABLE_ROUNDING';
    const details = `Predicted Out: ${predictedOut.toString()}, Actual Out: ${actualOut.toString()} | Delta: ${deltaWei.toString()} wei (${relativeError.toFixed(6)}%)`;

    return {
      txHash: trace.txHash,
      blockNumber: trace.blockNumber,
      protocol: trace.protocol,
      predictedAmountOut: predictedOut,
      actualAmountOut: actualOut,
      amountOutDeltaWei: deltaWei,
      relativeErrorPercentage: relativeError,
      reserve0DeltaWei,
      reserve1DeltaWei,
      passed,
      status,
      details,
    };
  }

  public verifyBatch(traces: GroundTruthTraceInput[]): {
    totalTraces: number;
    exactMatches: number;
    acceptableRounding: number;
    discrepancies: number;
    maxDeltaWei: bigint;
    meanErrorPercentage: number;
    passed: boolean;
    results: StateDeltaVerificationResult[];
  } {
    const results: StateDeltaVerificationResult[] = [];
    let exactMatches = 0;
    let acceptableRounding = 0;
    let discrepancies = 0;
    let maxDeltaWei = 0n;
    let totalErrorPercentage = 0;

    for (const trace of traces) {
      const res = this.verifySwapTrace(trace);
      results.push(res);

      if (res.status === 'EXACT_MATCH') exactMatches++;
      else if (res.status === 'ACCEPTABLE_ROUNDING') acceptableRounding++;
      else discrepancies++;

      if (res.amountOutDeltaWei > maxDeltaWei) {
        maxDeltaWei = res.amountOutDeltaWei;
      }
      totalErrorPercentage += res.relativeErrorPercentage;
    }

    const meanErrorPercentage = traces.length > 0 ? totalErrorPercentage / traces.length : 0;
    const passed = discrepancies === 0;

    return {
      totalTraces: traces.length,
      exactMatches,
      acceptableRounding,
      discrepancies,
      maxDeltaWei,
      meanErrorPercentage,
      passed,
      results,
    };
  }
}
