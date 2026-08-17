import { RejectionReason } from './risk_filter.js';

export interface CapitalAccountConfig {
  initialCapitalUsd?: number;
  maxConcurrentPositions?: number;
  maxPositionSizeUsd?: number;
  maxDailyCostUsd?: number;
  maxDailyLossUsd?: number;
  compounding?: boolean;
}

export interface CapitalAccountState {
  initialCapitalUsd: number;
  balanceUsd: number;
  availableCapitalUsd: number;
  reservedCapitalUsd: number;
  committedCapitalUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalFeesPaidUsd: number;
  totalFailedCostsUsd: number;
  dailyCostSpentUsd: number;
  dailyLossUsd: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  revertedTrades: number;
  peakBalanceUsd: number;
  maxDrawdownUsd: number;
  maxDrawdownPercent: number;
  compounding: boolean;
  activePositionsCount: number;
}

export interface PositionLock {
  id: string;
  opportunityId: string;
  amountUsd: number;
  lockedAt: number;
  lockExpiresAt: number;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'SETTLED';
}

export interface CapitalSettlementRecord {
  settlementId: string;
  opportunityId: string;
  timestamp: number;
  positionSizeUsd: number;
  grossProfitUsd: number;
  feesPaidUsd: number;
  netProfitUsd: number;
  status: 'WON' | 'LOST' | 'REVERTED';
}

/**
 * CapitalManager
 * Production-grade capital management subsystem with multi-position allocation,
 * concurrency controls, daily loss ceilings, and deterministic P&L accounting.
 */
export class CapitalManager {
  private config: Required<CapitalAccountConfig>;
  private state: CapitalAccountState;
  private activeLocks: Map<string, PositionLock> = new Map();
  private settlementHistory: CapitalSettlementRecord[] = [];
  private rejections: Map<string, number> = new Map();
  private lastDailyResetTimestamp: number = Date.now();

  constructor(config: CapitalAccountConfig = {}) {
    const initialCapital = config.initialCapitalUsd ?? 1.0;
    this.config = {
      initialCapitalUsd: initialCapital,
      maxConcurrentPositions: config.maxConcurrentPositions ?? 1,
      maxPositionSizeUsd: config.maxPositionSizeUsd ?? 50.0,
      maxDailyCostUsd: config.maxDailyCostUsd ?? 5.0,
      maxDailyLossUsd: config.maxDailyLossUsd ?? 2.5,
      compounding: config.compounding ?? false,
    };

    this.state = {
      initialCapitalUsd: initialCapital,
      balanceUsd: initialCapital,
      availableCapitalUsd: initialCapital,
      reservedCapitalUsd: 0,
      committedCapitalUsd: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      totalFeesPaidUsd: 0,
      totalFailedCostsUsd: 0,
      dailyCostSpentUsd: 0,
      dailyLossUsd: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      revertedTrades: 0,
      peakBalanceUsd: initialCapital,
      maxDrawdownUsd: 0,
      maxDrawdownPercent: 0,
      compounding: this.config.compounding,
      activePositionsCount: 0,
    };
  }

  public getState(): CapitalAccountState {
    this.checkDailyReset();
    return { ...this.state };
  }

  public getSettlementHistory(): CapitalSettlementRecord[] {
    return [...this.settlementHistory];
  }

  public updateInitialCapital(newCapital: number): void {
    const diff = newCapital - this.state.initialCapitalUsd;
    this.state.initialCapitalUsd = newCapital;
    this.state.balanceUsd += diff;
    this.state.availableCapitalUsd = Math.max(0, this.state.balanceUsd - this.state.reservedCapitalUsd - this.state.committedCapitalUsd);
    if (this.state.balanceUsd > this.state.peakBalanceUsd) {
      this.state.peakBalanceUsd = this.state.balanceUsd;
    }
  }

  public getActiveLocks(): PositionLock[] {
    return Array.from(this.activeLocks.values());
  }

  /**
   * Attempt to reserve capital for a candidate opportunity
   */
  public reserveCapital(
    opportunityId: string,
    amountUsd: number,
    lockDurationMs: number = 2000
  ): { success: boolean; lockId?: string; reason?: string } {
    this.checkDailyReset();

    // 1. Concurrency limit check
    if (this.state.activePositionsCount >= this.config.maxConcurrentPositions) {
      this.recordRejection('CONCURRENCY_LIMIT_EXCEEDED');
      return {
        success: false,
        reason: `Max concurrent positions (${this.config.maxConcurrentPositions}) reached`,
      };
    }

    // 2. Position size ceiling check
    if (amountUsd > this.config.maxPositionSizeUsd) {
      this.recordRejection('MAX_POSITION_SIZE_EXCEEDED');
      return {
        success: false,
        reason: `Requested size $${amountUsd.toFixed(2)} exceeds max position ceiling $${this.config.maxPositionSizeUsd.toFixed(2)}`,
      };
    }

    // 3. Daily loss ceiling check
    if (this.state.dailyLossUsd >= this.config.maxDailyLossUsd) {
      this.recordRejection('DAILY_LOSS_LIMIT_REACHED');
      return {
        success: false,
        reason: `Daily loss limit of $${this.config.maxDailyLossUsd.toFixed(2)} reached (Current: $${this.state.dailyLossUsd.toFixed(2)})`,
      };
    }

    // 4. Available capital check
    if (amountUsd > this.state.availableCapitalUsd) {
      this.recordRejection('INSUFFICIENT_AVAILABLE_CAPITAL');
      return {
        success: false,
        reason: `Insufficient available capital. Required: $${amountUsd.toFixed(2)}, Available: $${this.state.availableCapitalUsd.toFixed(2)}`,
      };
    }

    // Allocate reservation
    const lockId = `lock-${opportunityId.slice(0, 12)}-${Date.now()}`;
    const now = Date.now();
    const lock: PositionLock = {
      id: lockId,
      opportunityId,
      amountUsd,
      lockedAt: now,
      lockExpiresAt: now + lockDurationMs,
      status: 'RESERVED',
    };

    this.activeLocks.set(lockId, lock);
    this.state.availableCapitalUsd -= amountUsd;
    this.state.reservedCapitalUsd += amountUsd;
    this.state.activePositionsCount += 1;

    return { success: true, lockId };
  }

  /**
   * Commit a reserved lock to active execution
   */
  public commitCapital(lockId: string): boolean {
    const lock = this.activeLocks.get(lockId);
    if (!lock || lock.status !== 'RESERVED') return false;

    lock.status = 'COMMITTED';
    this.state.reservedCapitalUsd -= lock.amountUsd;
    this.state.committedCapitalUsd += lock.amountUsd;
    return true;
  }

  /**
   * Release a reserved or expired lock without settling P&L
   */
  public releaseCapital(lockId: string): boolean {
    const lock = this.activeLocks.get(lockId);
    if (!lock) return false;

    if (lock.status === 'RESERVED') {
      this.state.reservedCapitalUsd -= lock.amountUsd;
    } else if (lock.status === 'COMMITTED') {
      this.state.committedCapitalUsd -= lock.amountUsd;
    }

    this.state.availableCapitalUsd += lock.amountUsd;
    this.state.activePositionsCount = Math.max(0, this.state.activePositionsCount - 1);
    this.activeLocks.delete(lockId);
    return true;
  }

  /**
   * Settle an executed opportunity trade and update balance & accounting
   */
  public settleTrade(
    lockIdOrParams: string | { lockId?: string; opportunityId?: string; positionSizeUsd?: number; grossProfitUsd?: number; feesPaidUsd?: number; netProfitUsd?: number; reverted?: boolean; status?: 'WON' | 'LOST' | 'REVERTED' },
    grossProfitArg: number = 0,
    feesPaidArg: number = 0,
    revertedArg: boolean = false
  ): CapitalSettlementRecord {
    let lockId: string | undefined;
    let grossProfitUsd = grossProfitArg;
    let feesPaidUsd = feesPaidArg;
    let reverted = revertedArg;
    let oppId: string = 'direct-settlement';

    if (typeof lockIdOrParams === 'object') {
      lockId = lockIdOrParams.lockId;
      oppId = lockIdOrParams.opportunityId || oppId;
      grossProfitUsd = lockIdOrParams.grossProfitUsd ?? 0;
      feesPaidUsd = lockIdOrParams.feesPaidUsd ?? 0;
      reverted = lockIdOrParams.reverted ?? (lockIdOrParams.status === 'REVERTED');
    } else {
      lockId = lockIdOrParams;
    }

    const lock = lockId ? this.activeLocks.get(lockId) : undefined;
    const positionSizeUsd = lock ? lock.amountUsd : (typeof lockIdOrParams === 'object' ? lockIdOrParams.positionSizeUsd || 0 : 0);

    // Release committed/reserved capital back to balance
    if (lock && lockId) {
      if (lock.status === 'COMMITTED') {
        this.state.committedCapitalUsd = Math.max(0, this.state.committedCapitalUsd - lock.amountUsd);
      } else if (lock.status === 'RESERVED') {
        this.state.reservedCapitalUsd = Math.max(0, this.state.reservedCapitalUsd - lock.amountUsd);
      }
      this.activeLocks.delete(lockId);
      this.state.activePositionsCount = Math.max(0, this.state.activePositionsCount - 1);
    }

    const netProfitUsd = grossProfitUsd - feesPaidUsd;
    const status: 'WON' | 'LOST' | 'REVERTED' = reverted
      ? 'REVERTED'
      : (netProfitUsd > 0 ? 'WON' : 'LOST');

    // Update account metrics
    this.state.totalTrades += 1;
    this.state.totalFeesPaidUsd += feesPaidUsd;
    this.state.dailyCostSpentUsd += feesPaidUsd;

    if (status === 'WON') {
      this.state.winningTrades += 1;
    } else if (status === 'REVERTED') {
      this.state.revertedTrades += 1;
      this.state.totalFailedCostsUsd += feesPaidUsd;
      this.state.dailyLossUsd += feesPaidUsd;
    } else {
      this.state.losingTrades += 1;
      this.state.dailyLossUsd += Math.abs(netProfitUsd);
    }

    this.state.realizedPnlUsd += netProfitUsd;
    this.state.balanceUsd += netProfitUsd;
    this.state.availableCapitalUsd = Math.max(0, this.state.balanceUsd - this.state.reservedCapitalUsd - this.state.committedCapitalUsd);

    // Peak and drawdown tracking
    if (this.state.balanceUsd > this.state.peakBalanceUsd) {
      this.state.peakBalanceUsd = this.state.balanceUsd;
    }
    const currentDrawdown = this.state.peakBalanceUsd - this.state.balanceUsd;
    if (currentDrawdown > this.state.maxDrawdownUsd) {
      this.state.maxDrawdownUsd = currentDrawdown;
      this.state.maxDrawdownPercent = (currentDrawdown / this.state.peakBalanceUsd) * 100;
    }

    const record: CapitalSettlementRecord = {
      settlementId: `set-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      opportunityId: lock ? lock.opportunityId : 'direct-settlement',
      timestamp: Date.now(),
      positionSizeUsd,
      grossProfitUsd,
      feesPaidUsd,
      netProfitUsd,
      status,
    };

    this.settlementHistory.unshift(record);
    if (this.settlementHistory.length > 500) this.settlementHistory.pop();

    return record;
  }

  public releaseExpiredLocks(now: number = Date.now()): number {
    let released = 0;
    for (const [lockId, lock] of this.activeLocks.entries()) {
      if (lock.status === 'RESERVED' && lock.lockExpiresAt <= now) {
        this.releaseCapital(lockId);
        released++;
      }
    }
    return released;
  }

  private checkDailyReset(): void {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - this.lastDailyResetTimestamp >= oneDayMs) {
      this.state.dailyCostSpentUsd = 0;
      this.state.dailyLossUsd = 0;
      this.lastDailyResetTimestamp = now;
    }
  }

  private recordRejection(reason: string): void {
    const curr = this.rejections.get(reason) || 0;
    this.rejections.set(reason, curr + 1);
  }

  public getRejectionStats(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const [k, v] of this.rejections.entries()) {
      res[k] = v;
    }
    return res;
  }
}
