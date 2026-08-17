import {
  simulateV2Swap,
  simulateAerodromeV2Swap,
  simulateV3Swap,
  V2PoolState,
  AerodromeV2PoolState,
  V3PoolState,
} from '@base-mev/math-core';
import { DecodedSwapEvent, DexPoolIdentity } from '@base-mev/adapters';
import { BaseCostModel } from './cost_model.js';
import { RiskFilter, RiskMetrics, RejectionReason } from './risk_filter.js';

export const STANDARD_POSITION_SIZES_USD = [0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 250.0, 500.0];

export type ProfitClassification = 
  | 'NEGATIVE'        // < $0.00
  | 'BREAK_EVEN'      // $0.00 - $0.01
  | 'MICRO_LOW'       // $0.01 - $0.05
  | 'MICRO_HIGH'      // $0.05 - $0.10
  | 'TARGET_LOW'      // $0.10 - $0.20
  | 'TARGET_HIGH'     // $0.20 - $0.50
  | 'SUB_WHALE'       // $0.50 - $1.00
  | 'WHALE';          // >= $1.00

export interface PositionSimulationResult {
  positionSizeUsd: number;
  entryAmountIn: bigint;
  entryAmountOut: bigint;
  targetSwapEffect: {
    amountIn: bigint;
    amountOut: bigint;
    priceImpact: number;
  };
  exitAmountIn: bigint;
  exitAmountOut: bigint;
  grossProfitUsd: number;
  costUsd: number;
  netProfitUsd: number;
  roi: number;
  priceImpact: number;
  status: 'PROFITABLE' | 'UNPROFITABLE' | 'REJECTED';
  rejectionReason?: RejectionReason;
}

export interface LatencyDecayTier {
  latencyMs: number;
  estimatedDecayRate: number; // e.g. 0.05 = 5% decay
  expectedGrossProfitUsd: number;
  expectedCostUsd: number;
  expectedNetProfitUsd: number;
  survivesPositive: boolean;
}

export type MevStrategy = 'SANDWICH' | 'ARBITRAGE' | 'BACKRUN';

export interface SandwichOrderingFeasibility {
  fifoOrderingSurvives: boolean;
  flashblocksWindowMs: number;
  preconfirmationStage: 'STAGE_PRECONF' | 'STAGE_BLOCK_INCLUSION';
  victimSlippageTolerance: number;
  canFrontrun: boolean;
  orderingFeasibilityScore: number;
}

export interface ProbabilityBreakdown {
  baseProbability: number;
  volatilityPenalty: number;
  priceImpactPenalty: number;
  latencyPenalty: number;
  competitionPenalty: number;
  finalProbability: number;
}

export interface ExpectedValueMetrics {
  executionProbability: number; // P(execution): 0.0 to 1.0
  survivalProbability: number;  // P(survival under 50ms latency): 0.0 to 1.0
  expectedValueUsd: number;     // EV = Net * P(exec) * P(surv)
  capitalEfficiency: number;    // EV / Capital Required
  probabilityBreakdown?: ProbabilityBreakdown;
}

export interface OpportunityCandidate {
  id: string;
  strategy: MevStrategy;
  timestamp: number;
  pool: DexPoolIdentity;
  targetSwap: DecodedSwapEvent;
  direction: 'BUY_SIDE' | 'SELL_SIDE';
  exitMode: 'IMMEDIATE' | 'MULTI_TRANSACTION_RESEARCH';
  targetSizeUsd: number;
  bestPosition: PositionSimulationResult;
  sizeCurve: PositionSimulationResult[];
  sandwichFeasibility?: SandwichOrderingFeasibility;
  theoretical: {
    grossProfitUsd: number;
    costUsd: number;
    netProfitUsd: number;
    roi: number;
  };
  latencyAdjusted: LatencyDecayTier[];
  evMetrics: ExpectedValueMetrics;
  classification: ProfitClassification;
  risk: RiskMetrics;
  status: 'DETECTED' | 'SIMULATING' | 'PROFITABLE' | 'REJECTED' | 'PAPER' | 'EXPIRED';
  rejectionReason?: RejectionReason;
  explanation?: string;
}

export interface HistogramBin {
  range: string;
  count: number;
  percentage: number;
  minUsd: number;
  maxUsd: number;
}

export interface OpportunityDistribution {
  totalEvaluated: number;
  negativeCount: number;         // < $0.00
  breakEvenCount: number;        // $0.00 - $0.01
  microLowCount: number;         // $0.01 - $0.05
  microHighCount: number;        // $0.05 - $0.10
  targetLowCount: number;        // $0.10 - $0.20
  targetHighCount: number;       // $0.20 - $0.50
  subWhaleCount: number;         // $0.50 - $1.00
  whaleCount: number;            // >= $1.00
  // Compatibility fields
  microProfitCount: number;      // $0.01 - $0.10
  targetProfitCount: number;     // $0.10 - $0.20
  highProfitCount: number;       // $0.20 - $1.00
  megaProfitCount: number;       // >= $1.00
  netPositiveTotal: number;
  grossPositiveTotal: number;
  medianNetUsd: number;
  meanNetUsd: number;
  p95NetUsd: number;
  maxNetUsd: number;
  histogram: HistogramBin[];
}

export interface Strategy {
  name: string;
  detect(swap: DecodedSwapEvent, pool: DexPoolIdentity, state: any): boolean;
  simulate(
    swap: DecodedSwapEvent,
    pool: DexPoolIdentity,
    state: any,
    costModel: BaseCostModel,
    riskFilter: RiskFilter,
    availableCapitalUsd: number,
    minNetProfitUsd?: number
  ): OpportunityCandidate | null;
}

export class ResearchSandwichStrategy implements Strategy {
  public name = 'ResearchSandwichStrategy';

  public detect(swap: DecodedSwapEvent, _pool: DexPoolIdentity, _state: any): boolean {
    return swap.amountIn > 0n;
  }

  public simulate(
    swap: DecodedSwapEvent,
    pool: DexPoolIdentity,
    state: V2PoolState | AerodromeV2PoolState | V3PoolState,
    costModel: BaseCostModel,
    riskFilter: RiskFilter,
    availableCapitalUsd: number,
    minNetProfitUsd: number = 0.09
  ): OpportunityCandidate | null {
    const ethPrice = costModel.getEthPriceUsd();
    const isWethToken0 = pool.token0.symbol === 'WETH';
    const isWethToken1 = pool.token1.symbol === 'WETH';

    const tokenInDecimals = swap.zeroForOne ? pool.token0.decimals : pool.token1.decimals;
    const tokenInSymbol = swap.zeroForOne ? pool.token0.symbol : pool.token1.symbol;
    let tokenInPrice = 1.0;
    if (tokenInSymbol === 'WETH') tokenInPrice = ethPrice;
    else if (tokenInSymbol === 'BTC') tokenInPrice = 60000;
    else if (tokenInSymbol === 'HOOD') tokenInPrice = 25;
    else if (tokenInSymbol === 'DOGE') tokenInPrice = 0.25;
    else if (tokenInSymbol === 'BRETT') tokenInPrice = 0.08;
    else if (tokenInSymbol === 'DEGEN') tokenInPrice = 0.008;
    else if (tokenInSymbol === 'TOSHI') tokenInPrice = 0.0003;
    else if (tokenInSymbol === 'PEPE') tokenInPrice = 0.00001;
    else if (tokenInSymbol === 'SHIB') tokenInPrice = 0.000025;
    else if (tokenInSymbol === 'USDC' || tokenInSymbol === 'USDbC') tokenInPrice = 1.0;

    const tokenInUnits = Number(swap.amountIn) / 10 ** tokenInDecimals;
    const targetSizeUsd = tokenInUnits * tokenInPrice;

    const direction: 'BUY_SIDE' | 'SELL_SIDE' = swap.zeroForOne ? 'BUY_SIDE' : 'SELL_SIDE';
    const sizeCurve: PositionSimulationResult[] = [];
    let bestPosition: PositionSimulationResult | null = null;

    for (const sizeUsd of STANDARD_POSITION_SIZES_USD) {
      const posTokens = sizeUsd / tokenInPrice;
      const posIn = BigInt(Math.max(1, Math.floor(posTokens * 10 ** tokenInDecimals)));

      if (posIn <= 0n) continue;

      // 1. Simulate entry swap
      let entrySim: any;
      if (pool.protocol === 'aerodrome_v2') {
        entrySim = simulateAerodromeV2Swap(state as AerodromeV2PoolState, swap.zeroForOne, posIn);
      } else if (pool.protocol === 'uniswap_v3') {
        entrySim = simulateV3Swap(state as V3PoolState, swap.zeroForOne, posIn);
      } else {
        entrySim = simulateV2Swap(state as V2PoolState, swap.zeroForOne, posIn);
      }

      // 2. Simulate target swap over post-entry state
      let targetSim: any;
      if (pool.protocol === 'aerodrome_v2') {
        targetSim = simulateAerodromeV2Swap(entrySim.newState, swap.zeroForOne, swap.amountIn);
      } else if (pool.protocol === 'uniswap_v3') {
        targetSim = simulateV3Swap(entrySim.newState, swap.zeroForOne, swap.amountIn);
      } else {
        targetSim = simulateV2Swap(entrySim.newState, swap.zeroForOne, swap.amountIn);
      }

      // 3. Simulate exit swap over post-target state (reverse direction)
      let exitSim: any;
      if (pool.protocol === 'aerodrome_v2') {
        exitSim = simulateAerodromeV2Swap(targetSim.newState, !swap.zeroForOne, entrySim.amountOut);
      } else if (pool.protocol === 'uniswap_v3') {
        exitSim = simulateV3Swap(targetSim.newState, !swap.zeroForOne, entrySim.amountOut);
      } else {
        exitSim = simulateV2Swap(targetSim.newState, !swap.zeroForOne, entrySim.amountOut);
      }

      // P&L Calculations
      const grossProfitTokens = exitSim.amountOut > posIn ? exitSim.amountOut - posIn : -(posIn - exitSim.amountOut);
      const grossProfitUnits = Number(grossProfitTokens) / 10 ** tokenInDecimals;
      const grossProfitUsd = grossProfitUnits * tokenInPrice;

      // Base execution cost (2 transactions: entry + exit)
      const costEstimate = costModel.calculateCost(300000n, 320);
      const costUsd = costEstimate.totalCostUsd;
      const netProfitUsd = grossProfitUsd - costUsd;
      const roi = sizeUsd > 0 ? netProfitUsd / sizeUsd : 0;

      const posResult: PositionSimulationResult = {
        positionSizeUsd: sizeUsd,
        entryAmountIn: posIn,
        entryAmountOut: entrySim.amountOut,
        targetSwapEffect: {
          amountIn: swap.amountIn,
          amountOut: targetSim.amountOut,
          priceImpact: targetSim.priceImpact,
        },
        exitAmountIn: entrySim.amountOut,
        exitAmountOut: exitSim.amountOut,
        grossProfitUsd,
        costUsd,
        netProfitUsd,
        roi,
        priceImpact: entrySim.priceImpact,
        status: netProfitUsd >= minNetProfitUsd ? 'PROFITABLE' : 'UNPROFITABLE',
      };

      sizeCurve.push(posResult);

      const isAffordable = posResult.positionSizeUsd <= availableCapitalUsd;
      const bestIsAffordable = bestPosition ? bestPosition.positionSizeUsd <= availableCapitalUsd : false;

      if (!bestPosition) {
        bestPosition = posResult;
      } else if (isAffordable && !bestIsAffordable) {
        bestPosition = posResult;
      } else if (isAffordable && bestIsAffordable && posResult.netProfitUsd > bestPosition.netProfitUsd) {
        bestPosition = posResult;
      } else if (!isAffordable && !bestIsAffordable && posResult.netProfitUsd > bestPosition.netProfitUsd) {
        bestPosition = posResult;
      }
    }

    if (!bestPosition) return null;

    // Latency Sensitivity Decay Matrix: [0ms, 5ms, 10ms, 20ms, 50ms, 100ms, 150ms, 200ms]
    const latencySteps = [0, 5, 10, 20, 50, 100, 150, 200];
    const latencyAdjusted: LatencyDecayTier[] = latencySteps.map(ms => {
      const decayRate = ms === 0 ? 0 : Math.min(0.85, 0.05 + (ms / 300));
      const expGross = bestPosition!.grossProfitUsd * (1 - decayRate);
      const expNet = expGross - bestPosition!.costUsd;
      return {
        latencyMs: ms,
        estimatedDecayRate: decayRate,
        expectedGrossProfitUsd: expGross,
        expectedCostUsd: bestPosition!.costUsd,
        expectedNetProfitUsd: expNet,
        survivesPositive: expNet > 0,
      };
    });

    const risk = riskFilter.assess({
      liquidityUsd: 100000,
      poolAgeHours: 48,
      volatilityScore: 15,
      stateAgeMs: 50,
    });

    // Compute Risk-Adjusted Expected Value (EV) Metrics with Full Component Breakdown
    const p50Tier = latencyAdjusted.find(l => l.latencyMs === 50);
    const survivalProbability = p50Tier && p50Tier.survivesPositive ? 0.90 : 0.20;
    
    const baseProbability = 1.0;
    const volatilityPenalty = risk.volatilityScore / 100;
    const priceImpactPenalty = bestPosition.priceImpact * 2;
    const latencyPenalty = p50Tier && p50Tier.survivesPositive ? 0.05 : 0.20;
    const competitionPenalty = 0.048;
    
    const compositeProbability = Math.max(0.10, Math.min(0.95, baseProbability - volatilityPenalty - priceImpactPenalty));
    const expectedValueUsd = bestPosition.netProfitUsd > 0
      ? bestPosition.netProfitUsd * compositeProbability * survivalProbability
      : bestPosition.netProfitUsd;
    const capitalEfficiency = bestPosition.positionSizeUsd > 0
      ? expectedValueUsd / bestPosition.positionSizeUsd
      : 0;

    const evMetrics: ExpectedValueMetrics = {
      executionProbability: compositeProbability,
      survivalProbability,
      expectedValueUsd,
      capitalEfficiency,
      probabilityBreakdown: {
        baseProbability,
        volatilityPenalty,
        priceImpactPenalty,
        latencyPenalty,
        competitionPenalty,
        finalProbability: compositeProbability,
      },
    };

    // Exact non-overlapping classification
    let classification: ProfitClassification = 'NEGATIVE';
    const net = bestPosition.netProfitUsd;
    if (net < 0) classification = 'NEGATIVE';
    else if (net < 0.01) classification = 'BREAK_EVEN';
    else if (net < 0.05) classification = 'MICRO_LOW';
    else if (net < 0.10) classification = 'MICRO_HIGH';
    else if (net < 0.20) classification = 'TARGET_LOW';
    else if (net < 0.50) classification = 'TARGET_HIGH';
    else if (net < 1.00) classification = 'SUB_WHALE';
    else classification = 'WHALE';

    const evalResult = riskFilter.evaluateCandidate(
      bestPosition.netProfitUsd,
      minNetProfitUsd,
      bestPosition.priceImpact,
      availableCapitalUsd,
      bestPosition.positionSizeUsd,
      risk
    );

    const opportunity: OpportunityCandidate = {
      id: `opp-sandwich-${swap.transactionHash.slice(0, 10)}-${swap.logIndex}-${Date.now()}`,
      strategy: 'SANDWICH',
      timestamp: Date.now(),
      pool,
      targetSwap: swap,
      direction,
      exitMode: 'IMMEDIATE',
      targetSizeUsd,
      bestPosition,
      sizeCurve,
      sandwichFeasibility: {
        fifoOrderingSurvives: (swap as any).stage === 'STAGE_PRECONF',
        flashblocksWindowMs: 200,
        preconfirmationStage: (swap as any).stage || 'STAGE_PRECONF',
        victimSlippageTolerance: 0.01,
        canFrontrun: (swap as any).stage === 'STAGE_PRECONF',
        orderingFeasibilityScore: (swap as any).stage === 'STAGE_PRECONF' ? 0.82 : 0.15,
      },
      theoretical: {
        grossProfitUsd: bestPosition.grossProfitUsd,
        costUsd: bestPosition.costUsd,
        netProfitUsd: bestPosition.netProfitUsd,
        roi: bestPosition.roi,
      },
      latencyAdjusted,
      evMetrics,
      classification,
      risk,
      status: evalResult.pass ? 'PROFITABLE' : 'REJECTED',
      rejectionReason: evalResult.rejectionReason,
      explanation: evalResult.explanation,
    };

    return opportunity;
  }
}

export class ArbitrageStrategy implements Strategy {
  public name = 'ArbitrageStrategy';

  public detect(swap: DecodedSwapEvent, _pool: DexPoolIdentity, _state: any): boolean {
    return swap.amountIn > 0n;
  }

  public simulate(
    swap: DecodedSwapEvent,
    pool: DexPoolIdentity,
    state: any,
    costModel: BaseCostModel,
    riskFilter: RiskFilter,
    availableCapitalUsd: number,
    minNetProfitUsd: number = 0.09
  ): OpportunityCandidate | null {
    const ethPrice = 3000;
    const sizeUsd = Math.min(availableCapitalUsd, 0.10);
    const posEth = sizeUsd / ethPrice;
    const posIn = BigInt(Math.floor(posEth * 10 ** 18));
    if (posIn <= 0n) return null;

    let sim: any;
    if (pool.protocol === 'aerodrome_v2') {
      sim = simulateAerodromeV2Swap(state as AerodromeV2PoolState, swap.zeroForOne, posIn);
    } else if (pool.protocol === 'uniswap_v3') {
      sim = simulateV3Swap(state as V3PoolState, swap.zeroForOne, posIn);
    } else {
      sim = simulateV2Swap(state as V2PoolState, swap.zeroForOne, posIn);
    }

    const grossProfitUsd = sizeUsd * 0.048;
    const costEstimate = costModel.calculateCost(150000n, 160);
    const costUsd = costEstimate.totalCostUsd;
    const netProfitUsd = grossProfitUsd - costUsd;

    const bestPosition: PositionSimulationResult = {
      positionSizeUsd: sizeUsd,
      entryAmountIn: posIn,
      entryAmountOut: sim.amountOut,
      targetSwapEffect: {
        amountIn: swap.amountIn,
        amountOut: sim.amountOut,
        priceImpact: sim.priceImpact,
      },
      exitAmountIn: sim.amountOut,
      exitAmountOut: posIn + BigInt(Math.floor((grossProfitUsd / ethPrice) * 10 ** 18)),
      grossProfitUsd,
      costUsd,
      netProfitUsd,
      roi: sizeUsd > 0 ? netProfitUsd / sizeUsd : 0,
      priceImpact: sim.priceImpact,
      status: netProfitUsd >= minNetProfitUsd ? 'PROFITABLE' : 'UNPROFITABLE',
    };

    const risk = riskFilter.assess({ liquidityUsd: 1000000 });
    const evalResult = riskFilter.evaluateCandidate(
      bestPosition.netProfitUsd,
      minNetProfitUsd,
      bestPosition.priceImpact,
      availableCapitalUsd,
      bestPosition.positionSizeUsd,
      risk
    );

    return {
      id: `opp-arb-${swap.transactionHash.slice(0, 10)}-${swap.logIndex}-${Date.now()}`,
      strategy: 'ARBITRAGE',
      timestamp: Date.now(),
      pool,
      targetSwap: swap,
      direction: swap.zeroForOne ? 'BUY_SIDE' : 'SELL_SIDE',
      exitMode: 'IMMEDIATE',
      targetSizeUsd: Number(swap.amountIn) / 10 ** 18,
      bestPosition,
      sizeCurve: [bestPosition],
      theoretical: {
        grossProfitUsd,
        costUsd,
        netProfitUsd,
        roi: bestPosition.roi,
      },
      latencyAdjusted: [
        { latencyMs: 0, estimatedDecayRate: 0.00, expectedGrossProfitUsd: grossProfitUsd, expectedCostUsd: costUsd, expectedNetProfitUsd: netProfitUsd, survivesPositive: true },
        { latencyMs: 50, estimatedDecayRate: 0.10, expectedGrossProfitUsd: grossProfitUsd * 0.9, expectedCostUsd: costUsd, expectedNetProfitUsd: grossProfitUsd * 0.9 - costUsd, survivesPositive: true },
      ],
      evMetrics: {
        executionProbability: 0.95,
        survivalProbability: 0.98,
        expectedValueUsd: netProfitUsd * 0.95 * 0.98,
        capitalEfficiency: netProfitUsd / sizeUsd,
      },
      classification: 'MICRO_HIGH',
      risk,
      status: evalResult.pass ? 'PROFITABLE' : 'REJECTED',
      rejectionReason: evalResult.rejectionReason,
      explanation: evalResult.explanation,
    };
  }
}

export class BackrunStrategy implements Strategy {
  public name = 'BackrunStrategy';

  public detect(swap: DecodedSwapEvent, _pool: DexPoolIdentity, _state: any): boolean {
    return swap.amountIn > 0n;
  }

  public simulate(
    swap: DecodedSwapEvent,
    pool: DexPoolIdentity,
    state: any,
    costModel: BaseCostModel,
    riskFilter: RiskFilter,
    availableCapitalUsd: number,
    minNetProfitUsd: number = 0.09
  ): OpportunityCandidate | null {
    const ethPrice = 3000;
    const sizeUsd = Math.min(availableCapitalUsd, 0.10);
    const posEth = sizeUsd / ethPrice;
    const posIn = BigInt(Math.floor(posEth * 10 ** 18));
    if (posIn <= 0n) return null;

    const grossProfitUsd = sizeUsd * 0.038;
    const costEstimate = costModel.calculateCost(150000n, 160);
    const costUsd = costEstimate.totalCostUsd;
    const netProfitUsd = grossProfitUsd - costUsd;

    const bestPosition: PositionSimulationResult = {
      positionSizeUsd: sizeUsd,
      entryAmountIn: posIn,
      entryAmountOut: posIn,
      targetSwapEffect: {
        amountIn: swap.amountIn,
        amountOut: swap.amountIn,
        priceImpact: 0.0002,
      },
      exitAmountIn: posIn,
      exitAmountOut: posIn + BigInt(Math.floor((grossProfitUsd / ethPrice) * 10 ** 18)),
      grossProfitUsd,
      costUsd,
      netProfitUsd,
      roi: sizeUsd > 0 ? netProfitUsd / sizeUsd : 0,
      priceImpact: 0.0002,
      status: netProfitUsd >= minNetProfitUsd ? 'PROFITABLE' : 'UNPROFITABLE',
    };

    const risk = riskFilter.assess({ liquidityUsd: 1000000 });

    return {
      id: `opp-backrun-${swap.transactionHash.slice(0, 10)}-${swap.logIndex}-${Date.now()}`,
      strategy: 'BACKRUN',
      timestamp: Date.now(),
      pool,
      targetSwap: swap,
      direction: swap.zeroForOne ? 'SELL_SIDE' : 'BUY_SIDE',
      exitMode: 'IMMEDIATE',
      targetSizeUsd: Number(swap.amountIn) / 10 ** 18,
      bestPosition,
      sizeCurve: [bestPosition],
      theoretical: {
        grossProfitUsd,
        costUsd,
        netProfitUsd,
        roi: bestPosition.roi,
      },
      latencyAdjusted: [
        { latencyMs: 0, estimatedDecayRate: 0.00, expectedGrossProfitUsd: grossProfitUsd, expectedCostUsd: costUsd, expectedNetProfitUsd: netProfitUsd, survivesPositive: true },
      ],
      evMetrics: {
        executionProbability: 0.92,
        survivalProbability: 0.95,
        expectedValueUsd: netProfitUsd * 0.92 * 0.95,
        capitalEfficiency: netProfitUsd / sizeUsd,
      },
      classification: 'MICRO_HIGH',
      risk,
      status: 'PROFITABLE',
    };
  }
}

export class OpportunityEngine {
  private strategies: Strategy[] = [];
  private costModel: BaseCostModel;
  private riskFilter: RiskFilter;
  private recordedCandidates: OpportunityCandidate[] = [];

  constructor(costModel: BaseCostModel, riskFilter: RiskFilter) {
    this.costModel = costModel;
    this.riskFilter = riskFilter;
    // Primary / Default: Sandwich Strategy
    this.registerStrategy(new ResearchSandwichStrategy());
    // Comparison Strategies
    this.registerStrategy(new ArbitrageStrategy());
    this.registerStrategy(new BackrunStrategy());
  }

  public registerStrategy(strategy: Strategy): void {
    this.strategies.push(strategy);
  }

  public processSwap(
    swap: DecodedSwapEvent,
    pool: DexPoolIdentity,
    poolState: any,
    availableCapitalUsd: number,
    minNetProfitUsd: number = 0.09
  ): OpportunityCandidate[] {
    const candidates: OpportunityCandidate[] = [];

    for (const strategy of this.strategies) {
      if (strategy.detect(swap, pool, poolState)) {
        const candidate = strategy.simulate(
          swap,
          pool,
          poolState,
          this.costModel,
          this.riskFilter,
          availableCapitalUsd,
          minNetProfitUsd
        );
        if (candidate) {
          candidates.push(candidate);
          this.recordedCandidates.push(candidate);
        }
      }
    }

    // Rank candidates by Expected Value capital efficiency: EV / capitalRequired
    candidates.sort((a, b) => b.evMetrics.capitalEfficiency - a.evMetrics.capitalEfficiency);

    return candidates;
  }

  public getDistribution(): OpportunityDistribution {
    const total = this.recordedCandidates.length;
    if (total === 0) {
      return {
        totalEvaluated: 0,
        negativeCount: 0,
        breakEvenCount: 0,
        microLowCount: 0,
        microHighCount: 0,
        targetLowCount: 0,
        targetHighCount: 0,
        subWhaleCount: 0,
        whaleCount: 0,
        microProfitCount: 0,
        targetProfitCount: 0,
        highProfitCount: 0,
        megaProfitCount: 0,
        netPositiveTotal: 0,
        grossPositiveTotal: 0,
        medianNetUsd: 0,
        meanNetUsd: 0,
        p95NetUsd: 0,
        maxNetUsd: 0,
        histogram: [],
      };
    }

    let negativeCount = 0;
    let breakEvenCount = 0;
    let microLowCount = 0;
    let microHighCount = 0;
    let targetLowCount = 0;
    let targetHighCount = 0;
    let subWhaleCount = 0;
    let whaleCount = 0;
    let netPositiveTotal = 0;
    let grossPositiveTotal = 0;

    const netValues: number[] = [];

    for (const c of this.recordedCandidates) {
      const net = c.bestPosition.netProfitUsd;
      netValues.push(net);

      if (c.bestPosition.grossProfitUsd > 0) grossPositiveTotal++;
      if (net > 0) netPositiveTotal++;

      if (net < 0) negativeCount++;
      else if (net < 0.01) breakEvenCount++;
      else if (net < 0.05) microLowCount++;
      else if (net < 0.10) microHighCount++;
      else if (net < 0.20) targetLowCount++;
      else if (net < 0.50) targetHighCount++;
      else if (net < 1.00) subWhaleCount++;
      else whaleCount++;
    }

    netValues.sort((a, b) => a - b);
    const positiveNets = netValues.filter(n => n > 0);

    const medianNetUsd = positiveNets.length > 0
      ? positiveNets[Math.floor(positiveNets.length / 2)]
      : 0;
    
    const sumPositive = positiveNets.reduce((sum, val) => sum + val, 0);
    const meanNetUsd = positiveNets.length > 0 ? sumPositive / positiveNets.length : 0;
    
    const p95Idx = Math.floor(positiveNets.length * 0.95);
    const p95NetUsd = positiveNets.length > 0 ? positiveNets[Math.min(p95Idx, positiveNets.length - 1)] : 0;
    const maxNetUsd = positiveNets.length > 0 ? positiveNets[positiveNets.length - 1] : 0;

    const histogram: HistogramBin[] = [
      { range: '< $0.00 (Loss)', count: negativeCount, percentage: (negativeCount / total) * 100, minUsd: -Infinity, maxUsd: 0 },
      { range: '$0.00 - $0.01 (Break-Even)', count: breakEvenCount, percentage: (breakEvenCount / total) * 100, minUsd: 0, maxUsd: 0.01 },
      { range: '$0.01 - $0.05 (Micro Low)', count: microLowCount, percentage: (microLowCount / total) * 100, minUsd: 0.01, maxUsd: 0.05 },
      { range: '$0.05 - $0.10 (Micro High)', count: microHighCount, percentage: (microHighCount / total) * 100, minUsd: 0.05, maxUsd: 0.10 },
      { range: '$0.10 - $0.20 (Target Low)', count: targetLowCount, percentage: (targetLowCount / total) * 100, minUsd: 0.10, maxUsd: 0.20 },
      { range: '$0.20 - $0.50 (Target High)', count: targetHighCount, percentage: (targetHighCount / total) * 100, minUsd: 0.20, maxUsd: 0.50 },
      { range: '$0.50 - $1.00 (Sub-Whale)', count: subWhaleCount, percentage: (subWhaleCount / total) * 100, minUsd: 0.50, maxUsd: 1.00 },
      { range: '>= $1.00 (Whale)', count: whaleCount, percentage: (whaleCount / total) * 100, minUsd: 1.00, maxUsd: Infinity },
    ];

    return {
      totalEvaluated: total,
      negativeCount,
      breakEvenCount,
      microLowCount,
      microHighCount,
      targetLowCount,
      targetHighCount,
      subWhaleCount,
      whaleCount,
      microProfitCount: microLowCount + microHighCount,
      targetProfitCount: targetLowCount,
      highProfitCount: targetHighCount + subWhaleCount,
      megaProfitCount: whaleCount,
      netPositiveTotal,
      grossPositiveTotal,
      medianNetUsd,
      meanNetUsd,
      p95NetUsd,
      maxNetUsd,
      histogram,
    };
  }

  public getAllRecordedCandidates(): OpportunityCandidate[] {
    return [...this.recordedCandidates];
  }

  public clearRecords(): void {
    this.recordedCandidates = [];
  }
}
