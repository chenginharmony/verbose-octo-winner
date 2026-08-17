import { CanonicalSandwichOpportunity } from '@base-mev/adapters';

export interface ProfitabilityGateConfig {
  minNetProfitUsd?: number;
  minExpectedValueUsd?: number;
  maxPriceImpact?: number;
  maxAllowedLatencyMs?: number;
  maxPositionSizeUsd?: number;
  minCapitalEfficiency?: number;
  failureCostWeight?: number;
}

export interface GateEvaluationResult {
  passed: boolean;
  effectiveNetProfitUsd: number;
  riskAdjustedEvUsd: number;
  rejectionReason?: string;
  explanation: string;
}

/**
 * ProfitabilityGate
 * Enforces rigorous profitability checks requiring:
 * grossProfit - gas - L1DataFee - orderingCost - expectedFailureCost > minNetProfit
 */
export class ProfitabilityGate {
  private minNetProfitUsd: number;
  private minExpectedValueUsd: number;
  private maxPriceImpact: number;
  private maxAllowedLatencyMs: number;
  private maxPositionSizeUsd: number;
  private minCapitalEfficiency: number;
  private failureCostWeight: number;

  constructor(config: ProfitabilityGateConfig = {}) {
    this.minNetProfitUsd = config.minNetProfitUsd ?? 0.05;
    this.minExpectedValueUsd = config.minExpectedValueUsd ?? 0.02;
    this.maxPriceImpact = config.maxPriceImpact ?? 0.03; // 3%
    this.maxAllowedLatencyMs = config.maxAllowedLatencyMs ?? 150; // 150ms
    this.maxPositionSizeUsd = config.maxPositionSizeUsd ?? 500.0;
    this.minCapitalEfficiency = config.minCapitalEfficiency ?? 0.005; // 0.5%
    this.failureCostWeight = config.failureCostWeight ?? 0.25;
  }

  public setHurdles(minNetProfitUsd: number, minExpectedValueUsd: number, maxPriceImpact?: number, maxAllowedLatencyMs?: number): void {
    this.minNetProfitUsd = minNetProfitUsd;
    this.minExpectedValueUsd = minExpectedValueUsd;
    if (maxPriceImpact !== undefined) this.maxPriceImpact = maxPriceImpact;
    if (maxAllowedLatencyMs !== undefined) this.maxAllowedLatencyMs = maxAllowedLatencyMs;
  }

  /**
   * Evaluate a sandwich opportunity candidate against the profitability gate
   */
  public evaluate(opportunity: CanonicalSandwichOpportunity): GateEvaluationResult {
    const totalFees = opportunity.estimatedGasCostUsd + opportunity.estimatedL1DataFeeUsd;
    const orderingCost = opportunity.estimatedOrderingCostUsd || 0.0;
    const failurePenalty = (1 - opportunity.survivalProbability) * totalFees * this.failureCostWeight;

    // Effective net profit considering ordering competition and failure risk
    const effectiveNet = opportunity.grossProfitUsd - totalFees - orderingCost - failurePenalty;

    // Risk-adjusted EV
    const riskAdjustedEv = effectiveNet > 0
      ? effectiveNet * opportunity.executionProbability * opportunity.survivalProbability
      : effectiveNet;

    // 1. Latency check
    const totalLatency = opportunity.detectionLatencyMs + opportunity.decisionLatencyMs;
    if (totalLatency > this.maxAllowedLatencyMs) {
      return {
        passed: false,
        effectiveNetProfitUsd: effectiveNet,
        riskAdjustedEvUsd: riskAdjustedEv,
        rejectionReason: 'LATENCY_EXCEEDED',
        explanation: `Total latency (${totalLatency}ms) exceeds maximum threshold of ${this.maxAllowedLatencyMs}ms`,
      };
    }

    // 2. Price impact ceiling
    if (opportunity.priceImpact > this.maxPriceImpact) {
      return {
        passed: false,
        effectiveNetProfitUsd: effectiveNet,
        riskAdjustedEvUsd: riskAdjustedEv,
        rejectionReason: 'PRICE_IMPACT_TOO_HIGH',
        explanation: `Price impact ${(opportunity.priceImpact * 100).toFixed(2)}% exceeds max ${(this.maxPriceImpact * 100).toFixed(2)}%`,
      };
    }

    // 3. Position size check
    if (opportunity.recommendedFrontRunSizeUsd > this.maxPositionSizeUsd) {
      return {
        passed: false,
        effectiveNetProfitUsd: effectiveNet,
        riskAdjustedEvUsd: riskAdjustedEv,
        rejectionReason: 'POSITION_SIZE_EXCEEDED',
        explanation: `Recommended size $${opportunity.recommendedFrontRunSizeUsd.toFixed(2)} exceeds ceiling $${this.maxPositionSizeUsd.toFixed(2)}`,
      };
    }

    // 4. Net profit check
    if (effectiveNet < this.minNetProfitUsd) {
      return {
        passed: false,
        effectiveNetProfitUsd: effectiveNet,
        riskAdjustedEvUsd: riskAdjustedEv,
        rejectionReason: 'UNPROFITABLE_NET_YIELD',
        explanation: `Effective net profit $${effectiveNet.toFixed(4)} is below minimum hurdle rate of $${this.minNetProfitUsd.toFixed(4)}`,
      };
    }

    // 5. Expected Value (EV) hurdle check
    if (riskAdjustedEv < this.minExpectedValueUsd) {
      return {
        passed: false,
        effectiveNetProfitUsd: effectiveNet,
        riskAdjustedEvUsd: riskAdjustedEv,
        rejectionReason: 'INSUFFICIENT_EXPECTED_VALUE',
        explanation: `Risk-adjusted EV $${riskAdjustedEv.toFixed(4)} is below minimum threshold of $${this.minExpectedValueUsd.toFixed(4)}`,
      };
    }

    return {
      passed: true,
      effectiveNetProfitUsd: effectiveNet,
      riskAdjustedEvUsd: riskAdjustedEv,
      explanation: `Opportunity passed profitability gate (Net: +$${effectiveNet.toFixed(4)}, EV: +$${riskAdjustedEv.toFixed(4)})`,
    };
  }
}
