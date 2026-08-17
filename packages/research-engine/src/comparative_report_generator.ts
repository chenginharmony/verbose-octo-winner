import { OpportunityDistribution } from './opportunity_engine.js';
import { PaperAccount } from './paper_trader.js';

export interface ChainReplayMetrics {
  chainName: string;
  chainId: number;
  swapsObserved: number;
  candidatesEvaluated: number;
  simulationsExecuted: number;
  distribution: OpportunityDistribution;
  latencySurvival50ms: {
    survivingCount: number;
    survivingPercentage: number;
    totalNetUsd: number;
  };
  paperAccount: PaperAccount & {
    netPnlUsd: number;
    pnlPercentage: number;
    maxDrawdownPercent: number;
  };
  avgOpportunitiesPerHour: number;
}

export class ComparativeReportGenerator {
  public static generateMarkdownTable(base: ChainReplayMetrics, robinhood: ChainReplayMetrics): string {
    const formatUsd = (val: number) => `$${val.toFixed(4)}`;
    const formatPct = (val: number) => `${val.toFixed(2)}%`;

    const bDist = base.distribution;
    const rDist = robinhood.distribution;

    const bNet01 = bDist.microProfitCount + bDist.targetProfitCount + bDist.highProfitCount + bDist.megaProfitCount;
    const rNet01 = rDist.microProfitCount + rDist.targetProfitCount + rDist.highProfitCount + rDist.megaProfitCount;

    const bNet05 = bDist.targetProfitCount + bDist.highProfitCount + bDist.megaProfitCount;
    const rNet05 = rDist.targetProfitCount + rDist.highProfitCount + rDist.megaProfitCount;

    const bNet10 = bDist.targetProfitCount + bDist.highProfitCount + bDist.megaProfitCount;
    const rNet10 = rDist.targetProfitCount + rDist.highProfitCount + rDist.megaProfitCount;

    const bNet20 = bDist.highProfitCount + bDist.megaProfitCount;
    const rNet20 = rDist.highProfitCount + rDist.megaProfitCount;

    const bNet100 = bDist.megaProfitCount;
    const rNet100 = rDist.megaProfitCount;

    return `
# Multi-Chain MEV Research: Base vs. Robinhood Comparative Report

| Metric | Base (Chain ID ${base.chainId}) | Robinhood (Chain ID ${robinhood.chainId}) |
| :--- | ---: | ---: |
| **Swaps Observed / Day** | ${base.swapsObserved.toLocaleString()} | ${robinhood.swapsObserved.toLocaleString()} |
| **Candidate Opportunities Evaluated** | ${base.candidatesEvaluated.toLocaleString()} | ${robinhood.candidatesEvaluated.toLocaleString()} |
| **Simulations Executed** | ${base.simulationsExecuted.toLocaleString()} | ${robinhood.simulationsExecuted.toLocaleString()} |
| **Net-Positive Opportunities** | ${bDist.netPositiveTotal.toLocaleString()} (${formatPct((bDist.netPositiveTotal / (base.candidatesEvaluated || 1)) * 100)}) | ${rDist.netPositiveTotal.toLocaleString()} (${formatPct((rDist.netPositiveTotal / (robinhood.candidatesEvaluated || 1)) * 100)}) |
| **NET >= $0.01** | ${bNet01.toLocaleString()} | ${rNet01.toLocaleString()} |
| **NET >= $0.05** | ${bNet05.toLocaleString()} | ${rNet05.toLocaleString()} |
| **NET >= $0.10** | ${bNet10.toLocaleString()} | ${rNet10.toLocaleString()} |
| **NET >= $0.20** | ${bNet20.toLocaleString()} | ${rNet20.toLocaleString()} |
| **NET >= $1.00** | ${bNet100.toLocaleString()} | ${rNet100.toLocaleString()} |
| **Median NET Profit** | ${formatUsd(bDist.medianNetUsd)} | ${formatUsd(rDist.medianNetUsd)} |
| **Mean NET Profit** | ${formatUsd(bDist.meanNetUsd)} | ${formatUsd(rDist.meanNetUsd)} |
| **Avg Opportunities / Hour** | ${base.avgOpportunitiesPerHour.toFixed(2)} | ${robinhood.avgOpportunitiesPerHour.toFixed(2)} |
| **50ms Latency Survival** | ${base.latencySurvival50ms.survivingCount.toLocaleString()} (${formatPct(base.latencySurvival50ms.survivingPercentage)}) | ${robinhood.latencySurvival50ms.survivingCount.toLocaleString()} (${formatPct(robinhood.latencySurvival50ms.survivingPercentage)}) |
| **$10 Paper Account Ending Balance** | ${formatUsd(base.paperAccount.balanceUsd)} | ${formatUsd(robinhood.paperAccount.balanceUsd)} |
| **$10 Paper Account Net P&L** | ${base.paperAccount.netPnlUsd >= 0 ? '+' : ''}${formatUsd(base.paperAccount.netPnlUsd)} (${formatPct(base.paperAccount.pnlPercentage)}) | ${robinhood.paperAccount.netPnlUsd >= 0 ? '+' : ''}${formatUsd(robinhood.paperAccount.netPnlUsd)} (${formatPct(robinhood.paperAccount.pnlPercentage)}) |
| **Paper Account Max Drawdown** | ${formatPct(base.paperAccount.maxDrawdownPercent)} | ${formatPct(robinhood.paperAccount.maxDrawdownPercent)} |
| **Paper Trades Executed** | ${base.paperAccount.totalTrades} | ${robinhood.paperAccount.totalTrades} |
`;
  }
}
