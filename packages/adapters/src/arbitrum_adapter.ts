import { EventEmitter } from 'node:events';
import { ethers } from 'ethers';
import { ChainEvent, DecodedSwapEvent } from './types.js';
import { DexRegistry, ARBITRUM_CHAIN_ID } from './dex_registry.js';
import { EventDecoder, SWAP_TOPICS } from './decoders.js';
import {
  ChainAdapter,
  ChainMetadata,
  SequencingTaxonomy,
  ChainCostParameters,
} from './chain_adapter.js';

export interface ArbitrumAdapterConfig {
  rpcUrl?: string;
  wsUrl?: string;
  chainId?: number;
}

export class ArbitrumChainAdapter extends EventEmitter implements ChainAdapter {
  public readonly metadata: ChainMetadata;
  public readonly sequencingTaxonomy: SequencingTaxonomy;

  private provider: ethers.JsonRpcProvider | null = null;
  private running: boolean = false;
  private dexRegistry: DexRegistry;

  constructor(config: ArbitrumAdapterConfig = {}, dexRegistry: DexRegistry) {
    super();
    this.dexRegistry = dexRegistry;
    this.metadata = {
      chainId: config.chainId || ARBITRUM_CHAIN_ID,
      name: 'Arbitrum One',
      nativeToken: 'ETH',
      rpcUrl: config.rpcUrl || 'https://arb1.arbitrum.io/rpc',
      wsUrl: config.wsUrl,
      blockExplorerUrl: 'https://arbiscan.io',
    };
    this.sequencingTaxonomy = {
      blockTimeMs: 250, // Sub-second sequencer pre-confirmations
      hasPreconfs: true,
      hasPublicMempool: false,
      sequencerModel: 'CENTRALIZED_L2',
      supportedStages: [
        'STAGE_PRECONF',
        'STAGE_BLOCK_INCLUSION',
        'STAGE_L1_BATCHED',
        'STAGE_L1_FINALIZED',
      ],
    };
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      this.provider = new ethers.JsonRpcProvider(this.metadata.rpcUrl, this.metadata.chainId);
      this.emit('connected', { source: 'ArbitrumChainAdapter', rpcUrl: this.metadata.rpcUrl });

      this.provider.on('block', async (blockNumber: number) => {
        const receivedTimestamp = Date.now();
        this.emit('block', { blockNumber, receivedTimestamp, chainId: this.metadata.chainId });
      });
    } catch (err: any) {
      this.emit('error', { message: 'Failed to connect to Arbitrum One adapter', error: err.message });
    }
  }

  public stop(): void {
    this.running = false;
    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider = null;
    }
    this.emit('disconnected', { chainId: this.metadata.chainId });
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getCostParameters(): ChainCostParameters {
    return {
      nativeTokenPriceUsd: 3000,
      baseFeeGwei: 0.01,
      priorityFeeGwei: 0.0,
      blobFeeGwei: 1.0,
      l1DataFeeScalar: 0.8,
      averageGasPerSwap: 120000n,
    };
  }

  public async fetchHistoricalBlockRange(
    fromBlock: number,
    toBlock: number,
    batchSize: number = 500
  ): Promise<DecodedSwapEvent[]> {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.metadata.rpcUrl, this.metadata.chainId);
    }

    const pools = this.dexRegistry.getPoolsByChain(this.metadata.chainId);
    const poolAddresses = pools.map(p => p.address);
    const allSwaps: DecodedSwapEvent[] = [];

    for (let current = fromBlock; current <= toBlock; current += batchSize) {
      const end = Math.min(current + batchSize - 1, toBlock);
      try {
        const logs = await this.provider.getLogs({
          fromBlock: current,
          toBlock: end,
          address: poolAddresses,
          topics: [[SWAP_TOPICS.V2_SWAP, SWAP_TOPICS.V3_SWAP]],
        });

        for (const log of logs) {
          const pool = this.dexRegistry.getPool(log.address, this.metadata.chainId);
          if (!pool) continue;

          let decoded: DecodedSwapEvent | null = null;
          if (log.topics[0] === SWAP_TOPICS.V2_SWAP) {
            decoded = EventDecoder.decodeV2Swap(log as any, pool);
          } else if (log.topics[0] === SWAP_TOPICS.V3_SWAP) {
            decoded = EventDecoder.decodeV3Swap(log as any, pool);
          }

          if (decoded) {
            allSwaps.push(decoded);
          }
        }
      } catch (err: any) {
        this.emit('warn', { message: `Log fetch error in block chunk ${current}-${end}: ${err.message}` });
      }
    }

    return allSwaps;
  }
}
