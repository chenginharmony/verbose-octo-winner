import React, { useState } from 'react';
import { Zap, Search, Filter, ShieldAlert, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface LiveOpportunityTableProps {
  opportunities: any[];
  onSelectOpportunity: (opp: any) => void;
  selectedChain: 'ALL' | 'BASE' | 'ARBITRUM' | 'ROBINHOOD';
  selectedStrategy?: 'ALL' | 'SANDWICH' | 'ARBITRAGE' | 'BACKRUN';
}

export const LiveOpportunityTable: React.FC<LiveOpportunityTableProps> = ({
  opportunities,
  onSelectOpportunity,
  selectedChain,
  selectedStrategy = 'ALL',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TAKE' | 'REJECT' | 'PAPER'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>(selectedStrategy || 'ALL');
  const [minEvFilter, setMinEvFilter] = useState<number>(0);

  const filteredOpportunities = opportunities.filter((opp) => {
    // Strategy filter
    if (strategyFilter !== 'ALL' && opp.strategy && opp.strategy !== strategyFilter) return false;

    // Chain filter
    if (selectedChain === 'BASE' && opp.pool.chainId !== 8453) return false;
    if (selectedChain === 'ARBITRUM' && opp.pool.chainId !== 42161) return false;
    if (selectedChain === 'ROBINHOOD' && opp.pool.chainId !== 421614) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchToken = opp.pool.token0?.symbol?.toLowerCase().includes(q) || opp.pool.token1?.symbol?.toLowerCase().includes(q);
      const matchPool = opp.pool.name?.toLowerCase().includes(q);
      const matchHash = opp.targetSwap?.transactionHash?.toLowerCase().includes(q);
      const matchStrat = opp.strategy?.toLowerCase().includes(q);
      if (!matchToken && !matchPool && !matchHash && !matchStrat) return false;
    }

    // Min EV filter
    if (minEvFilter > 0) {
      const ev = opp.evMetrics?.expectedValueUsd || opp.bestPosition?.netProfitUsd || 0;
      if (ev < minEvFilter) return false;
    }

    // Status filter
    if (statusFilter === 'TAKE' && opp.status !== 'PROFITABLE' && opp.status !== 'PAPER') return false;
    if (statusFilter === 'REJECT' && opp.status !== 'REJECTED') return false;
    if (statusFilter === 'PAPER' && opp.status !== 'PAPER') return false;

    return true;
  });

  const formatUsd = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$0.0000';
    return `${val >= 0 ? '+' : ''}$${val.toFixed(4)}`;
  };

  return (
    <div className="terminal-card flex flex-col font-mono">
      {/* Table Action Bar */}
      <div className="p-3 border-b border-[#1a2333] flex flex-wrap items-center justify-between gap-3 bg-[#0a0e16]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Real-Time Opportunity Engine Feed
          </h2>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-xs border border-slate-700">
            {filteredOpportunities.length} SHOWN / {opportunities.length} BUFFERED
          </span>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2.5" />
            <input
              type="text"
              placeholder="Search token, pool, tx..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0e1420] border border-[#1e293b] rounded-xs pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-40"
            />
          </div>

          <select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            className="bg-[#0e1420] border border-[#1e293b] rounded-xs px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">ALL STRATEGIES</option>
            <option value="SANDWICH">🥪 SANDWICH (DEFAULT)</option>
            <option value="ARBITRAGE">🔄 ARBITRAGE</option>
            <option value="BACKRUN">⚡ BACKRUN</option>
          </select>

          <select
            value={minEvFilter}
            onChange={(e) => setMinEvFilter(parseFloat(e.target.value))}
            className="bg-[#0e1420] border border-[#1e293b] rounded-xs px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value={0}>ALL EV SPREADS</option>
            <option value={0.001}>EV &gt;= $0.001</option>
            <option value={0.005}>EV &gt;= $0.005</option>
            <option value={0.010}>EV &gt;= $0.010</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#0e1420] border border-[#1e293b] rounded-xs px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="TAKE">ACTIONABLE (TAKE)</option>
            <option value="PAPER">PAPER EXECUTED</option>
            <option value="REJECT">REJECTED / NOISE</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#162030] text-[10px] uppercase text-slate-400 bg-[#0c1018] tracking-wider select-none">
              <th className="py-2.5 px-3">TIME</th>
              <th className="py-2.5 px-3">STRATEGY</th>
              <th className="py-2.5 px-3">CHAIN</th>
              <th className="py-2.5 px-3">TOKEN / POOL</th>
              <th className="py-2.5 px-3">TARGET SWAP</th>
              <th className="py-2.5 px-3 text-right">SIZE</th>
              <th className="py-2.5 px-3 text-right">GROSS EDGE</th>
              <th className="py-2.5 px-3 text-right">L2 GAS</th>
              <th className="py-2.5 px-3 text-right">THEORETICAL NET</th>
              <th className="py-2.5 px-3 text-right">EXPECTED VALUE (EV)</th>
              <th className="py-2.5 px-3 text-center">P(EXEC) / P(SURV)</th>
              <th className="py-2.5 px-3 text-center">ACTION / AUDIT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141b29]">
            {filteredOpportunities.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500 text-xs">
                  No opportunities match the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredOpportunities.map((opp) => {
                const chainId = opp.pool?.chainId || 8453;
                const netProfit = opp.bestPosition?.netProfitUsd || 0;
                const grossProfit = opp.bestPosition?.grossProfitUsd || 0;
                const fees = opp.bestPosition?.costUsd || 0;
                const ev = opp.evMetrics?.expectedValueUsd !== undefined ? opp.evMetrics.expectedValueUsd : netProfit * 0.7;
                const pExec = opp.evMetrics?.executionProbability ? (opp.evMetrics.executionProbability * 100).toFixed(0) : '75';
                const pSurv = opp.evMetrics?.survivalProbability ? (opp.evMetrics.survivalProbability * 100).toFixed(0) : '85';
                const isPositive = netProfit > 0;
                const isEvPositive = ev > 0;

                const tokenPair = `${opp.pool.token0?.symbol || 'T0'}/${opp.pool.token1?.symbol || 'T1'}`;

                return (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpportunity(opp)}
                    className="hover:bg-[#111827] cursor-pointer transition-colors group"
                  >
                    {/* Timestamp */}
                    <td suppressHydrationWarning className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(opp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* Strategy Badge */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {opp.strategy === 'SANDWICH' || !opp.strategy ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-amber-950/90 text-amber-300 border border-amber-700/80 flex items-center gap-1 w-fit">
                          🥪 SANDWICH
                        </span>
                      ) : opp.strategy === 'ARBITRAGE' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-cyan-950/90 text-cyan-300 border border-cyan-700/80 flex items-center gap-1 w-fit">
                          🔄 ARBITRAGE
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-purple-950/90 text-purple-300 border border-purple-700/80 flex items-center gap-1 w-fit">
                          ⚡ BACKRUN
                        </span>
                      )}
                    </td>

                    {/* Chain Badge (Base, Arbitrum, Robinhood) */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {chainId === 8453 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-blue-950 text-blue-300 border border-blue-800/60">
                          BASE
                        </span>
                      ) : chainId === 42161 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                          ARB ONE
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ROBINHOOD
                        </span>
                      )}
                    </td>

                    {/* Token / Pool */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {tokenPair}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={opp.pool.name}>
                        {opp.pool.protocol} · {opp.pool.name?.split(' ')[0]}
                      </div>
                    </td>

                    {/* Target Swap */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="text-slate-300 font-medium">
                        ${opp.targetSizeUsd?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {opp.direction === 'BUY_SIDE' ? 'BUY' : 'SELL'}
                      </div>
                    </td>

                    {/* Position Size */}
                    <td className="py-2 px-3 text-right whitespace-nowrap text-slate-200 font-medium">
                      ${opp.bestPosition?.positionSizeUsd?.toFixed(2) || '0.00'}
                    </td>

                    {/* Gross Edge */}
                    <td className="py-2 px-3 text-right whitespace-nowrap text-slate-300">
                      ${grossProfit.toFixed(4)}
                    </td>

                    {/* Fees & Bribes */}
                    <td className="py-2 px-3 text-right whitespace-nowrap text-rose-400/90">
                      -${fees.toFixed(4)}
                    </td>

                    {/* Theoretical Net */}
                    <td className={`py-2 px-3 text-right whitespace-nowrap font-bold ${
                      isPositive ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {formatUsd(netProfit)}
                    </td>

                    {/* Expected Value (EV) */}
                    <td className={`py-2 px-3 text-right whitespace-nowrap font-bold ${
                      isEvPositive ? 'text-cyan-300' : 'text-slate-500'
                    }`}>
                      {formatUsd(ev)}
                    </td>

                    {/* P(Exec) / P(Surv) */}
                    <td className="py-2 px-3 text-center whitespace-nowrap text-[11px] text-slate-400">
                      <span className="text-emerald-400">{pExec}%</span> / <span className="text-cyan-400">{pSurv}%</span>
                    </td>

                    {/* Action / Audit */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {opp.status === 'PAPER' ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> FILLED & SETTLED
                        </span>
                      ) : opp.status === 'PROFITABLE' ? (
                        <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                          <ArrowUpRight className="w-2.5 h-2.5" /> TAKE
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-900 text-slate-500 border border-slate-800 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" /> REJECT
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
