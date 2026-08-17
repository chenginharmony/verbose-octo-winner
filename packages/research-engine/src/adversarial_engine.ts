import { OpportunityCandidate } from './opportunity_engine.js';
import { PaperTradingEngine, PaperAccount } from './paper_trader.js';

export interface AdversarialScenarioConfig {
  id: string;
  name: string;
  description: string;
  latencyMs: number;
  edgeHaircutMultiplier: number; // e.g. 0.50 = 50% of gross captured
  revertProbability: number;     // e.g. 0.20 = 20% of txs revert paying gas
  lockDurationMs: number;        // e.g. 2000ms for Base L2 block
}

export interface AdversarialScenarioResult {
  scenario: AdversarialScenarioConfig;
  chainName: string;
  chainId: number;
  initialBalanceUsd: number;
  endingBalanceUsd: number;
  netPnlUsd: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  revertedTrades: number;
  winRate: number;
  maxDrawdownPercent: number;
  totalFeesPaidUsd: number;
  capitalExhaustedCount: number;
  accountState: PaperAccount;
}

export class AdversarialEngine {
  public static readonly STANDARD_SCENARIOS: AdversarialScenarioConfig[] = [
    {
      id: 'A_BASELINE',
      name: 'Scenario A: Perfect Baseline',
      description: 'Zero latency (0ms), 100% theoretical edge, 0% reverts, instant capital reuse',
      latencyMs: 0,
      edgeHaircutMultiplier: 1.0,
      revertProbability: 0.0,
      lockDurationMs: 0,
    },
    {
      id: 'B_EDGE_10MS',
      name: 'Scenario B: Edge Node (+10ms)',
      description: '10ms network latency, 90% edge share, 5% revert risk, standard block lock',
      latencyMs: 10,
      edgeHaircutMultiplier: 0.90,
      revertProbability: 0.05,
      lockDurationMs: 2000,
    },
    {
      id: 'C_RPC_50MS',
      name: 'Scenario C: Regional RPC (+50ms)',
      description: '50ms cloud RPC drift, 75% edge share, 10% revert risk, standard block lock',
      latencyMs: 50,
      edgeHaircutMultiplier: 0.75,
      revertProbability: 0.10,
      lockDurationMs: 2000,
    },
    {
      id: 'D_CONGESTION_100MS',
      name: 'Scenario D: Congestion (+100–200ms)',
      description: '100ms queue delay, 50% edge share, 20% revert risk, standard block lock',
      latencyMs: 100,
      edgeHaircutMultiplier: 0.50,
      revertProbability: 0.20,
      lockDurationMs: 2000,
    },
    {
      id: 'E_HAIRCUT_50PCT',
      name: 'Scenario E: 50% Competition Haircut',
      description: 'Searcher builder bidding war takes 50% of gross margin, 20ms latency, 15% reverts',
      latencyMs: 20,
      edgeHaircutMultiplier: 0.50,
      revertProbability: 0.15,
      lockDurationMs: 2000,
    },
    {
      id: 'F_HAIRCUT_25PCT',
      name: 'Scenario F: 25% Competition Haircut',
      description: 'High-competition environment (builders extract 75% of profit), 25% reverts',
      latencyMs: 20,
      edgeHaircutMultiplier: 0.25,
      revertProbability: 0.25,
      lockDurationMs: 2000,
    },
    {
      id: 'G_HIGH_REVERT',
      name: 'Scenario G: High Revert Penalty (30%)',
      description: 'Frequent dropped/reverted transactions paying gas without revenue, 50% edge',
      latencyMs: 20,
      edgeHaircutMultiplier: 0.50,
      revertProbability: 0.30,
      lockDurationMs: 2000,
    },
    {
      id: 'H_STRICT_CONCURRENCY',
      name: 'Scenario H: Strict Finite Concurrency',
      description: 'Strict asynchronous multi-block capital lock preventing simultaneous double-spend',
      latencyMs: 20,
      edgeHaircutMultiplier: 0.50,
      revertProbability: 0.15,
      lockDurationMs: 2000,
    },
    {
      id: 'I_FULL_REALISM',
      name: 'Scenario I: Full Adversarial Realism',
      description: 'Combined 50ms latency + 25% edge haircut + 25% revert penalty + strict lock',
      latencyMs: 50,
      edgeHaircutMultiplier: 0.25,
      revertProbability: 0.25,
      lockDurationMs: 2000,
    },
  ];

  public runScenario(
    scenario: AdversarialScenarioConfig,
    candidates: OpportunityCandidate[],
    chainName: string,
    chainId: number,
    startingCapitalUsd: number = 10.0
  ): AdversarialScenarioResult {
    const paperTrader = new PaperTradingEngine(startingCapitalUsd, true);
    let simulatedTimeMs = 1700000000000;
    let revertedCount = 0;

    // Adjust lock duration if chain is Arbitrum (250ms vs 2000ms)
    const effectiveLockDuration = chainId === 42161 ? Math.min(scenario.lockDurationMs, 250) : scenario.lockDurationMs;

    for (let i = 0; i < candidates.length; i++) {
      const opp = candidates[i];
      // Advance simulated block time by ~200ms per candidate event
      simulatedTimeMs += 200;

      // Check latency degradation: lookup latency decay tier
      let oppToExecute = opp;
      if (scenario.latencyMs > 0) {
        const decayTier = opp.latencyAdjusted.find(t => t.latencyMs >= scenario.latencyMs);
        if (decayTier && !decayTier.survivesPositive) {
          // Opportunity decayed to zero/negative net profit under latency
          continue;
        }
      }

      // Determine deterministic pseudo-random revert condition
      const hashByte = parseInt(opp.id.slice(-2), 16) || (i * 17) % 100;
      const isRevert = (hashByte / 100) < scenario.revertProbability;

      const result = paperTrader.processOpportunity(oppToExecute, {
        edgeHaircutMultiplier: scenario.edgeHaircutMultiplier,
        lockDurationMs: effectiveLockDuration,
        currentTimeMs: simulatedTimeMs,
        simulateRevert: isRevert,
      });

      if (result.executed && isRevert) {
        revertedCount++;
      }
    }

    // Flush any remaining locked capital at end of simulation
    paperTrader.releaseExpiredLocks(simulatedTimeMs + 10000);

    const account = paperTrader.getAccount();
    const netPnl = account.balanceUsd - account.startingCapitalUsd;
    const pnlPercentage = (netPnl / account.startingCapitalUsd) * 100;
    const maxDrawdownPct = (account.maxDrawdownUsd / (account.peakBalanceUsd || 1)) * 100;
    const rejections = paperTrader.getRejectionStats();
    const capitalExhausted = rejections['INSUFFICIENT_CAPITAL'] || 0;

    return {
      scenario,
      chainName,
      chainId,
      initialBalanceUsd: startingCapitalUsd,
      endingBalanceUsd: account.balanceUsd,
      netPnlUsd: netPnl,
      pnlPercentage,
      totalTrades: account.totalTrades,
      winningTrades: account.winningTrades,
      losingTrades: account.losingTrades,
      revertedTrades: revertedCount,
      winRate: account.totalTrades > 0 ? (account.winningTrades / account.totalTrades) * 100 : 0,
      maxDrawdownPercent: maxDrawdownPct,
      totalFeesPaidUsd: account.totalFeesPaidUsd,
      capitalExhaustedCount: capitalExhausted,
      accountState: account,
    };
  }

  public runAllScenarios(
    candidates: OpportunityCandidate[],
    chainName: string,
    chainId: number,
    startingCapitalUsd: number = 10.0
  ): AdversarialScenarioResult[] {
    return AdversarialEngine.STANDARD_SCENARIOS.map(scenario =>
      this.runScenario(scenario, candidates, chainName, chainId, startingCapitalUsd)
    );
  }
}
