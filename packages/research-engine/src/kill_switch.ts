export interface KillSwitchStatus {
  active: boolean;
  reason?: string;
  trippedAt?: number;
  tripSource?: 'MANUAL_USER' | 'CIRCUIT_BREAKER_STALE_DATA' | 'CIRCUIT_BREAKER_HIGH_LATENCY' | 'CIRCUIT_BREAKER_REVERTS' | 'CIRCUIT_BREAKER_CHAIN_MISMATCH';
}

/**
 * ExecutionKillSwitch
 * Global emergency stop and automated circuit breaker subsystem.
 * When active, no operation may proceed beyond transaction construction.
 */
export class ExecutionKillSwitch {
  private active: boolean = false;
  private reason?: string;
  private trippedAt?: number;
  private tripSource?: KillSwitchStatus['tripSource'];
  private consecutiveReverts: number = 0;
  private maxAllowedConsecutiveReverts: number = 3;

  constructor() {
    // Check environment variable at initialization
    if (process.env.EXECUTION_KILL_SWITCH === 'true') {
      this.trip('Kill switch active via environment variable (EXECUTION_KILL_SWITCH=true)', 'MANUAL_USER');
    }
  }

  public trip(reason: string, source: KillSwitchStatus['tripSource'] = 'MANUAL_USER'): void {
    this.active = true;
    this.reason = reason;
    this.trippedAt = Date.now();
    this.tripSource = source;
  }

  public reset(): void {
    this.active = false;
    this.reason = undefined;
    this.trippedAt = undefined;
    this.tripSource = undefined;
    this.consecutiveReverts = 0;
  }

  public isActive(): boolean {
    return this.active;
  }

  public getStatus(): KillSwitchStatus {
    return {
      active: this.active,
      reason: this.reason,
      trippedAt: this.trippedAt,
      tripSource: this.tripSource,
    };
  }

  public recordRevert(): void {
    this.consecutiveReverts += 1;
    if (this.consecutiveReverts >= this.maxAllowedConsecutiveReverts) {
      this.trip(
        `Automated circuit breaker tripped: ${this.consecutiveReverts} consecutive transaction reverts observed`,
        'CIRCUIT_BREAKER_REVERTS'
      );
    }
  }

  public recordSuccess(): void {
    this.consecutiveReverts = 0;
  }

  /**
   * Validate runtime telemetry against automated circuit breaker conditions
   */
  public evaluateSafetyConditions(conditions: {
    lastDataAgeMs?: number;
    latencyMs?: number;
    chainId?: number;
    expectedChainId?: number;
  }): boolean {
    if (this.active) return false;

    // 1. Stale data feed (> 10000ms)
    if (conditions.lastDataAgeMs !== undefined && conditions.lastDataAgeMs > 10000) {
      this.trip(`Circuit breaker tripped: Stale data feed (${conditions.lastDataAgeMs}ms age)`, 'CIRCUIT_BREAKER_STALE_DATA');
      return false;
    }

    // 2. High latency spike (> 300ms)
    if (conditions.latencyMs !== undefined && conditions.latencyMs > 300) {
      this.trip(`Circuit breaker tripped: Excessive network latency (${conditions.latencyMs}ms)`, 'CIRCUIT_BREAKER_HIGH_LATENCY');
      return false;
    }

    // 3. Chain ID mismatch
    if (
      conditions.chainId !== undefined &&
      conditions.expectedChainId !== undefined &&
      conditions.chainId !== conditions.expectedChainId
    ) {
      this.trip(`Circuit breaker tripped: Chain ID mismatch (Observed: ${conditions.chainId}, Expected: ${conditions.expectedChainId})`, 'CIRCUIT_BREAKER_CHAIN_MISMATCH');
      return false;
    }

    return true;
  }
}
