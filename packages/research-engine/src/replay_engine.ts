import { EventEmitter } from 'node:events';
import { DecodedSwapEvent, DexPoolIdentity } from '@base-mev/adapters';
import { OpportunityEngine, OpportunityCandidate } from './opportunity_engine.js';
import { PaperTradingEngine } from './paper_trader.js';

export interface ReplayExperimentResult {
  artificialLatencyMs: number;
  totalCandidates: number;
  survivingOpportunities: number;
  totalNetPnlUsd: number;
  winRate: number;
  averageNetProfitUsd: number;
  medianNetProfitUsd: number;
}

export class ReplayEngine extends EventEmitter {
  private opportunityEngine: OpportunityEngine;
  private isReplaying: boolean = false;

  constructor(opportunityEngine: OpportunityEngine) {
    super();
    this.opportunityEngine = opportunityEngine;
  }

  public async runLatencyExperiment(
    historicalSwaps: { swap: DecodedSwapEvent; pool: DexPoolIdentity; poolState: any }[],
    latencyPointsMs: number[] = [0, 5, 10, 20, 50, 100, 150, 200],
    startingCapitalUsd: number = 10.0
  ): Promise<ReplayExperimentResult[]> {
    const results: ReplayExperimentResult[] = [];

    for (const latency of latencyPointsMs) {
      const paperTrader = new PaperTradingEngine(startingCapitalUsd, false);
      let candidatesCount = 0;
      let netProfits: number[] = [];

      for (const item of historicalSwaps) {
        const candidates = this.opportunityEngine.processSwap(
          item.swap,
          item.pool,
          item.poolState,
          paperTrader.getAccount().availableCapitalUsd
        );

        for (const candidate of candidates) {
          candidatesCount++;
          // Simulate latency decay: if artificial latency > 20ms, small meme opportunities decay
          const decayFactor = Math.max(0, 1 - (latency / 100));
          const adjustedNet = candidate.bestPosition.netProfitUsd * decayFactor;

          if (adjustedNet >= 0.09) {
            candidate.bestPosition.netProfitUsd = adjustedNet;
            const res = paperTrader.processOpportunity(candidate);
            if (res.executed) {
              netProfits.push(adjustedNet);
            }
          }
        }
      }

      const account = paperTrader.getAccount();
      netProfits.sort((a, b) => a - b);
      const medianNet = netProfits.length > 0 ? netProfits[Math.floor(netProfits.length / 2)] : 0;
      const avgNet = netProfits.length > 0 ? netProfits.reduce((a, b) => a + b, 0) / netProfits.length : 0;
      const winRate = account.totalTrades > 0 ? account.winningTrades / account.totalTrades : 0;

      results.push({
        artificialLatencyMs: latency,
        totalCandidates: candidatesCount,
        survivingOpportunities: account.winningTrades,
        totalNetPnlUsd: account.realizedNetPnlUsd,
        winRate,
        averageNetProfitUsd: avgNet,
        medianNetProfitUsd: medianNet,
      });
    }

    return results;
  }
}
