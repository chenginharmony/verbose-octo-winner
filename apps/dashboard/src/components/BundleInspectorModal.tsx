'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  X,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Play,
  Zap,
  ArrowRight,
  Terminal,
  Activity,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface BundleInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl?: string;
  activeChain?: string;
  chainId?: number;
  onExecuteTrade?: () => void;
}

export const BundleInspectorModal: React.FC<BundleInspectorModalProps> = ({
  isOpen,
  onClose,
  apiUrl = 'http://localhost:4000',
  activeChain = 'ROBINHOOD',
  chainId = 421614,
  onExecuteTrade,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);

  const fetchBundlePreview = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/execution/bundle-preview`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // transient network fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBundlePreview();
      const interval = setInterval(fetchBundlePreview, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleCopyJson = () => {
    if (!data?.jsonRpc) return;
    navigator.clipboard.writeText(JSON.stringify(data.jsonRpc, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteSingleTrade = async () => {
    try {
      setExecuting(true);
      setExecResult(null);
      const res = await fetch(`${apiUrl}/execution/take`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: data?.opportunityId }),
      });
      const resJson = await res.json();
      setExecResult(resJson);
      if (onExecuteTrade) onExecuteTrade();
    } catch (err: any) {
      setExecResult({ success: false, error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  const bundle = data?.bundle;
  const preflight = data?.preflight;
  const tx = data?.transaction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#0b0e14] border border-[#1e293b] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f141f] border-b border-[#1e293b] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Private Builder Bundle & Pre-Flight Inspector
                </h2>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {activeChain} ({chainId})
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Atomic bundle formatting for Flashbots / Titan / Base Flashblocks private relays
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBundlePreview}
              disabled={loading}
              className="p-1.5 rounded-md bg-[#161f30] hover:bg-[#1f2b42] text-slate-300 border border-[#2a3b59] transition-colors"
              title="Refresh Bundle Preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md bg-[#161f30] hover:bg-[#1f2b42] text-slate-400 hover:text-slate-200 border border-[#2a3b59] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto font-mono text-[11px]">
          {/* Target & Preflight Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="bg-[#080b11] border border-[#1a2333] rounded-md p-2.5 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">TARGET POOL</span>
              <span className="text-xs font-bold text-slate-200 truncate mt-1">
                {data?.pool || 'Robinhood Live Pool'}
              </span>
              <span className="text-[9px] text-cyan-400 truncate font-mono">
                {tx?.to ? `${tx.to.slice(0, 10)}...${tx.to.slice(-6)}` : '0x1000...0020'}
              </span>
            </div>

            <div className="bg-[#080b11] border border-[#1a2333] rounded-md p-2.5 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">TARGET BLOCK</span>
              <span className="text-xs font-bold text-amber-400 mt-1">
                {bundle?.blockNumber || '0x00'}
              </span>
              <span className="text-[9px] text-slate-500">
                Window: {bundle?.minTimestamp ? `${bundle.maxTimestamp - bundle.minTimestamp}s` : '3s'}
              </span>
            </div>

            <div className="bg-[#080b11] border border-[#1a2333] rounded-md p-2.5 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">EXPECTED NET PROFIT</span>
              <span className="text-xs font-bold text-emerald-400 mt-1">
                {preflight?.expectedNetProfitUsd !== undefined ? `+$${preflight.expectedNetProfitUsd.toFixed(4)}` : '+$0.0350'}
              </span>
              <span className="text-[9px] text-slate-500">
                Cost: ~${preflight?.totalCostUsd ? preflight.totalCostUsd.toFixed(4) : '0.0150'}
              </span>
            </div>

            <div className="bg-[#080b11] border border-[#1a2333] rounded-md p-2.5 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 uppercase">STAGING SIMULATION</span>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">
                  {preflight?.hurdleCleared ? 'HURDLE CLEARED' : 'PENDING SIM'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">
                Gas Bound: {preflight?.gasEstimated || '350,000'}
              </span>
            </div>
          </div>

          {/* Bundle Transaction Sequence (3 Legs) */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Bundle Atomic Ordering Sequence (3 Legs)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Leg 1: Front-run */}
              <div className="bg-[#090d14] border border-cyan-900/40 rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold">
                  <span>LEG 1: FRONTRUN</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[8px] border border-cyan-800">
                    BUY
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  Method: <span className="text-cyan-300 font-mono">swapExactTokensForTokens</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono break-all line-clamp-2 bg-[#06080d] p-1 rounded border border-[#141b29]">
                  {bundle?.txs?.[0] || '0x0238ed1739...'}
                </div>
              </div>

              {/* Leg 2: Victim Transaction */}
              <div className="bg-[#090d14] border border-amber-900/40 rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                  <span>LEG 2: VICTIM SWAP</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[8px] border border-amber-800">
                    ORDERFLOW
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  TxHash: <span className="text-amber-300 font-mono truncate">{bundle?.txs?.[1]?.slice(0, 16) || '0xrh-victim...'}...</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono break-all line-clamp-2 bg-[#06080d] p-1 rounded border border-[#141b29]">
                  {bundle?.txs?.[1] || '0xvictim_tx_hash...'}
                </div>
              </div>

              {/* Leg 3: Back-run */}
              <div className="bg-[#090d14] border border-emerald-900/40 rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                  <span>LEG 3: BACKRUN</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[8px] border border-emerald-800">
                    SELL
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  Method: <span className="text-emerald-300 font-mono">swapExactTokensForTokens</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono break-all line-clamp-2 bg-[#06080d] p-1 rounded border border-[#141b29]">
                  {bundle?.txs?.[2] || '0x0238ed1739...'}
                </div>
              </div>
            </div>
          </div>

          {/* Raw JSON-RPC eth_sendBundle Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
              <span className="flex items-center gap-1.5 font-bold">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Raw JSON-RPC Builder Request (`eth_sendBundle`)</span>
              </span>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="bg-[#05070a] border border-[#141b29] rounded-md p-2.5 text-[10px] text-slate-300 overflow-x-auto max-h-36">
              {data?.jsonRpc ? JSON.stringify(data.jsonRpc, null, 2) : '// Loading active bundle...'}
            </pre>
          </div>

          {/* Execution Result Feedback */}
          {execResult && (
            <div className="p-3 rounded-md bg-[#080d14] border border-cyan-800/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Single Trade Staging Execution Result:</span>
              </div>
              <div className="text-[10px] text-slate-300">
                Status: <span className="font-mono text-cyan-300">{execResult.executionResult?.status || 'PROCESSED'}</span> | Mode: <span className="font-mono text-amber-300">{execResult.executionResult?.mode || 'disabled'}</span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Settlement ID: {execResult.settlement?.settlementId || 'set-direct'} | P&L: {execResult.settlement?.netProfitUsd !== undefined ? `$${execResult.settlement.netProfitUsd.toFixed(4)}` : '$0.00'}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#0f141f] border-t border-[#1e293b] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strict Single Position Lock (Concurrency: 1) Active</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 bg-[#161f30] hover:bg-[#1f2b42] border border-[#2a3b59] rounded-md transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleExecuteSingleTrade}
              disabled={executing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 rounded-md shadow-md transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${executing ? 'animate-spin' : ''}`} />
              <span>{executing ? 'Executing...' : 'Execute Staged Single Trade'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
