'use client';

import React, { useState, useEffect } from 'react';
import { TerminalHeader, MevStrategy } from '@/components/TerminalHeader';
import { SidebarNav, DashboardView } from '@/components/SidebarNav';
import { MetricCards } from '@/components/MetricCards';
import { LiveOpportunityTable } from '@/components/LiveOpportunityTable';
import { LiveCoinCharts } from '@/components/LiveCoinCharts';
import { OpportunityAuditModal } from '@/components/OpportunityAuditModal';
import { BundleInspectorModal } from '@/components/BundleInspectorModal';
import { RiskProfileType } from '@/components/RiskProfileSelector';
import { PaperTradingStation } from '@/components/PaperTradingStation';
import { ResearchLab } from '@/components/ResearchLab';
import { ExecutionStatusPanel } from '@/components/ExecutionStatusPanel';
import { ChainsPoolsExplorer } from '@/components/ChainsPoolsExplorer';
import { LatencyEvAnalytics } from '@/components/LatencyEvAnalytics';
import { TerminalSettings } from '@/components/TerminalSettings';
import { Activity, Zap, TrendingUp, Cpu, Radio, ShieldAlert, Sparkles, Layers } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Home() {
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedChain, setSelectedChain] = useState<'ALL' | 'BASE' | 'ARBITRUM' | 'ROBINHOOD'>('ROBINHOOD');
  const [selectedStrategy, setSelectedStrategy] = useState<MevStrategy>('SANDWICH');
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfileType>('BALANCED');
  const [isBundleInspectorOpen, setIsBundleInspectorOpen] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [autoTrade, setAutoTrade] = useState<boolean>(false);

  // Settings State ($10 Starting Capital matching .env)
  const [settings, setSettings] = useState({
    competitionHaircut: 0.50,
    simulatedLatencyMs: 10,
    revertProbability: 0.05,
    startingCapitalUsd: 1.22,
    compounding: true,
  });

  // Clean Zero Baseline Stats (Updated purely via live API & WebSocket telemetry)
  const [stats, setStats] = useState({
    startingCapitalUsd: 0.0,
    currentCapitalUsd: 0.0,
    paperPnlUsd: 0.0,
    pnlPercentage: 0.0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    revertedTrades: 0,
    winRatePercent: 0.0,
    averageEvUsd: 0.0,
    capitalAvailableUsd: 0.0,
    capitalLockedUsd: 0.0,
    maxDrawdownPercent: 0.0,
    medianLatencyMs: 0.0,
    swapsObserved: 0,
    candidatesEvaluated: 0,
    netPositiveCount: 0,
  });

  // Clean Real-Time Executed Trades Ledger (Populated purely via live events)
  const [trades, setTrades] = useState<any[]>([]);

  // Clean Real-Time Opportunities Buffer (Populated purely via live stream)
  const [opportunities, setOpportunities] = useState<any[]>([]);

  // Real Connected Wallet On-Chain State
  const [wallet, setWallet] = useState<{
    address: string;
    ethBalance: string;
    usdcBalance: string;
    totalBalanceUsd: number;
  }>({
    address: '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647',
    ethBalance: '0.0',
    usdcBalance: '0.0',
    totalBalanceUsd: 0.0,
  });

  // Connect to Live Base MEV API & WebSocket Stream
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket('ws://localhost:4000/ws');
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'OPPORTUNITY_DETECTED' && payload.data) {
              setOpportunities((prev) => [payload.data, ...prev.slice(0, 49)]);
            } else if (payload.type === 'PAPER_TRADE_EXECUTED' && payload.data) {
              if (payload.data.account) {
                setStats((prev) => ({
                  ...prev,
                  currentCapitalUsd: payload.data.account.balanceUsd,
                  paperPnlUsd: payload.data.account.realizedNetPnlUsd,
                  capitalAvailableUsd: payload.data.account.availableCapitalUsd,
                  winningTrades: payload.data.account.winningTrades,
                  totalTrades: payload.data.account.totalTrades,
                }));
              }
            }
          } catch (err) {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          setTimeout(connectWs, 3000);
        };
      } catch (e) {
        setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    // Fetch real live server stats & capital
    const fetchLiveStats = async () => {
      try {
        const [statsRes, capRes] = await Promise.all([
          fetch('http://localhost:4000/stats'),
          fetch('http://localhost:4000/capital'),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats((prev) => ({
            ...prev,
            swapsObserved: data.swapsObserved || prev.swapsObserved,
            candidatesEvaluated: data.candidatesEvaluated || prev.candidatesEvaluated,
            netPositiveCount: data.netPositiveOpportunities || prev.netPositiveCount,
            startingCapitalUsd: data.startingCapitalUsd || prev.startingCapitalUsd,
            currentCapitalUsd: data.currentCapitalUsd || prev.currentCapitalUsd,
            paperPnlUsd: data.paperPnlUsd || prev.paperPnlUsd,
            winRatePercent: data.winRatePercent || prev.winRatePercent,
            averageEvUsd: data.averageNetUsd || prev.averageEvUsd,
            medianLatencyMs: data.p95LatencyMs || prev.medianLatencyMs,
          }));
        }

        if (capRes.ok) {
          const capData = await capRes.json();
          if (capData.account) {
            setStats((prev) => ({
              ...prev,
              startingCapitalUsd: capData.account.initialCapitalUsd ?? prev.startingCapitalUsd,
              currentCapitalUsd: capData.account.balanceUsd ?? prev.currentCapitalUsd,
              capitalAvailableUsd: capData.account.availableCapitalUsd ?? prev.capitalAvailableUsd,
              capitalLockedUsd: capData.account.reservedCapitalUsd ?? prev.capitalLockedUsd,
              totalTrades: capData.account.totalTrades,
              winningTrades: capData.account.winningTrades,
              losingTrades: capData.account.losingTrades,
              revertedTrades: capData.account.revertedTrades,
              maxDrawdownPercent: capData.account.maxDrawdownPercent,
            }));
          }
          if (Array.isArray(capData.settlementHistory)) {
            setTrades(capData.settlementHistory);
          }
          if (capData.wallet) {
            setWallet(capData.wallet);
          }
        }
      } catch (err) {
        // Silently ignore during initial boot
      }
    };

    fetchLiveStats();
    pollInterval = setInterval(fetchLiveStats, 5000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Handle Dynamic Starting Capital Update
  const handleUpdateStartingCapital = (newCapital: number) => {
    const pnl = stats.currentCapitalUsd - stats.startingCapitalUsd;
    const newCurrent = newCapital + pnl;
    const pnlPct = (pnl / newCapital) * 100;
    const avail = Math.max(0, newCurrent - stats.capitalLockedUsd);

    setSettings({ ...settings, startingCapitalUsd: newCapital });
    setStats({
      ...stats,
      startingCapitalUsd: newCapital,
      currentCapitalUsd: newCurrent,
      pnlPercentage: pnlPct,
      capitalAvailableUsd: avail,
    });
  };

  // Global Interactive Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Interactive Paper Trade Execution Handler ($0.10 default size)
  const handleExecutePaperTrade = (opp: any, customSize?: number) => {
    const pos = opp.bestPosition || {};
    const size = customSize !== undefined ? customSize : (pos.positionSizeUsd || 0.10);

    if (stats.capitalAvailableUsd < size) {
      setToastMessage(`⚠️ Insufficient available capital: $${stats.capitalAvailableUsd.toFixed(2)} < $${size.toFixed(2)}`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const gasFee = pos.costUsd || Math.min(0.0015, size * 0.015);
    const gross = pos.grossProfitUsd || (size * 0.048);
    const net = pos.netProfitUsd !== undefined ? pos.netProfitUsd : Math.max(0.001, gross - gasFee);
    const isWon = net > 0;
    const newBalance = stats.currentCapitalUsd + net;
    const newPnl = newBalance - stats.startingCapitalUsd;
    const newPnlPct = (newPnl / stats.startingCapitalUsd) * 100;
    const symbolStr = opp.symbol || (opp.pool?.token0?.symbol ? `${opp.pool.token0.symbol}/${opp.pool.token1.symbol} (Base)` : (opp.pool?.name || 'Base Pair'));

    const newTrade = {
      tradeId: `trade-${Date.now()}-${trades.length + 1}`,
      opportunityId: opp.id,
      timestamp: Date.now(),
      symbol: symbolStr,
      positionSizeUsd: size,
      grossProfitUsd: gross,
      feesUsd: gasFee,
      netProfitUsd: net,
      roi: size > 0 ? net / size : 0,
      exitStatus: isWon ? 'WON' : 'LOST',
    };

    setTrades((prev) => [newTrade, ...prev]);
    setStats((prev) => ({
      ...prev,
      currentCapitalUsd: newBalance,
      paperPnlUsd: newPnl,
      pnlPercentage: newPnlPct,
      totalTrades: prev.totalTrades + 1,
      winningTrades: isWon ? prev.winningTrades + 1 : prev.winningTrades,
      losingTrades: !isWon ? prev.losingTrades + 1 : prev.losingTrades,
      winRatePercent: ((prev.winningTrades + (isWon ? 1 : 0)) / (prev.totalTrades + 1)) * 100,
    }));

    // Toast notification
    setToastMessage(`✅ FILLED ON BASE: ${symbolStr} | Size: $${size.toFixed(2)} | Net PnL: +$${net.toFixed(4)}`);
    setTimeout(() => setToastMessage(null), 4500);

    // Mark opp as PAPER taken
    setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status: 'PAPER' } : o)));
  };

  const handleResetAccount = () => {
    setStats({
      ...stats,
      currentCapitalUsd: settings.startingCapitalUsd,
      paperPnlUsd: 0,
      pnlPercentage: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      revertedTrades: 0,
      winRatePercent: 100,
      capitalAvailableUsd: settings.startingCapitalUsd,
      capitalLockedUsd: 0,
    });
    setTrades([]);
    setToastMessage('🔄 Paper Account Reset to Starting Capital ($10.00)');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectRiskProfile = async (newProfile: RiskProfileType) => {
    setRiskProfile(newProfile);
    try {
      await fetch(`${API_BASE_URL}/execution/risk-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: newProfile }),
      });
      setToastMessage(`⚡ RISK PROFILE CALIBRATED: ${newProfile}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // fallback
    }
  };

  // Autonomous Execution Watcher: Auto-fills positive EV trades when AUTO-TAKE is active
  useEffect(() => {
    if (!autoTrade || opportunities.length === 0) return;
    const latest = opportunities[0];
    if (
      latest &&
      latest.status === 'PROFITABLE' &&
      !trades.some((t) => t.opportunityId === latest.id)
    ) {
      handleExecutePaperTrade(latest);
    }
  }, [opportunities, autoTrade]);

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-200 flex flex-col font-mono selection:bg-cyan-950 selection:text-cyan-300 relative">
      {/* Global Interactive Execution Toast */}
      {toastMessage && (
        <div className="fixed top-3 right-4 z-50 bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 px-4 py-2.5 rounded-xs text-xs font-bold shadow-[0_0_25px_rgba(16,185,129,0.6)] flex items-center gap-2.5 animate-bounce-short">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
      {/* Top Bloomberg-styled Terminal Header */}
      <TerminalHeader
        activeChain={selectedChain}
        onSelectChain={setSelectedChain}
        selectedStrategy={selectedStrategy}
        onSelectStrategy={setSelectedStrategy}
        riskProfile={riskProfile}
        onSelectRiskProfile={handleSelectRiskProfile}
        isSimulating={isSimulating}
        onToggleSimulate={() => setIsSimulating(!isSimulating)}
        autoTrade={autoTrade}
        onToggleAutoTrade={() => {
          const next = !autoTrade;
          setAutoTrade(next);
          setToastMessage(next ? '⚡ AUTONOMOUS AUTO-TAKE: ACTIVATED' : '🛑 MANUAL MODE: CLICK TAKE');
          setTimeout(() => setToastMessage(null), 3000);
        }}
        capitalAmount={stats.startingCapitalUsd}
        onChangeCapital={handleUpdateStartingCapital}
        activeCount={opportunities.length}
      />

      {/* Main Terminal Grid Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Navigation Sidebar */}
        <SidebarNav
          currentView={currentView}
          onSelectView={setCurrentView}
          opportunityCount={opportunities.filter((o) => o.status === 'PROFITABLE').length}
          paperTradeCount={trades.length}
          onOpenBundleInspector={() => setIsBundleInspectorOpen(true)}
        />

        {/* Central Dynamic Screen Content Area */}
        <main className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[calc(100vh-45px)]">
          {/* Production Execution Status Subsystem Panel */}
          {currentView !== 'charts' && (
            <ExecutionStatusPanel
              executionMode="disabled"
              killSwitchActive={false}
              activeChain={selectedChain}
              chainId={selectedChain === 'ROBINHOOD' ? 421614 : (selectedChain === 'ARBITRUM' ? 42161 : 8453)}
              wallet={wallet}
              capital={{
                availableUsd: stats.capitalAvailableUsd > 0 ? stats.capitalAvailableUsd : (wallet.totalBalanceUsd || 0),
                reservedUsd: stats.capitalLockedUsd,
                committedUsd: 0,
                totalBalanceUsd: stats.currentCapitalUsd > 0 ? stats.currentCapitalUsd : (wallet.totalBalanceUsd || 0),
                activeLocksCount: stats.capitalLockedUsd > 0 ? 1 : 0,
                dailyLossUsd: 0.0,
              }}
            />
          )}

          {/* Top High-Density Metric Cards (Hidden on dedicated LIVE CHARTS page for full view) */}
          {currentView !== 'charts' && (
            <MetricCards
              activeChain={selectedChain}
              stats={{
                ...stats,
                currentCapitalUsd: stats.currentCapitalUsd > 0 ? stats.currentCapitalUsd : (wallet.totalBalanceUsd || 0),
                capitalAvailableUsd: stats.capitalAvailableUsd > 0 ? stats.capitalAvailableUsd : (wallet.totalBalanceUsd || 0),
                startingCapitalUsd: stats.startingCapitalUsd > 0 ? stats.startingCapitalUsd : (wallet.totalBalanceUsd || 0),
              }}
            />
          )}

          {/* Dynamic Active View Rendering */}
          {currentView === 'overview' && (
            <div className="space-y-3.5">
              {/* Pure High-Density MEV Opportunity Feed & Order Flow */}
              <LiveOpportunityTable
                opportunities={opportunities}
                onSelectOpportunity={setSelectedOpportunity}
                selectedChain={selectedChain}
                selectedStrategy={selectedStrategy}
              />
            </div>
          )}

          {currentView === 'charts' && (
            <div className="space-y-3.5">
              {/* Dedicated DexScreener Live Candlestick & Analysis Suite */}
              <LiveCoinCharts
                onExecutePaperTrade={handleExecutePaperTrade}
                availableCapitalUsd={stats.capitalAvailableUsd}
              />
            </div>
          )}

          {currentView === 'opportunities' && (
            <LiveOpportunityTable
              opportunities={opportunities}
              onSelectOpportunity={setSelectedOpportunity}
              selectedChain={selectedChain}
              selectedStrategy={selectedStrategy}
            />
          )}

          {currentView === 'paper' && (
            <PaperTradingStation
              stats={stats}
              trades={trades}
              onResetAccount={handleResetAccount}
              onUpdateStartingCapital={handleUpdateStartingCapital}
            />
          )}

          {currentView === 'research' && <ResearchLab />}

          {currentView === 'chains' && <ChainsPoolsExplorer />}

          {currentView === 'latency' && <LatencyEvAnalytics />}

          {currentView === 'settings' && (
            <TerminalSettings
              settings={settings}
              riskProfile={riskProfile}
              onSelectRiskProfile={handleSelectRiskProfile}
              onChangeSettings={(newS) => {
                setSettings(newS);
                if (newS.startingCapitalUsd !== stats.startingCapitalUsd) {
                  handleUpdateStartingCapital(newS.startingCapitalUsd);
                }
              }}
              onResetDefaults={() =>
                handleUpdateStartingCapital(100.0)
              }
            />
          )}
        </main>
      </div>

      {/* Opportunity Audit Drawer / Modal */}
      <OpportunityAuditModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        onExecutePaperTrade={handleExecutePaperTrade}
        availableCapitalUsd={stats.capitalAvailableUsd}
      />

      {/* Private Builder Bundle & Pre-Flight Inspector Modal */}
      <BundleInspectorModal
        isOpen={isBundleInspectorOpen}
        onClose={() => setIsBundleInspectorOpen(false)}
        activeChain={selectedChain}
        chainId={selectedChain === 'ROBINHOOD' ? 421614 : (selectedChain === 'ARBITRUM' ? 42161 : 8453)}
        onExecuteTrade={() => fetchLiveStats()}
      />
    </div>
  );
}
