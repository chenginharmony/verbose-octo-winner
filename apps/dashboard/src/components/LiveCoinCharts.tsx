'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart as ChartIcon,
  Search,
  ExternalLink,
  Zap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface BasePoolOption {
  symbol: string;
  name: string;
  pairAddress: string;
  baseTokenAddress: string;
  protocol: 'aerodrome_v2' | 'uniswap_v3' | 'aerodrome_v3' | 'baseswap';
  feeTier: string;
  category: 'BLUECHIP' | 'MEME' | 'STABLE' | 'DEFI';
}

export const POPULAR_BASE_POOLS: BasePoolOption[] = [
  {
    symbol: 'WETH / BRETT',
    name: 'Aerodrome V2 WETH/BRETT',
    pairAddress: '0x32A6f3F3A06B956553B81F28C3408a2872A4b61B',
    baseTokenAddress: '0x532f2710150E2112bd7CD5375027408856125011',
    protocol: 'aerodrome_v2',
    feeTier: '0.30%',
    category: 'MEME',
  },
  {
    symbol: 'WETH / USDC',
    name: 'Aerodrome V2 WETH/USDC (vAMM)',
    pairAddress: '0xb4885Bc63399bF55161A639b07ae3A9e0ecB50e4',
    baseTokenAddress: '0x4200000000000000000000000000000000000006',
    protocol: 'aerodrome_v2',
    feeTier: '0.30%',
    category: 'BLUECHIP',
  },
  {
    symbol: 'WETH / DEGEN',
    name: 'Aerodrome V2 WETH/DEGEN',
    pairAddress: '0xc9034c3E7F1871C80e1F06e00A2387B4Ac35B760',
    baseTokenAddress: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    protocol: 'aerodrome_v2',
    feeTier: '0.30%',
    category: 'MEME',
  },
  {
    symbol: 'WETH / AERO',
    name: 'Aerodrome V2 WETH/AERO',
    pairAddress: '0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d',
    baseTokenAddress: '0x940181A94A35a4569E4529A3cDfb74e48fD986cA',
    protocol: 'aerodrome_v2',
    feeTier: '0.30%',
    category: 'DEFI',
  },
  {
    symbol: 'WETH / USDC (0.05%)',
    name: 'Uniswap V3 WETH/USDC',
    pairAddress: '0xd0b53D9277642d899DF5C87A3966A349A798F224',
    baseTokenAddress: '0x4200000000000000000000000000000000000006',
    protocol: 'uniswap_v3',
    feeTier: '0.05%',
    category: 'BLUECHIP',
  },
  {
    symbol: 'USDC / USDbC',
    name: 'Aerodrome V2 USDC/USDbC (sAMM)',
    pairAddress: '0x6de43ac6F0C0F952f4C6e91F1624b423b8601614',
    baseTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    protocol: 'aerodrome_v2',
    feeTier: '0.01%',
    category: 'STABLE',
  },
  {
    symbol: 'WETH / TOSHI',
    name: 'Uniswap V3 WETH/TOSHI',
    pairAddress: '0x2B9229e3FB0614ab1c86A4181B73b88b0f8008a9',
    baseTokenAddress: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
    protocol: 'uniswap_v3',
    feeTier: '0.30%',
    category: 'MEME',
  },
];

interface LiveCoinChartsProps {
  onExecutePaperTrade?: (opp: any, size?: number) => void;
  availableCapitalUsd?: number;
  initialCollapsed?: boolean;
}

export const LiveCoinCharts: React.FC<LiveCoinChartsProps> = ({
  onExecutePaperTrade,
  availableCapitalUsd = 10.0,
  initialCollapsed = false,
}) => {
  const [selectedPool, setSelectedPool] = useState<BasePoolOption>(POPULAR_BASE_POOLS[0]);
  const [customInput, setCustomInput] = useState<string>('');
  const [pairData, setPairData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Ergonomic Height & Collapse Controls
  const [chartHeight, setChartHeight] = useState<'compact' | 'standard' | 'expanded'>('standard');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(initialCollapsed);

  // Paper Trade Execution State in Chart ($0.10 Base Trading Amount)
  const [tradeSizeUsd, setTradeSizeUsd] = useState<number>(Math.min(availableCapitalUsd, 0.10));
  const [executionState, setExecutionState] = useState<'IDLE' | 'EXECUTING' | 'SUCCESS'>('IDLE');
  const [lastExecutedPnl, setLastExecutedPnl] = useState<number | null>(null);

  // Trending Memes Discovered from DexScreener
  const [trendingPools, setTrendingPools] = useState<BasePoolOption[]>([]);

  // Fetch DexScreener Live Stats for the selected Base pair
  useEffect(() => {
    let isMounted = true;

    const fetchPairStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:4000/dexscreener/pair/${selectedPool.pairAddress}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.pairs && data.pairs.length > 0) {
            setPairData(data.pairs[0]);
          } else if (isMounted && data.pair) {
            setPairData(data.pair);
          }
        }
      } catch (err) {
        // Fallback silently if API is offline
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPairStats();
    const interval = setInterval(fetchPairStats, 10000); // 10s live refresh

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedPool.pairAddress]);

  // Fetch Dynamically Discovered Trending Memes from Backend Discovery Engine
  useEffect(() => {
    let isMounted = true;
    const fetchTrending = async () => {
      try {
        const res = await fetch('http://localhost:4000/trending-memes');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.trending && data.trending.length > 0) {
            const mapped: BasePoolOption[] = data.trending.map((t: any) => ({
              symbol: t.symbol,
              name: t.name,
              pairAddress: t.pairAddress,
              baseTokenAddress: t.baseTokenAddress,
              protocol: t.protocol,
              feeTier: t.feeTier,
              category: t.category,
            }));
            setTrendingPools(mapped);
          }
        }
      } catch {}
    };

    fetchTrending();
    const interval = setInterval(fetchTrending, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customInput.trim();
    if (!cleaned) return;

    if (cleaned.startsWith('0x') && cleaned.length === 42) {
      setSelectedPool({
        symbol: 'CUSTOM PAIR',
        name: `Base Contract ${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`,
        pairAddress: cleaned,
        baseTokenAddress: cleaned,
        protocol: 'aerodrome_v2',
        feeTier: 'Custom',
        category: 'DEFI',
      });
      setCustomInput('');
    }
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger Paper Trade execution with instant visual feedback ($0.10 micro-trade)
  const handleTriggerTrade = () => {
    if (executionState === 'EXECUTING') return;

    const actualSize = Math.min(availableCapitalUsd, Math.max(0.01, tradeSizeUsd));
    const grossPnl = actualSize * 0.048; // Simulated 4.8% spread on preconfirmation
    const fees = Math.min(0.0015, actualSize * 0.015); // Base L2 micro gas
    const netPnl = Math.max(0.001, grossPnl - fees);

    setExecutionState('EXECUTING');

    setTimeout(() => {
      if (onExecutePaperTrade) {
        onExecutePaperTrade(
          {
            id: `opp-chart-${Date.now()}`,
            symbol: `${selectedPool.symbol} (Base)`,
            pool: {
              name: selectedPool.name,
              chainId: 8453,
              address: selectedPool.pairAddress,
              token0: { symbol: selectedPool.symbol.split('/')[0]?.trim() || 'T0' },
              token1: { symbol: selectedPool.symbol.split('/')[1]?.trim() || 'T1' },
            },
            bestPosition: {
              positionSizeUsd: actualSize,
              grossProfitUsd: grossPnl,
              costUsd: fees,
              netProfitUsd: netPnl,
              roi: actualSize > 0 ? netPnl / actualSize : 0,
            },
          },
          actualSize
        );
      }

      setLastExecutedPnl(netPnl);
      setExecutionState('SUCCESS');

      setTimeout(() => {
        setExecutionState('IDLE');
      }, 3500);
    }, 400);
  };

  const allPools = [
    ...POPULAR_BASE_POOLS,
    ...trendingPools.filter(
      (tp) => !POPULAR_BASE_POOLS.some((p) => p.pairAddress.toLowerCase() === tp.pairAddress.toLowerCase())
    ),
  ];

  const filteredPools =
    activeCategory === 'ALL'
      ? allPools
      : activeCategory === '🔥 TRENDING'
      ? (trendingPools.length > 0 ? trendingPools : allPools.filter((p) => p.category === 'MEME'))
      : allPools.filter((p) => p.category === activeCategory);

  const priceUsd = pairData?.priceUsd ? parseFloat(pairData.priceUsd) : null;
  const priceChange24h = pairData?.priceChange?.h24;
  const priceChange5m = pairData?.priceChange?.m5;
  const priceChange1h = pairData?.priceChange?.h1;
  const volume24h = pairData?.volume?.h24;
  const liquidityUsd = pairData?.liquidity?.usd;
  const fdv = pairData?.fdv;
  const buys24h = pairData?.txns?.h24?.buys || 0;
  const sells24h = pairData?.txns?.h24?.sells || 0;
  const totalTxns = buys24h + sells24h || 1;
  const buyRatioPct = Math.round((buys24h / totalTxns) * 100);

  // Height map
  const heightClass =
    chartHeight === 'compact' ? 'h-[360px]' : chartHeight === 'standard' ? 'h-[480px]' : 'h-[620px]';

  return (
    <div className="space-y-2.5 font-mono select-none">
      {/* Execution Confirmation Toast Banner */}
      {executionState === 'SUCCESS' && lastExecutedPnl !== null && (
        <div className="bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 px-4 py-2 rounded-xs flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-bounce-short">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>
              PAPER TRADE FILLED ON BASE: {selectedPool.symbol} | Size: ${tradeSizeUsd.toFixed(2)} | Realized Net:{' '}
              <span className="text-emerald-300 font-extrabold">+${lastExecutedPnl.toFixed(4)} PnL</span>
            </span>
          </div>
          <span className="text-[10px] bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-700 font-mono font-bold">
            LEDGER UPDATED
          </span>
        </div>
      )}

      {/* Top Banner & Pool Selector */}
      <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-950/80 border border-blue-500/50 rounded-xs text-blue-400">
              <ChartIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Live Coin Chart & DexScreener Stream
              </h2>
              <span className="text-[9px] bg-blue-950 text-blue-300 px-1.5 py-0.2 rounded-xs border border-blue-800 font-bold">
                BASE (8453)
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded-xs border border-emerald-800 flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                200MS FLASHBLOCKS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Height Size Toggles */}
            <div className="flex items-center bg-[#0d121c] border border-[#1e293b] rounded-xs p-0.5 text-[10px]">
              <button
                onClick={() => setChartHeight('compact')}
                className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                  chartHeight === 'compact' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
                title="Compact Height (340px)"
              >
                COMPACT
              </button>
              <button
                onClick={() => setChartHeight('standard')}
                className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                  chartHeight === 'standard' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
                title="Standard Height (440px)"
              >
                MED
              </button>
              <button
                onClick={() => setChartHeight('expanded')}
                className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                  chartHeight === 'expanded' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
                title="Expanded Height (580px)"
              >
                EXPAND
              </button>
            </div>

            {/* Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#0d121c] text-slate-300 border border-[#1e293b] hover:border-slate-600 rounded-xs transition-all"
            >
              {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {isCollapsed ? 'SHOW CHART' : 'COLLAPSE'}
            </button>

            {/* Search or Enter Custom Contract Address */}
            <form onSubmit={handleCustomSearch} className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
                <input
                  type="text"
                  placeholder="Paste Base 0x... pair"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="bg-[#0e1420] border border-[#1e293b] rounded-xs pl-6 pr-2 py-0.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 w-44"
                />
              </div>
              <button
                type="submit"
                className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 rounded-xs text-[10px] font-bold transition-all"
              >
                LOAD
              </button>
            </form>
          </div>
        </div>

        {/* Quick Pool Selection Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#141b29]">
          <div className="flex items-center gap-1">
            {['ALL', '🔥 TRENDING', 'MEME', 'AI_AGENT', 'BLUECHIP', 'DEFI', 'STABLE'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-1.5 py-0.5 rounded-xs text-[9px] font-bold transition-all ${
                  activeCategory === cat
                    ? 'bg-slate-700 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#0d121c] text-slate-400 border border-[#1e293b] hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Pool Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {filteredPools.map((pool) => {
              const isSelected = selectedPool.pairAddress.toLowerCase() === pool.pairAddress.toLowerCase();
              return (
                <button
                  key={pool.pairAddress}
                  onClick={() => setSelectedPool(pool)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] transition-all ${
                    isSelected
                      ? 'bg-blue-950 text-blue-200 font-bold border border-blue-500 shadow-xs'
                      : 'bg-[#0d121c] text-slate-400 border border-[#1e293b] hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span>{pool.symbol}</span>
                  <span className="text-[8px] px-1 rounded bg-slate-800/80 text-slate-400">
                    {pool.feeTier}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Body (Collapsible) */}
      {!isCollapsed && (
        <>
          {/* Real-Time DexScreener Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Price Card */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">PRICE (USD)</span>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1 mt-0.5">
                ${priceUsd !== null ? (priceUsd < 0.01 ? priceUsd.toExponential(4) : priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })) : '---'}
              </div>
              <div className="text-[9px] text-slate-500 truncate">
                {pairData?.priceNative ? `${parseFloat(pairData.priceNative).toFixed(8)} ETH` : 'Base Mainnet'}
              </div>
            </div>

            {/* 24h Change */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">24H CHANGE</span>
              <div
                className={`text-sm font-bold flex items-center gap-1 mt-0.5 ${
                  (priceChange24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(priceChange24h || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceChange24h !== undefined ? `${priceChange24h > 0 ? '+' : ''}${priceChange24h}%` : '---'}
              </div>
              <div className="text-[9px] text-slate-500 flex items-center gap-2">
                <span>5m: {priceChange5m !== undefined ? `${priceChange5m > 0 ? '+' : ''}${priceChange5m}%` : '0%'}</span>
                <span>1h: {priceChange1h !== undefined ? `${priceChange1h > 0 ? '+' : ''}${priceChange1h}%` : '0%'}</span>
              </div>
            </div>

            {/* 24h Volume */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">24H VOLUME</span>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">
                ${volume24h ? volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '---'}
              </div>
              <div className="text-[9px] text-slate-500">DEX Turnover</div>
            </div>

            {/* Liquidity */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">LIQUIDITY (USD)</span>
              <div className="text-sm font-bold text-slate-100 mt-0.5">
                ${liquidityUsd ? liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '---'}
              </div>
              <div className="text-[9px] text-slate-500">Pool Total TVL</div>
            </div>

            {/* FDV */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">FDV (MARKET CAP)</span>
              <div className="text-sm font-bold text-slate-200 mt-0.5">
                ${fdv ? (fdv / 1000000).toFixed(2) + 'M' : '---'}
              </div>
              <div className="text-[9px] text-slate-500">Fully Diluted Value</div>
            </div>

            {/* 24h Buys vs Sells */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase">
                <span>TXNS 24H</span>
                <span className="text-emerald-400 font-bold">{buyRatioPct}% BUY</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold mt-0.5">
                <span className="text-emerald-400">{buys24h.toLocaleString()} B</span>
                <span className="text-rose-400">{sells24h.toLocaleString()} S</span>
              </div>
              {/* Ratio bar */}
              <div className="w-full bg-rose-950/80 h-1 rounded-full overflow-hidden flex mt-0.5">
                <div className="bg-emerald-500 h-full" style={{ width: `${buyRatioPct}%` }} />
              </div>
            </div>
          </div>

          {/* Main Chart Container & MEV Control Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5">
            {/* Left 3 Columns: DexScreener Live Candlestick Frame */}
            <div className={`lg:col-span-3 bg-[#090d14] border border-[#1a2333] rounded-xs overflow-hidden flex flex-col ${heightClass}`}>
              {/* Frame Top Header */}
              <div className="bg-[#0c1017] px-2.5 py-1.5 border-b border-[#141b29] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-200">{selectedPool.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedPool.pairAddress.slice(0, 8)}...{selectedPool.pairAddress.slice(-6)}
                  </span>
                  <button
                    onClick={() => handleCopyAddress(selectedPool.pairAddress)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                    title="Copy Pair Address"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://basescan.org/address/${selectedPool.pairAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 border border-[#1e293b] px-1.5 py-0.5 rounded-xs transition-colors"
                  >
                    <span>BaseScan</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <a
                    href={`https://dexscreener.com/base/${selectedPool.pairAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 border border-cyan-500/40 px-1.5 py-0.5 rounded-xs transition-colors font-bold"
                  >
                    <span>DexScreener</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Embedded DexScreener Real-Time Chart */}
              <div className="flex-1 w-full h-full bg-[#080a0f] relative">
                <iframe
                  src={`https://dexscreener.com/base/${selectedPool.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                  title={`${selectedPool.symbol} Live Chart`}
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Right 1 Column: MEV Research & Simulated Paper Execution Panel */}
            <div className="bg-[#090d14] border border-[#1a2333] rounded-xs p-3 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2.5">
                <div className="border-b border-[#141b29] pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Paper Execution</span>
                  </h3>
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded border border-emerald-800">
                    LIVE READY
                  </span>
                </div>

                {/* Target Pool Details */}
                <div className="bg-[#0e1420] border border-[#1e293b] rounded-xs p-2 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Pool:</span>
                    <span className="font-bold text-slate-200">{selectedPool.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Protocol:</span>
                    <span className="text-cyan-300 font-bold uppercase">{selectedPool.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fee Tier:</span>
                    <span className="text-slate-200">{selectedPool.feeTier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency Cadence:</span>
                    <span className="text-emerald-400 font-bold">~200ms Flashblocks</span>
                  </div>
                </div>

                {/* Trade Sizing Controls */}
                <div className="bg-[#0e1420] border border-[#1e293b] rounded-xs p-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="uppercase font-bold">TRADE SIZE:</span>
                    <span className="text-emerald-400 font-bold">Avail: ${availableCapitalUsd.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.10, 0.25, 0.50, Math.min(1.0, availableCapitalUsd)].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setTradeSizeUsd(Math.min(availableCapitalUsd, amt))}
                        className={`py-1 text-[10px] font-bold rounded-xs transition-all ${
                          tradeSizeUsd === amt
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-500'
                            : 'bg-[#090d14] text-slate-400 border border-[#1e293b] hover:text-slate-200'
                        }`}
                      >
                        ${amt.toFixed(2)}
                      </button>
                    ))}
                  </div>

                  {/* Calculated PnL Simulation */}
                  <div className="pt-1.5 border-t border-[#141b29] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. L2 Micro Gas:</span>
                      <span className="text-rose-400">-${Math.min(0.0015, tradeSizeUsd * 0.015).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Simulated Net PnL:</span>
                      <span className="text-emerald-400 font-bold">
                        +${Math.max(0.001, tradeSizeUsd * 0.048 - Math.min(0.0015, tradeSizeUsd * 0.015)).toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button: Execute Paper Trade on this Pair */}
              <div className="space-y-1.5 pt-1 border-t border-[#141b29]">
                <button
                  onClick={handleTriggerTrade}
                  disabled={executionState === 'EXECUTING'}
                  className={`w-full py-2 px-3 font-bold text-xs rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    executionState === 'EXECUTING'
                      ? 'bg-amber-600 text-slate-950 animate-pulse'
                      : executionState === 'SUCCESS'
                      ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.7)]'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  }`}
                >
                  {executionState === 'EXECUTING' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ROUTING TRADE...</span>
                    </>
                  ) : executionState === 'SUCCESS' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>TRADE EXECUTED! (+${(lastExecutedPnl || 0.0985).toFixed(4)})</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>EXECUTE TRADE ON THIS PAIR (${tradeSizeUsd.toFixed(2)})</span>
                    </>
                  )}
                </button>
                <p className="text-[9px] text-center text-slate-500">
                  Instant live execution recorded to ledger.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
