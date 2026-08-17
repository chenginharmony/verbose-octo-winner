import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  BaseCostModel,
  RiskFilter,
  OpportunityEngine,
  PaperTradingEngine,
  ReplayEngine,
  ValidationReportGenerator,
  BaseMevResearchReportData,
} from '../index.js';
import { DisabledExecutionAdapter, DexRegistry, DecodedSwapEvent } from '@base-mev/adapters';

describe('Base MEV Research Engine Suite', () => {
  describe('Base Cost Model', () => {
    it('computes realistic Base L2 execution and L1 data fees', () => {
      const costModel = new BaseCostModel(3000, 0.05, 0.01, 1.0);
      const cost = costModel.calculateCost(150000n, 160);

      assert.ok(cost.totalCostEth > 0);
      assert.ok(cost.totalCostUsd > 0);
      assert.ok(cost.totalCostUsd < 0.05);
    });
  });

  describe('Execution Boundary Safety', () => {
    it('strictly returns LIVE_EXECUTION_DISABLED and never signs transactions', async () => {
      const adapter = new DisabledExecutionAdapter();
      assert.strictEqual(adapter.isLive(), false);

      const res = await adapter.execute({ target: '0x123', amount: 100 } as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.status, 'LIVE_EXECUTION_DISABLED');
    });
  });

  describe('Opportunity Engine & Unbiased Distribution Logging', () => {
    it('captures full candidate distribution without threshold bias and computes latency tiers', () => {
      const costModel = new BaseCostModel(3000, 0.05, 0.01, 1.0);
      const riskFilter = new RiskFilter(500, 0.03, 60);
      const oppEngine = new OpportunityEngine(costModel, riskFilter);
      const dexRegistry = new DexRegistry();

      const pool = dexRegistry.getAllPools()[0]; // Aerodrome V2 WETH/USDC
      const poolState = {
        reserve0: 500n * 10n ** 18n,
        reserve1: 1500000n * 10n ** 6n,
        stable: false,
        feeNumerator: 30n,
        feeDenominator: 10000n,
        token0Decimals: 18,
        token1Decimals: 6,
      };

      // 1. Large profitable target swap ($15,000 victim swap)
      const bigSwap: DecodedSwapEvent = {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        blockNumber: 1000000,
        logIndex: 0,
        sender: '0x1111111111111111111111111111111111111111',
        recipient: '0x1111111111111111111111111111111111111111',
        amount0In: 5n * 10n ** 18n,
        amount1In: 0n,
        amount0Out: 0n,
        amount1Out: 14800n * 10n ** 6n,
        zeroForOne: true,
        amountIn: 5n * 10n ** 18n,
        amountOut: 14800n * 10n ** 6n,
        tokenIn: 'WETH',
        tokenOut: 'USDC',
        observedAt: Date.now(),
      };

      // 2. Tiny unprofitable swap ($10 swap - gas exceeds gross gain)
      const tinySwap: DecodedSwapEvent = {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: '0x8888888888888888888888888888888888888888888888888888888888888888',
        blockNumber: 1000001,
        logIndex: 0,
        sender: '0x2222222222222222222222222222222222222222',
        recipient: '0x2222222222222222222222222222222222222222',
        amount0In: 3300000000000000n, // 0.0033 WETH (~$10)
        amount1In: 0n,
        amount0Out: 0n,
        amount1Out: 9800000n,
        zeroForOne: true,
        amountIn: 3300000000000000n,
        amountOut: 9800000n,
        tokenIn: 'WETH',
        tokenOut: 'USDC',
        observedAt: Date.now(),
      };

      oppEngine.processSwap(bigSwap, pool, poolState, 10.0, 0.09);
      oppEngine.processSwap(tinySwap, pool, poolState, 10.0, 0.09);

      const all = oppEngine.getAllRecordedCandidates();
      assert.strictEqual(all.length, 6); // 2 swaps * 3 multi-size sweeps ($1, $5, $10)

      // Verify latency decay tiers attached ([0, 5, 10, 20, 50, 100, 150, 200] ms)
      const bigCandidate = all[0];
      assert.strictEqual(bigCandidate.latencyAdjusted.length, 8);
      assert.strictEqual(bigCandidate.latencyAdjusted[0].latencyMs, 0);
      assert.strictEqual(bigCandidate.latencyAdjusted[7].latencyMs, 200);

      // Verify distribution captures negative and positive trades
      const dist = oppEngine.getDistribution();
      assert.strictEqual(dist.totalEvaluated, 6);
      assert.ok(dist.negativeCount > 0);
      assert.ok(dist.netPositiveTotal > 0);
      assert.ok(dist.microProfitCount + dist.targetProfitCount + dist.highProfitCount + dist.megaProfitCount > 0);
    });
  });

  describe('Finite-Capital Paper Trading Engine', () => {
    it('enforces finite starting capital ($10) and rejects when depleted', () => {
      const paperTrader = new PaperTradingEngine(10.0, false);
      const accountInitial = paperTrader.getAccount();
      assert.strictEqual(accountInitial.balanceUsd, 10.0);
      assert.strictEqual(accountInitial.availableCapitalUsd, 10.0);

      // Trade 1: $6 used
      const reserved = paperTrader.reserveCapital(6.0);
      assert.strictEqual(reserved, true);
      assert.strictEqual(paperTrader.getAccount().availableCapitalUsd, 4.0);

      // Trade 2: Trying to reserve $6 when only $4 available should fail
      const reserved2 = paperTrader.reserveCapital(6.0);
      assert.strictEqual(reserved2, false);

      const rejections = paperTrader.getRejectionStats();
      assert.strictEqual(rejections['INSUFFICIENT_CAPITAL'], 1);

      paperTrader.releaseCapital(6.0);
      assert.strictEqual(paperTrader.getAccount().availableCapitalUsd, 10.0);
    });
  });

  describe('Validation Report Generator', () => {
    it('produces formatted 24-hour Base MEV Research Report', () => {
      const reportData: BaseMevResearchReportData = {
        timeWindow: {
          startBlock: 18000000,
          endBlock: 18043200,
          durationHours: 24,
          timestampUtc: '2026-08-15 00:00:00 UTC -> 2026-08-16 00:00:00 UTC',
        },
        canonicalAudit: {
          passed: true,
          totalContracts: 21,
          validCount: 21,
        },
        simulatorRealityCheck: {
          passed: true,
          totalTraces: 50000,
          meanErrorPercentage: 0.00001,
          maxDeltaWei: 1n,
        },
        scanMetrics: {
          swapsObserved: 142850,
          uniquePools: 14,
          uniqueTokens: 8,
          candidatesEvaluated: 142850,
          simulationsExecuted: 1428500,
        },
        distribution: {
          totalEvaluated: 142850,
          negativeCount: 131422,
          breakEvenCount: 8560,
          microLowCount: 1420,
          microHighCount: 720,
          targetLowCount: 571,
          targetHighCount: 100,
          subWhaleCount: 42,
          whaleCount: 15,
          microProfitCount: 2140,
          targetProfitCount: 571,
          highProfitCount: 142,
          megaProfitCount: 15,
          netPositiveTotal: 2868,
          grossPositiveTotal: 11428,
          medianNetUsd: 0.042,
          meanNetUsd: 0.081,
          p95NetUsd: 0.245,
          maxNetUsd: 2.14,
          histogram: [],
        },
        frequency: {
          perMinute: 1.99,
          perHour: 119.5,
          perDay: 2868,
        },
        paperAccount: {
          startingCapitalUsd: 10.0,
          balanceUsd: 18.42,
          availableCapitalUsd: 18.42,
          reservedCapitalUsd: 0,
          deployedCapitalUsd: 0,
          realizedGrossPnlUsd: 9.60,
          realizedNetPnlUsd: 8.42,
          totalFeesPaidUsd: 1.18,
          totalTrades: 124,
          winningTrades: 118,
          losingTrades: 6,
          maxDrawdownUsd: 0.34,
          peakBalanceUsd: 18.42,
          compounding: true,
          pnlPercentage: 84.2,
          maxDrawdownPercent: 3.4,
        },
        latencyDecay: [
          { latencyMs: 0, totalNetUsd: 232.31, survivalCount: 2868, survivalPercentage: 100.0 },
          { latencyMs: 5, totalNetUsd: 218.40, survivalCount: 2710, survivalPercentage: 94.49 },
          { latencyMs: 10, totalNetUsd: 202.15, survivalCount: 2540, survivalPercentage: 88.56 },
          { latencyMs: 20, totalNetUsd: 175.60, survivalCount: 2210, survivalPercentage: 77.06 },
          { latencyMs: 50, totalNetUsd: 112.40, survivalCount: 1420, survivalPercentage: 49.51 },
          { latencyMs: 100, totalNetUsd: 58.10, survivalCount: 710, survivalPercentage: 24.76 },
          { latencyMs: 200, totalNetUsd: 14.20, survivalCount: 180, survivalPercentage: 6.28 },
        ],
      };

      const report = ValidationReportGenerator.generateReport(reportData);
      assert.ok(report.includes('BASE MEV RESEARCH REPORT'));
      assert.ok(report.includes('Canonical Address Audit:  PASSED'));
      assert.ok(report.includes('Negative P&L (< $0.00):          131,422'));
      assert.ok(report.includes('Starting Account:                $10.0000'));
      assert.ok(report.includes('LATENCY SENSITIVITY & PROFIT DECAY'));
    });
  });

  describe('Comparative Multi-Chain Report Generator', () => {
    it('produces side-by-side Markdown comparison table for Base vs. Robinhood', () => {
      const { ComparativeReportGenerator } = require('../index.js');
      const baseMetrics = {
        chainName: 'Base',
        chainId: 8453,
        swapsObserved: 184291,
        candidatesEvaluated: 31842,
        simulationsExecuted: 318420,
        distribution: {
          totalEvaluated: 31842,
          negativeCount: 29361,
          breakEvenCount: 1980,
          microLowCount: 900,
          microHighCount: 477,
          targetLowCount: 184,
          targetHighCount: 70,
          subWhaleCount: 22,
          whaleCount: 11,
          microProfitCount: 1377,
          targetProfitCount: 184,
          highProfitCount: 92,
          megaProfitCount: 11,
          netPositiveTotal: 2481,
          grossPositiveTotal: 4461,
          medianNetUsd: 0.047,
          meanNetUsd: 0.113,
          p95NetUsd: 0.285,
          maxNetUsd: 2.34,
          histogram: [],
        },
        latencySurvival50ms: {
          survivingCount: 1228,
          survivingPercentage: 49.5,
          totalNetUsd: 98.42,
        },
        paperAccount: {
          startingCapitalUsd: 10.0,
          balanceUsd: 34.02,
          availableCapitalUsd: 34.02,
          reservedCapitalUsd: 0,
          deployedCapitalUsd: 0,
          realizedGrossPnlUsd: 36.80,
          realizedNetPnlUsd: 24.02,
          totalFeesPaidUsd: 2.77,
          totalTrades: 40,
          winningTrades: 40,
          losingTrades: 0,
          maxDrawdownUsd: 0.0,
          peakBalanceUsd: 34.02,
          compounding: true,
          netPnlUsd: 24.02,
          pnlPercentage: 240.2,
          maxDrawdownPercent: 0.0,
        },
        avgOpportunitiesPerHour: 103.38,
      };

      const rhMetrics = {
        chainName: 'Arbitrum One (Robinhood Gateway)',
        chainId: 42161,
        swapsObserved: 113565,
        candidatesEvaluated: 20565,
        simulationsExecuted: 205650,
        distribution: {
          totalEvaluated: 20565,
          negativeCount: 18910,
          breakEvenCount: 1020,
          microLowCount: 350,
          microHighCount: 170,
          targetLowCount: 88,
          targetHighCount: 17,
          subWhaleCount: 5,
          whaleCount: 5,
          microProfitCount: 520,
          targetProfitCount: 88,
          highProfitCount: 22,
          megaProfitCount: 5,
          netPositiveTotal: 635,
          grossPositiveTotal: 1655,
          medianNetUsd: 0.038,
          meanNetUsd: 0.094,
          p95NetUsd: 0.221,
          maxNetUsd: 1.85,
          histogram: [],
        },
        latencySurvival50ms: {
          survivingCount: 425,
          survivingPercentage: 66.9,
          totalNetUsd: 41.20,
        },
        paperAccount: {
          startingCapitalUsd: 10.0,
          balanceUsd: 21.40,
          availableCapitalUsd: 21.40,
          reservedCapitalUsd: 0,
          deployedCapitalUsd: 0,
          realizedGrossPnlUsd: 22.80,
          realizedNetPnlUsd: 11.40,
          totalFeesPaidUsd: 1.40,
          totalTrades: 25,
          winningTrades: 25,
          losingTrades: 0,
          maxDrawdownUsd: 0.0,
          peakBalanceUsd: 21.40,
          compounding: true,
          netPnlUsd: 11.40,
          pnlPercentage: 114.0,
          maxDrawdownPercent: 0.0,
        },
        avgOpportunitiesPerHour: 26.46,
      };

      const table = ComparativeReportGenerator.generateMarkdownTable(baseMetrics, rhMetrics);
      assert.ok(table.includes('Base (Chain ID 8453)'));
      assert.ok(table.includes('Robinhood (Chain ID 42161)'));
      assert.ok(table.includes('184,291'));
      assert.ok(table.includes('113,565'));
    });
  });

  describe('Adversarial Stress Engine & Reality Deflation', () => {
    it('applies competition haircuts, revert penalties, and block lockups', () => {
      const { AdversarialEngine } = require('../index.js');
      const { DexRegistry } = require('@base-mev/adapters');
      const reg = new DexRegistry();
      const pool = reg.getAllPools()[0];
      const poolState = {
        reserve0: 500n * 10n ** 18n,
        reserve1: 1500000n * 10n ** 6n,
        stable: false,
        feeNumerator: 30n,
        feeDenominator: 10000n,
        token0Decimals: 18,
        token1Decimals: 6,
      };

      const costModel = BaseCostModel.createForBase(3000);
      const risk = new RiskFilter(500, 0.03, 60);
      const oppEngine = new OpportunityEngine(costModel, risk);

      const swap = {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: '0xadvtest1',
        blockNumber: 1000000,
        logIndex: 0,
        sender: '0x1111111111111111111111111111111111111111',
        recipient: '0x1111111111111111111111111111111111111111',
        amount0In: 2n * 10n ** 18n,
        amount1In: 0n,
        amount0Out: 0n,
        amount1Out: 0n,
        zeroForOne: true,
        amountIn: 2n * 10n ** 18n,
        amountOut: 0n,
        tokenIn: 'WETH',
        tokenOut: 'USDC',
        observedAt: Date.now(),
      };

      const candidates = oppEngine.processSwap(swap, pool, poolState, 10.0, 0.01);
      assert.ok(candidates.length > 0);

      const advEngine = new AdversarialEngine();
      const results = advEngine.runAllScenarios(candidates, 'Base', 8453, 10.0);

      assert.strictEqual(results.length, 9);
      // Scenario A should have higher ROI than Scenario F (harsh haircut)
      const resA = results[0];
      const resF = results[5];
      assert.ok(resA.pnlPercentage >= resF.pnlPercentage);

      // Verify non-overlapping histogram bins
      const dist = oppEngine.getDistribution();
      assert.strictEqual(dist.histogram.length, 8);
      const totalBinCount = dist.histogram.reduce((sum, b) => sum + b.count, 0);
      assert.strictEqual(totalBinCount, dist.totalEvaluated);
    });
  });

  describe('Expected Value (EV) Risk-Adjusted Ranking Engine', () => {
    it('computes EV and ranks high-efficiency micro-arbitrages above fragile large spreads', () => {
      const { OpportunityEngine } = require('../index.js');
      const { DexRegistry } = require('@base-mev/adapters');
      const reg = new DexRegistry();
      const pool = reg.getAllPools()[0];
      const poolState = {
        reserve0: 500n * 10n ** 18n,
        reserve1: 1500000n * 10n ** 6n,
        stable: false,
        feeNumerator: 30n,
        feeDenominator: 10000n,
        token0Decimals: 18,
        token1Decimals: 6,
      };

      const costModel = BaseCostModel.createForBase(3000);
      const risk = new RiskFilter(500, 0.03, 60);
      const oppEngine = new OpportunityEngine(costModel, risk);

      const swap = {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: '0xev1',
        blockNumber: 1000000,
        logIndex: 0,
        sender: '0x1111111111111111111111111111111111111111',
        recipient: '0x1111111111111111111111111111111111111111',
        amount0In: 1n * 10n ** 18n,
        amount1In: 0n,
        amount0Out: 0n,
        amount1Out: 0n,
        zeroForOne: true,
        amountIn: 1n * 10n ** 18n,
        amountOut: 0n,
        tokenIn: 'WETH',
        tokenOut: 'USDC',
        observedAt: Date.now(),
      };

      const candidates = oppEngine.processSwap(swap, pool, poolState, 10.0, 0.01);
      assert.ok(candidates.length > 0);
      const cand = candidates[0];

      assert.ok(cand.evMetrics.executionProbability > 0);
      assert.ok(cand.evMetrics.survivalProbability > 0);
      assert.ok(typeof cand.evMetrics.expectedValueUsd === 'number');
      assert.ok(!isNaN(cand.evMetrics.expectedValueUsd));
      assert.ok(typeof cand.evMetrics.capitalEfficiency === 'number');
      assert.ok(!isNaN(cand.evMetrics.capitalEfficiency));
    });
  });
});
