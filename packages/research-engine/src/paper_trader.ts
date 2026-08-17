import { OpportunityCandidate } from './opportunity_engine.js';
import { RejectionReason } from './risk_filter.js';

export interface PaperAccount {
  startingCapitalUsd: number;
  balanceUsd: number;
  availableCapitalUsd: number;
  reservedCapitalUsd: number;
  deployedCapitalUsd: number;
  realizedGrossPnlUsd: number;
  realizedNetPnlUsd: number;
  totalFeesPaidUsd: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdownUsd: number;
  peakBalanceUsd: number;
  compounding: boolean;
}

export interface PaperTradeRecord {
  tradeId: string;
  opportunityId: string;
  timestamp: number;
  poolAddress: string;
  symbol: string;
  positionSizeUsd: number;
  grossProfitUsd: number;
  feesUsd: number;
  netProfitUsd: number;
  roi: number;
  exitStatus: 'WON' | 'LOST' | 'REVERTED';
}

export interface PaperExecutionOptions {
  edgeHaircutMultiplier?: number; // e.g. 0.5 = 50% edge captured (bribes / competition)
  lockDurationMs?: number;        // e.g. 2000ms for Base L2 block lifecycle
  currentTimeMs?: number;         // simulated timestamp for deterministic replay
  simulateRevert?: boolean;       // true if transaction failed on-chain
}

export class PaperTradingEngine {
  private account: PaperAccount;
  private trades: PaperTradeRecord[] = [];
  private rejections: Map<RejectionReason, number> = new Map();
  private activeLocks: Array<{ amountUsd: number; unlockTimeMs: number }> = [];

  constructor(startingCapitalUsd: number = 10.0, compounding: boolean = false) {
    this.account = {
      startingCapitalUsd,
      balanceUsd: startingCapitalUsd,
      availableCapitalUsd: startingCapitalUsd,
      reservedCapitalUsd: 0,
      deployedCapitalUsd: 0,
      realizedGrossPnlUsd: 0,
      realizedNetPnlUsd: 0,
      totalFeesPaidUsd: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      maxDrawdownUsd: 0,
      peakBalanceUsd: startingCapitalUsd,
      compounding,
    };
  }

  public updateStartingCapital(newCapital: number): void {
    const diff = newCapital - this.account.startingCapitalUsd;
    this.account.startingCapitalUsd = newCapital;
    this.account.balanceUsd += diff;
    this.account.availableCapitalUsd = Math.max(0, this.account.balanceUsd - this.account.reservedCapitalUsd - this.account.deployedCapitalUsd);
    if (this.account.balanceUsd > this.account.peakBalanceUsd) {
      this.account.peakBalanceUsd = this.account.balanceUsd;
    }
  }

  public getAccount(): PaperAccount {
    return { ...this.account };
  }

  public getTrades(): PaperTradeRecord[] {
    return [...this.trades];
  }

  public getRejectionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [reason, count] of this.rejections.entries()) {
      stats[reason] = count;
    }
    return stats;
  }

  public recordRejection(reason: RejectionReason): void {
    const curr = this.rejections.get(reason) || 0;
    this.rejections.set(reason, curr + 1);
  }

  public releaseExpiredLocks(currentTimeMs: number): void {
    const remaining: Array<{ amountUsd: number; unlockTimeMs: number }> = [];
    let unlockedTotal = 0;

    for (const lock of this.activeLocks) {
      if (lock.unlockTimeMs <= currentTimeMs) {
        unlockedTotal += lock.amountUsd;
      } else {
        remaining.push(lock);
      }
    }

    this.activeLocks = remaining;
    this.account.deployedCapitalUsd -= unlockedTotal;
    this.account.availableCapitalUsd += unlockedTotal;
  }

  public reserveCapital(amountUsd: number): boolean {
    if (this.account.availableCapitalUsd < amountUsd) {
      this.recordRejection('INSUFFICIENT_CAPITAL');
      return false;
    }
    this.account.availableCapitalUsd -= amountUsd;
    this.account.reservedCapitalUsd += amountUsd;
    return true;
  }

  public releaseCapital(amountUsd: number): void {
    const released = Math.min(this.account.reservedCapitalUsd, amountUsd);
    this.account.reservedCapitalUsd -= released;
    this.account.availableCapitalUsd += released;
  }

  public processOpportunity(
    opp: OpportunityCandidate,
    options: PaperExecutionOptions = {}
  ): { executed: boolean; reason?: string } {
    const now = options.currentTimeMs || Date.now();

    // Release any previously locked capital that has completed its block lifecycle
    if (options.currentTimeMs) {
      this.releaseExpiredLocks(now);
    }

    if (opp.status === 'REJECTED') {
      if (opp.rejectionReason) {
        this.recordRejection(opp.rejectionReason);
      }
      return { executed: false, reason: opp.explanation || opp.rejectionReason };
    }

    let pos = opp.bestPosition;
    let requiredCapital = pos.positionSizeUsd;

    // Enforce finite capital constraint with dynamic sizeCurve fallback
    if (this.account.availableCapitalUsd < requiredCapital && opp.sizeCurve && opp.sizeCurve.length > 0) {
      const affordablePositions = opp.sizeCurve.filter(p => p.positionSizeUsd <= this.account.availableCapitalUsd);
      if (affordablePositions.length > 0) {
        affordablePositions.sort((a, b) => b.netProfitUsd - a.netProfitUsd);
        pos = affordablePositions[0];
        requiredCapital = pos.positionSizeUsd;
      }
    }

    if (this.account.availableCapitalUsd < requiredCapital) {
      this.recordRejection('INSUFFICIENT_CAPITAL');
      return {
        executed: false,
        reason: `Insufficient capital: Available $${this.account.availableCapitalUsd.toFixed(2)} < Required $${requiredCapital.toFixed(2)}`,
      };
    }

    // Deduct capital
    this.account.availableCapitalUsd -= requiredCapital;
    this.account.deployedCapitalUsd += requiredCapital;

    const fees = pos.costUsd;
    let grossProfit = 0;
    let netProfit = 0;
    let exitStatus: 'WON' | 'LOST' | 'REVERTED' = 'LOST';

    if (options.simulateRevert) {
      // Reverted transaction: paid gas fees with 0 gross profit
      grossProfit = 0;
      netProfit = -fees;
      exitStatus = 'REVERTED';
    } else {
      const edgeMultiplier = options.edgeHaircutMultiplier !== undefined ? options.edgeHaircutMultiplier : 1.0;
      grossProfit = pos.grossProfitUsd * edgeMultiplier;
      netProfit = grossProfit - fees;
      exitStatus = netProfit > 0 ? 'WON' : 'LOST';
    }

    this.account.realizedGrossPnlUsd += grossProfit;
    this.account.totalFeesPaidUsd += fees;
    this.account.realizedNetPnlUsd += netProfit;

    if (this.account.compounding) {
      this.account.balanceUsd += netProfit;
    }

    // Capital lock handling
    const lockDuration = options.lockDurationMs || 0;
    if (lockDuration > 0 && options.currentTimeMs) {
      this.activeLocks.push({
        amountUsd: requiredCapital + (this.account.compounding ? netProfit : 0),
        unlockTimeMs: now + lockDuration,
      });
    } else {
      // Immediate lock release
      this.account.deployedCapitalUsd -= requiredCapital;
      if (this.account.compounding) {
        this.account.availableCapitalUsd += requiredCapital + netProfit;
      } else {
        this.account.availableCapitalUsd += requiredCapital;
      }
    }

    this.account.totalTrades += 1;
    if (netProfit > 0) {
      this.account.winningTrades += 1;
    } else {
      this.account.losingTrades += 1;
    }

    // High-water-mark drawdown calculation
    if (this.account.balanceUsd > this.account.peakBalanceUsd) {
      this.account.peakBalanceUsd = this.account.balanceUsd;
    }
    const currentDrawdown = this.account.peakBalanceUsd - this.account.balanceUsd;
    if (currentDrawdown > this.account.maxDrawdownUsd) {
      this.account.maxDrawdownUsd = currentDrawdown;
    }

    const tradeRecord: PaperTradeRecord = {
      tradeId: `trade-${Date.now()}-${this.account.totalTrades}`,
      opportunityId: opp.id,
      timestamp: now,
      poolAddress: opp.pool.address,
      symbol: `${opp.pool.token0.symbol}/${opp.pool.token1.symbol}`,
      positionSizeUsd: requiredCapital,
      grossProfitUsd: grossProfit,
      feesUsd: fees,
      netProfitUsd: netProfit,
      roi: requiredCapital > 0 ? netProfit / requiredCapital : 0,
      exitStatus,
    };

    this.trades.unshift(tradeRecord);
    opp.status = 'PAPER';

    return { executed: true };
  }
}
