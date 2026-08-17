import { DexRegistry, BASE_TOKENS } from './dex_registry.js';
import { DexPoolIdentity } from './types.js';

export interface TrendingMemePair {
  symbol: string;
  name: string;
  pairAddress: string;
  baseTokenAddress: string;
  quoteTokenAddress: string;
  dexId: string;
  protocol: 'aerodrome_v2' | 'uniswap_v3';
  feeTier: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: number;
  liquidityUsd: number;
  trendingRank: number;
  category: 'MEME' | 'AI_AGENT' | 'DEFI' | 'BLUECHIP';
}

const DISCOVERY_QUERIES = [
  'brett',
  'degen',
  'toshi',
  'miggles',
  'virtual',
  'higher',
  'keycat',
  'clanker',
  'ski',
  'aero',
  'normie',
  'doginme',
];

export class DynamicMemeDiscoveryService {
  private trendingPairs: TrendingMemePair[] = [];
  private lastFetchTime: number = 0;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isFetching: boolean = false;

  constructor(private dexRegistry: DexRegistry) {}

  public async start(pollIntervalMs: number = 60000): Promise<void> {
    await this.refreshTrendingMemes();
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => this.refreshTrendingMemes(), pollIntervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public getTrendingPairs(): TrendingMemePair[] {
    return this.trendingPairs;
  }

  public async refreshTrendingMemes(): Promise<TrendingMemePair[]> {
    if (this.isFetching) return this.trendingPairs;
    this.isFetching = true;

    try {
      const results = await Promise.all(
        DISCOVERY_QUERIES.map(async (query) => {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) return { pairs: [] };
            return await res.json();
          } catch {
            return { pairs: [] };
          }
        })
      );

      const allPairs = results.flatMap((r) => r.pairs || []);
      const seen = new Set<string>();
      const candidateList: TrendingMemePair[] = [];

      for (const pair of allPairs) {
        if (!pair || pair.chainId !== 'base') continue;
        const pairAddr = (pair.pairAddress || '').toLowerCase();
        if (!pairAddr || seen.has(pairAddr)) continue;
        seen.add(pairAddr);

        const liquidity = pair.liquidity?.usd || 0;
        const volume = pair.volume?.h24 || 0;

        // Liquidity and volume quality filter
        if (liquidity < 15000 || volume < 1000) continue;

        const baseSymbol = pair.baseToken?.symbol || 'UNKNOWN';
        const quoteSymbol = pair.quoteToken?.symbol || 'WETH';
        const dex = (pair.dexId || 'aerodrome').toLowerCase();
        const protocol: 'aerodrome_v2' | 'uniswap_v3' = dex.includes('uniswap') ? 'uniswap_v3' : 'aerodrome_v2';

        let category: 'MEME' | 'AI_AGENT' | 'DEFI' | 'BLUECHIP' = 'MEME';
        if (baseSymbol === 'VIRTUAL' || baseSymbol === 'CLANKER') category = 'AI_AGENT';
        else if (baseSymbol === 'AERO' || baseSymbol === 'USDC' || baseSymbol === 'WETH') category = 'DEFI';

        candidateList.push({
          symbol: `${baseSymbol} / ${quoteSymbol}`,
          name: `${pair.baseToken?.name || baseSymbol} (${dex.toUpperCase()})`,
          pairAddress: pair.pairAddress,
          baseTokenAddress: pair.baseToken?.address || '',
          quoteTokenAddress: pair.quoteToken?.address || BASE_TOKENS.WETH.address,
          dexId: dex,
          protocol,
          feeTier: protocol === 'uniswap_v3' ? '0.05%' : '0.30%',
          priceUsd: pair.priceUsd || '0',
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: volume,
          liquidityUsd: liquidity,
          trendingRank: 0,
          category,
        });
      }

      // Sort by 24h volume & liquidity
      candidateList.sort((a, b) => b.volume24h - a.volume24h);
      candidateList.forEach((p, idx) => (p.trendingRank = idx + 1));

      this.trendingPairs = candidateList.slice(0, 20);
      this.lastFetchTime = Date.now();

      // Dynamically register new pools into DexRegistry
      for (const p of this.trendingPairs) {
        if (!this.dexRegistry.getPool(p.pairAddress)) {
          this.dexRegistry.registerPool({
            chainId: 8453,
            name: p.name,
            address: p.pairAddress,
            factoryAddress:
              p.protocol === 'uniswap_v3'
                ? '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'
                : '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
            protocol: p.protocol,
            token0: {
              address: p.baseTokenAddress,
              symbol: p.symbol.split('/')[0].trim(),
              decimals: 18,
            },
            token1: {
              address: p.quoteTokenAddress || BASE_TOKENS.WETH.address,
              symbol: p.symbol.split('/')[1].trim(),
              decimals: 18,
            },
            feeNumerator: p.protocol === 'uniswap_v3' ? 500n : 30n,
            feeDenominator: p.protocol === 'uniswap_v3' ? 1000000n : 10000n,
            stable: false,
          });
        }
      }
    } catch (err) {
      // Keep previous list on transient network error
    } finally {
      this.isFetching = false;
    }

    return this.trendingPairs;
  }
}
