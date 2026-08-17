import type { CanonicalSandwichOpportunity } from '@base-mev/adapters';

export type RiskProfileType = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'MICRO';

export interface RiskProfile {
  type: RiskProfileType;
  label: string;
  minEvHurdleUsd: number;
  minProfitHurdleUsd: number;
  maxSlippageTolerance: number; // e.g. 0.001 = 0.1%
  minExecutionProbability: number; // e.g. 0.95 = 95%
  maxLatencyMs: number;
  maxDailyDrawdownUsd: number;
  maxPositionSizeUsd: number;
  description: string;
  color: string;
}

export const RISK_PROFILES: Record<RiskProfileType, RiskProfile> = {
  CONSERVATIVE: {
    type: 'CONSERVATIVE',
    label: 'Conservative (Ultra Low Risk)',
    minEvHurdleUsd: 0.05,
    minProfitHurdleUsd: 0.02,
    maxSlippageTolerance: 0.002, // 0.2% max price impact
    minExecutionProbability: 0.90, // 90% min confidence
    maxLatencyMs: 50,
    maxDailyDrawdownUsd: 0.50,
    maxPositionSizeUsd: 1.00,
    description: 'High-conviction trades only with minimal slippage tolerance and strict EV hurdles ($0.05+).',
    color: 'emerald',
  },
  BALANCED: {
    type: 'BALANCED',
    label: 'Disciplined HFT (Micro-Edge Harvester)',
    minEvHurdleUsd: 0.01,
    minProfitHurdleUsd: 0.01,
    maxSlippageTolerance: 0.008, // 0.8% max price impact (rejects unsafe 2%+ slippage)
    minExecutionProbability: 0.75, // 75% min confidence
    maxLatencyMs: 100,
    maxDailyDrawdownUsd: 1.00,
    maxPositionSizeUsd: 1.00,
    description: 'Disciplined HFT system: captures $0.01 - $0.10 edges reliably without gambling on volatile spikes.',
    color: 'amber',
  },
  AGGRESSIVE: {
    type: 'AGGRESSIVE',
    label: 'Dynamic Micro-Spread (High Throughput)',
    minEvHurdleUsd: 0.005,
    minProfitHurdleUsd: 0.005,
    maxSlippageTolerance: 0.015,
    minExecutionProbability: 0.60,
    maxLatencyMs: 200,
    maxDailyDrawdownUsd: 2.00,
    maxPositionSizeUsd: 1.00,
    description: 'Captures fast micro-spreads with controlled slippage (max 1.5%) and positive EV.',
    color: 'cyan',
  },
  MICRO: {
    type: 'MICRO',
    label: '🔬 Micro Sandwich (1 trade, any positive edge)',
    minEvHurdleUsd: 0.0001,      // Accept $0.0001 expected value — any real edge
    minProfitHurdleUsd: 0.0001,  // Accept $0.0001 net profit — don't ignore tiny wins
    maxSlippageTolerance: 0.03,  // 3% — wide tolerance for small pools
    minExecutionProbability: 0.40, // 40% — take the trade if it has any real chance
    maxLatencyMs: 500,
    maxDailyDrawdownUsd: 0.20,   // Max $0.20 loss per day — strict downside cap
    maxPositionSizeUsd: 0.10,    // Max $0.10 per trade — tiny bites only
    description: 'One trade at a time. Any positive net profit above $0.0001 passes. Sized for sub-$1 wallets.',
    color: 'violet',
  },
};

export class RiskProfileManager {
  private currentProfile: RiskProfile;

  constructor(initialType: RiskProfileType = 'BALANCED') {
    this.currentProfile = RISK_PROFILES[initialType] || RISK_PROFILES.BALANCED;
  }

  public getProfile(): RiskProfile {
    return { ...this.currentProfile };
  }

  public setProfile(type: RiskProfileType): RiskProfile {
    if (RISK_PROFILES[type]) {
      this.currentProfile = RISK_PROFILES[type];
    }
    return this.getProfile();
  }

  public getAllProfiles(): RiskProfile[] {
    return Object.values(RISK_PROFILES);
  }

  public evaluateOpportunity(opp: CanonicalSandwichOpportunity): {
    eligible: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const p = this.currentProfile;

    if (opp.expectedValueUsd < p.minEvHurdleUsd) {
      reasons.push(`EV ($${opp.expectedValueUsd.toFixed(4)}) below profile minimum ($${p.minEvHurdleUsd.toFixed(2)})`);
    }

    if (opp.estimatedNetProfitUsd < p.minProfitHurdleUsd) {
      reasons.push(`Net profit ($${opp.estimatedNetProfitUsd.toFixed(4)}) below minimum hurdle ($${p.minProfitHurdleUsd.toFixed(3)})`);
    }

    if (opp.priceImpact > p.maxSlippageTolerance) {
      reasons.push(`Price impact (${(opp.priceImpact * 100).toFixed(2)}%) exceeds max slippage tolerance (${(p.maxSlippageTolerance * 100).toFixed(1)}%)`);
    }

    if (opp.executionProbability + 0.001 < p.minExecutionProbability) {
      const margin = (opp.executionProbability - p.minExecutionProbability) * 100;
      reasons.push(`Execution probability (${(opp.executionProbability * 100).toFixed(1)}%) below required threshold (${(p.minExecutionProbability * 100).toFixed(1)}%, margin: ${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%)`);
    }

    const totalLatency = opp.detectionLatencyMs + opp.decisionLatencyMs;
    if (totalLatency > p.maxLatencyMs) {
      reasons.push(`Total latency (${totalLatency}ms) exceeds profile max (${p.maxLatencyMs}ms)`);
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }
}
