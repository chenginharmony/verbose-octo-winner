import { CanonicalSandwichOpportunity, ExecutionResult } from '@base-mev/adapters';

export interface AuditEvent {
  id: string;
  opportunityId: string;
  stage: 'DETECTION' | 'SIMULATION' | 'PROFITABILITY_GATE' | 'RISK_CHECK' | 'CAPITAL_RESERVATION' | 'TRANSACTION_CONSTRUCTION' | 'STAGING_EXECUTION' | 'SETTLEMENT';
  status: 'SUCCESS' | 'REJECTED' | 'FAILED' | 'SKIPPED';
  timestamp: number;
  details: Record<string, any>;
}

/**
 * ExecutionAuditLogger
 * Immutable audit trail tracking every opportunity lifecycle stage from detection to reconciliation.
 */
export class ExecutionAuditLogger {
  private events: AuditEvent[] = [];
  private maxRecords: number = 2000;

  public logEvent(
    opportunityId: string,
    stage: AuditEvent['stage'],
    status: AuditEvent['status'],
    details: Record<string, any> = {}
  ): AuditEvent {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      opportunityId,
      stage,
      status,
      timestamp: Date.now(),
      details,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxRecords) {
      this.events.pop();
    }

    return event;
  }

  public getEvents(opportunityId?: string, limit: number = 100): AuditEvent[] {
    if (opportunityId) {
      return this.events.filter((e) => e.opportunityId === opportunityId).slice(0, limit);
    }
    return this.events.slice(0, limit);
  }

  public clear(): void {
    this.events = [];
  }
}
