export type RejectionReason =
  | 'LOW_NET_PROFIT'
  | 'HIGH_SLIPPAGE'
  | 'LOW_LIQUIDITY'
  | 'INSUFFICIENT_CAPITAL'
  | 'STALE_STATE'
  | 'HIGH_RISK'
  | 'LATENCY'
  | 'DUPLICATE'
  | 'INVALID_SWAP'
  | 'UNKNOWN_POOL'
  | 'UNKNOWN_TOKEN'
  | 'COST_TOO_HIGH';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface RiskMetrics {
  score: number; // 0 to 100 (0 = safe, 100 = critical risk)
  level: RiskLevel;
  liquidityUsd: number;
  poolAgeHours: number;
  volatilityScore: number;
  reasons: string[];
}

export class RiskFilter {
  private minLiquidityUsd: number;
  private maxSlippage: number;
  private maxRiskScore: number;

  constructor(
    minLiquidityUsd: number = 500,
    maxSlippage: number = 0.03,
    maxRiskScore: number = 60
  ) {
    this.minLiquidityUsd = minLiquidityUsd;
    this.maxSlippage = maxSlippage;
    this.maxRiskScore = maxRiskScore;
  }

  public assess(pool: {
    liquidityUsd: number;
    poolAgeHours?: number;
    volatilityScore?: number;
    stateAgeMs?: number;
  }): RiskMetrics {
    let score = 10;
    const reasons: string[] = [];

    const liquidity = pool.liquidityUsd || 0;
    const age = pool.poolAgeHours || 24;
    const vol = pool.volatilityScore || 10;
    const stateAge = pool.stateAgeMs || 0;

    if (liquidity < this.minLiquidityUsd) {
      score += 40;
      reasons.push(`Low liquidity ($${liquidity.toFixed(2)} < $${this.minLiquidityUsd})`);
    }

    if (age < 6) {
      score += 25;
      reasons.push(`New pool age (${age.toFixed(1)}h < 6h)`);
    }

    if (vol > 50) {
      score += 20;
      reasons.push(`High price volatility (${vol.toFixed(1)})`);
    }

    if (stateAge > 5000) {
      score += 30;
      reasons.push(`Stale state (${stateAge}ms old)`);
    }

    let level: RiskLevel = 'LOW';
    if (score > 70) level = 'HIGH';
    else if (score > 35) level = 'MEDIUM';

    return {
      score: Math.min(score, 100),
      level,
      liquidityUsd: liquidity,
      poolAgeHours: age,
      volatilityScore: vol,
      reasons,
    };
  }

  public evaluateCandidate(
    netProfitUsd: number,
    minNetProfitUsd: number,
    slippage: number,
    availableCapitalUsd: number,
    requiredCapitalUsd: number,
    risk: RiskMetrics
  ): { pass: boolean; rejectionReason?: RejectionReason; explanation?: string } {
    if (netProfitUsd < minNetProfitUsd) {
      return {
        pass: false,
        rejectionReason: 'LOW_NET_PROFIT',
        explanation: `Net profit $${netProfitUsd.toFixed(4)} < threshold $${minNetProfitUsd.toFixed(4)}`,
      };
    }

    if (slippage > this.maxSlippage) {
      return {
        pass: false,
        rejectionReason: 'HIGH_SLIPPAGE',
        explanation: `Slippage ${(slippage * 100).toFixed(2)}% > max ${(this.maxSlippage * 100).toFixed(2)}%`,
      };
    }

    if (availableCapitalUsd < requiredCapitalUsd) {
      return {
        pass: false,
        rejectionReason: 'INSUFFICIENT_CAPITAL',
        explanation: `Required capital $${requiredCapitalUsd.toFixed(2)} > available $${availableCapitalUsd.toFixed(2)}`,
      };
    }

    if (risk.score > this.maxRiskScore) {
      return {
        pass: false,
        rejectionReason: 'HIGH_RISK',
        explanation: `Risk score ${risk.score} > max allowed ${this.maxRiskScore} (${risk.reasons.join(', ')})`,
      };
    }

    return { pass: true };
  }
}
