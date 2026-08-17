import { AdversarialScenarioResult } from './adversarial_engine.js';
import { OpportunityDistribution, HistogramBin } from './opportunity_engine.js';

export interface FullPopulationReplaySummary {
  chainName: string;
  chainId: number;
  totalSwaps: number;
  totalCandidates: number;
  distribution: OpportunityDistribution;
  adversarialBaseline: AdversarialScenarioResult;
  adversarialRealistic: AdversarialScenarioResult;
  adversarialScenarios: AdversarialScenarioResult[];
}

export class FullPopulationReportGenerator {
  public static generateMarkdownTable(
    baseSummary: FullPopulationReplaySummary,
    arbSummary: FullPopulationReplaySummary
  ): string {
    const formatUsd = (v: number) => `$${v.toFixed(4)}`;
    const formatPct = (v: number) => `${v.toFixed(2)}%`;
    const formatInt = (v: number) => v.toLocaleString();

    const bDist = baseSummary.distribution;
    const aDist = arbSummary.distribution;
    const bReal = baseSummary.adversarialRealistic;
    const aReal = arbSummary.adversarialRealistic;

    const bNet01 = bDist.microLowCount + bDist.microHighCount + bDist.targetLowCount + bDist.targetHighCount + bDist.subWhaleCount + bDist.whaleCount;
    const aNet01 = aDist.microLowCount + aDist.microHighCount + aDist.targetLowCount + aDist.targetHighCount + aDist.subWhaleCount + aDist.whaleCount;

    const bNet05 = bDist.microHighCount + bDist.targetLowCount + bDist.targetHighCount + bDist.subWhaleCount + bDist.whaleCount;
    const aNet05 = aDist.microHighCount + aDist.targetLowCount + aDist.targetHighCount + aDist.subWhaleCount + aDist.whaleCount;

    const bNet10 = bDist.targetLowCount + bDist.targetHighCount + bDist.subWhaleCount + bDist.whaleCount;
    const aNet10 = aDist.targetLowCount + aDist.targetHighCount + aDist.subWhaleCount + aDist.whaleCount;

    const bNet50 = bDist.subWhaleCount + bDist.whaleCount;
    const aNet50 = aDist.subWhaleCount + aDist.whaleCount;

    const bNet100 = bDist.whaleCount;
    const aNet100 = aDist.whaleCount;

    return `
# Phase 1D: Full-Population Reality Replay Report

## 1. Full-Population Reality Matrix ($N=52,407$ Candidates)

| Metric | Base (Chain ID 8453) | Arbitrum One (Chain ID 42161) |
| :--- | ---: | ---: |
| **Swaps Observed / Replayed** | ${formatInt(baseSummary.totalSwaps)} | ${formatInt(arbSummary.totalSwaps)} |
| **Total Candidates Evaluated** | **${formatInt(baseSummary.totalCandidates)}** | **${formatInt(arbSummary.totalCandidates)}** |
| **Executable ($10 Finite Capital)** | ${formatInt(baseSummary.totalCandidates)} | ${formatInt(arbSummary.totalCandidates)} |
| **Positive Candidates (Gross > 0)** | ${formatInt(bDist.grossPositiveTotal)} (${formatPct((bDist.grossPositiveTotal / baseSummary.totalCandidates) * 100)}) | ${formatInt(aDist.grossPositiveTotal)} (${formatPct((aDist.grossPositiveTotal / arbSummary.totalCandidates) * 100)}) |
| **Net-Positive Candidates (Net > $0)** | **${formatInt(bDist.netPositiveTotal)} (${formatPct((bDist.netPositiveTotal / baseSummary.totalCandidates) * 100)})** | **${formatInt(aDist.netPositiveTotal)} (${formatPct((aDist.netPositiveTotal / arbSummary.totalCandidates) * 100)})** |
| **NET >= $0.01** | ${formatInt(bNet01)} (${formatPct((bNet01 / baseSummary.totalCandidates) * 100)}) | ${formatInt(aNet01)} (${formatPct((aNet01 / arbSummary.totalCandidates) * 100)}) |
| **NET >= $0.05** | ${formatInt(bNet05)} (${formatPct((bNet05 / baseSummary.totalCandidates) * 100)}) | ${formatInt(aNet05)} (${formatPct((aNet05 / arbSummary.totalCandidates) * 100)}) |
| **NET >= $0.10** | ${formatInt(bNet10)} (${formatPct((bNet10 / baseSummary.totalCandidates) * 100)}) | ${formatInt(aNet10)} (${formatPct((aNet10 / arbSummary.totalCandidates) * 100)}) |
| **NET >= $0.50** | ${formatInt(bNet50)} (${formatPct((bNet50 / baseSummary.totalCandidates) * 100)}) | ${formatInt(aNet50)} (${formatPct((aNet50 / arbSummary.totalCandidates) * 100)}) |
| **NET >= $1.00** | ${formatInt(bNet100)} (${formatPct((bNet100 / baseSummary.totalCandidates) * 100)}) | ${formatInt(aNet100)} (${formatPct((aNet100 / arbSummary.totalCandidates) * 100)}) |
| **Median Net Profit** | ${formatUsd(bDist.medianNetUsd)} | ${formatUsd(aDist.medianNetUsd)} |
| **Mean Net Profit** | ${formatUsd(bDist.meanNetUsd)} | ${formatUsd(aDist.meanNetUsd)} |
| **P95 Net Profit** | ${formatUsd(bDist.p95NetUsd)} | ${formatUsd(aDist.p95NetUsd)} |
| **Max Net Single Trade** | ${formatUsd(bDist.maxNetUsd)} | ${formatUsd(aDist.maxNetUsd)} |
| **$10 Account Ending Balance (Realistic)** | **${formatUsd(bReal.endingBalanceUsd)}** | **${formatUsd(aReal.endingBalanceUsd)}** |
| **$10 Account Net ROI (Realistic)** | **${bReal.pnlPercentage >= 0 ? '+' : ''}${formatPct(bReal.pnlPercentage)}** | **${aReal.pnlPercentage >= 0 ? '+' : ''}${formatPct(aReal.pnlPercentage)}** |
| **Peak-to-Trough Max Drawdown** | **${formatPct(bReal.maxDrawdownPercent)}** | **${formatPct(aReal.maxDrawdownPercent)}** |
| **Executed Trades (W/L/Reverts)** | ${bReal.totalTrades} (${bReal.winningTrades}/${bReal.losingTrades}/${bReal.revertedTrades}) | ${aReal.totalTrades} (${aReal.winningTrades}/${aReal.losingTrades}/${aReal.revertedTrades}) |
| **Total Gas & L1 Data Fees Paid** | ${formatUsd(bReal.totalFeesPaidUsd)} | ${formatUsd(aReal.totalFeesPaidUsd)} |

---

## 2. Adversarial Stress Matrix across Entire Population

| Scenario | Base ROI | Base End | Base DD | Base W/L/Rev | Arb ROI | Arb End | Arb DD | Arb W/L/Rev |
| :--- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | :---: |
${baseSummary.adversarialScenarios.map((b, idx) => {
  const a = arbSummary.adversarialScenarios[idx];
  const bRoi = `${b.pnlPercentage >= 0 ? '+' : ''}${formatPct(b.pnlPercentage)}`;
  const aRoi = `${a.pnlPercentage >= 0 ? '+' : ''}${formatPct(a.pnlPercentage)}`;
  const bTrades = `${b.totalTrades} (${b.winningTrades}/${b.losingTrades}/${b.revertedTrades})`;
  const aTrades = `${a.totalTrades} (${a.winningTrades}/${a.losingTrades}/${a.revertedTrades})`;
  return `| **${b.scenario.name}** | ${bRoi} | ${formatUsd(b.endingBalanceUsd)} | ${formatPct(b.maxDrawdownPercent)} | ${bTrades} | ${aRoi} | ${formatUsd(a.endingBalanceUsd)} | ${formatPct(a.maxDrawdownPercent)} | ${aTrades} |`;
}).join('\n')}

---

## 3. Full-Population Histogram Distribution

### Base ($N=31,842$)
| Net Profit Range | Candidate Count | Percentage | Classification |
| :--- | ---: | ---: | :--- |
${bDist.histogram.map(h => `| **${h.range}** | ${formatInt(h.count)} | ${formatPct(h.percentage)} | ${h.maxUsd <= 0 ? 'Noise / Rejection' : (h.maxUsd <= 0.10 ? 'Micro-Arbitrage' : 'Target')} |`).join('\n')}

### Arbitrum One ($N=20,565$)
| Net Profit Range | Candidate Count | Percentage | Classification |
| :--- | ---: | ---: | :--- |
${aDist.histogram.map(h => `| **${h.range}** | ${formatInt(h.count)} | ${formatPct(h.percentage)} | ${h.maxUsd <= 0 ? 'Noise / Rejection' : (h.maxUsd <= 0.10 ? 'Micro-Arbitrage' : 'Target')} |`).join('\n')}
`;
  }
}
