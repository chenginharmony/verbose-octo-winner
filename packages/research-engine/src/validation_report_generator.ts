import { OpportunityDistribution } from './opportunity_engine.js';
import { PaperAccount } from './paper_trader.js';

export interface LatencyDecaySummary {
  latencyMs: number;
  totalNetUsd: number;
  survivalCount: number;
  survivalPercentage: number;
}

export interface BaseMevResearchReportData {
  timeWindow: {
    startBlock: number;
    endBlock: number;
    durationHours: number;
    timestampUtc: string;
  };
  canonicalAudit: {
    passed: boolean;
    totalContracts: number;
    validCount: number;
  };
  simulatorRealityCheck: {
    passed: boolean;
    totalTraces: number;
    meanErrorPercentage: number;
    maxDeltaWei: bigint;
  };
  scanMetrics: {
    swapsObserved: number;
    uniquePools: number;
    uniqueTokens: number;
    candidatesEvaluated: number;
    simulationsExecuted: number;
  };
  distribution: OpportunityDistribution;
  frequency: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  paperAccount: PaperAccount & {
    pnlPercentage: number;
    maxDrawdownPercent: number;
  };
  latencyDecay: LatencyDecaySummary[];
}

export class ValidationReportGenerator {
  public static generateReport(data: BaseMevResearchReportData): string {
    const d = data.distribution;
    const formatUsd = (val: number) => `$${val.toFixed(4)}`;
    const formatPct = (val: number) => `${val.toFixed(2)}%`;

    const total = d.totalEvaluated || 1;
    const negPct = (d.negativeCount / total) * 100;
    const breakPct = (d.breakEvenCount / total) * 100;
    const microPct = (d.microProfitCount / total) * 100;
    const targetPct = (d.targetProfitCount / total) * 100;
    const highPct = (d.highProfitCount / total) * 100;
    const megaPct = (d.megaProfitCount / total) * 100;

    const net01Plus = d.microProfitCount + d.targetProfitCount + d.highProfitCount + d.megaProfitCount;
    const net05Plus = d.targetProfitCount + d.highProfitCount + d.megaProfitCount;
    const net10Plus = d.targetProfitCount + d.highProfitCount + d.megaProfitCount;
    const net20Plus = d.highProfitCount + d.megaProfitCount;
    const net50Plus = d.highProfitCount + d.megaProfitCount;
    const net100Plus = d.megaProfitCount;

    return `
================================================================================
                           BASE MEV RESEARCH REPORT
================================================================================
Period:                   ${data.timeWindow.durationHours} Hours (Blocks ${data.timeWindow.startBlock.toLocaleString()} -> ${data.timeWindow.endBlock.toLocaleString()})
Timestamp:                ${data.timeWindow.timestampUtc}
Canonical Address Audit:  ${data.canonicalAudit.passed ? 'PASSED' : 'FAILED'} (${data.canonicalAudit.validCount}/${data.canonicalAudit.totalContracts} contracts verified)
Simulator Error Delta:    ${data.simulatorRealityCheck.passed ? 'VERIFIED' : 'FAILED'} (Mean ${data.simulatorRealityCheck.meanErrorPercentage.toFixed(5)}% error, max delta ${data.simulatorRealityCheck.maxDeltaWei} wei)
--------------------------------------------------------------------------------

OBSERVATION & SCAN METRICS:
  Swaps Observed:                  ${data.scanMetrics.swapsObserved.toLocaleString()}
  Unique Pools Monitored:          ${data.scanMetrics.uniquePools}
  Unique Tokens Tracked:           ${data.scanMetrics.uniqueTokens}
  Candidate Paths Evaluated:       ${data.scanMetrics.candidatesEvaluated.toLocaleString()}
  Simulations Executed:            ${data.scanMetrics.simulationsExecuted.toLocaleString()}

UNBIASED CANDIDATE DISTRIBUTION (GROSS & NET):
  Total Evaluated:                 ${d.totalEvaluated.toLocaleString()}
  Negative P&L (< $0.00):          ${d.negativeCount.toLocaleString()} (${formatPct(negPct)})
  Break-even ($0.00 - $0.01):      ${d.breakEvenCount.toLocaleString()} (${formatPct(breakPct)})
  Micro-profit ($0.01 - $0.09):    ${d.microProfitCount.toLocaleString()} (${formatPct(microPct)})
  Target ($0.09 - $0.20):          ${d.targetProfitCount.toLocaleString()} (${formatPct(targetPct)})
  High Profit ($0.20 - $1.00):     ${d.highProfitCount.toLocaleString()} (${formatPct(highPct)})
  Mega Profit (>= $1.00):          ${d.megaProfitCount.toLocaleString()} (${formatPct(megaPct)})

THRESHOLD SURVIVAL:
  NET >= $0.01:                    ${net01Plus.toLocaleString()} (${formatPct((net01Plus / total) * 100)})
  NET >= $0.05:                    ${net05Plus.toLocaleString()} (${formatPct((net05Plus / total) * 100)})
  NET >= $0.10:                    ${net10Plus.toLocaleString()} (${formatPct((net10Plus / total) * 100)})
  NET >= $0.20:                    ${net20Plus.toLocaleString()} (${formatPct((net20Plus / total) * 100)})
  NET >= $0.50:                    ${net50Plus.toLocaleString()} (${formatPct((net50Plus / total) * 100)})
  NET >= $1.00:                    ${net100Plus.toLocaleString()} (${formatPct((net100Plus / total) * 100)})

STATISTICAL DISTRIBUTION (POSITIVE CANDIDATES):
  Median Net Profit:               ${formatUsd(d.medianNetUsd)}
  Mean Net Profit:                 ${formatUsd(d.meanNetUsd)}
  P95 Net Profit:                  ${formatUsd(d.p95NetUsd)}
  Max Single Net Profit:           ${formatUsd(d.maxNetUsd)}

FREQUENCY METRICS:
  Avg Opportunities / Minute:      ${data.frequency.perMinute.toFixed(2)}
  Avg Opportunities / Hour:        ${data.frequency.perHour.toFixed(2)}
  Avg Opportunities / Day:         ${data.frequency.perDay.toFixed(2)}

FINITE CAPITAL PAPER TRADING ($10 STARTING BALANCE):
  Starting Account:                ${formatUsd(data.paperAccount.startingCapitalUsd)}
  Ending Account:                  ${formatUsd(data.paperAccount.balanceUsd)}
  Net P&L:                         ${data.paperAccount.realizedNetPnlUsd >= 0 ? '+' : ''}${formatUsd(data.paperAccount.realizedNetPnlUsd)} (${formatPct(data.paperAccount.pnlPercentage)})
  Total Trades Executed:           ${data.paperAccount.totalTrades}
  Win Rate:                        ${formatPct(data.paperAccount.totalTrades > 0 ? (data.paperAccount.winningTrades / data.paperAccount.totalTrades) * 100 : 0)}
  Max Drawdown:                    ${formatPct(data.paperAccount.maxDrawdownPercent)}
  Total Gas & L1 Data Fees:        ${formatUsd(data.paperAccount.totalFeesPaidUsd)}

LATENCY SENSITIVITY & PROFIT DECAY:
${data.latencyDecay.map(tier => `  ${(tier.latencyMs + 'ms').padEnd(8)} ${formatUsd(tier.totalNetUsd).padEnd(12)} (${tier.survivalCount} surviving, ${formatPct(tier.survivalPercentage)})`).join('\n')}
================================================================================
`;
  }
}
