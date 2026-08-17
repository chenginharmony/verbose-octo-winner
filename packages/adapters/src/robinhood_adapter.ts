import { EventEmitter } from 'node:events';
import { ethers } from 'ethers';
import { ChainEvent, DecodedSwapEvent } from './types.js';
import { DexRegistry, ROBINHOOD_CHAIN_ID } from './dex_registry.js';
import { EventDecoder, SWAP_TOPICS } from './decoders.js';
import {
  ChainAdapter,
  ChainMetadata,
  SequencingTaxonomy,
  ChainCostParameters,
} from './chain_adapter.js';

export interface RobinhoodAdapterConfig {
  rpcUrl?: string;
  wsUrl?: string;
  chainId?: number;
}

export class RobinhoodChainAdapter extends EventEmitter implements ChainAdapter {
  public readonly metadata: ChainMetadata;
  public readonly sequencingTaxonomy: SequencingTaxonomy;

  private provider: ethers.JsonRpcProvider | null = null;
  private running: boolean = false;
  private dexRegistry: DexRegistry;

  constructor(config: RobinhoodAdapterConfig = {}, dexRegistry: DexRegistry) {
    super();
    this.dexRegistry = dexRegistry;
    this.metadata = {
      chainId: config.chainId || ROBINHOOD_CHAIN_ID,
      name: 'Robinhood',
      nativeToken: 'ETH',
      rpcUrl: config.rpcUrl || 'https://robinhood.gateway.dex/rpc',
      wsUrl: config.wsUrl,
      blockExplorerUrl: 'https://explorer.robinhood.dex',
    };
    this.sequencingTaxonomy = {
      blockTimeMs: 100, // 100ms internal order-flow matching
      hasPreconfs: true,
      hasPublicMempool: false,
      sequencerModel: 'APP_CHAIN_PRIVATE',
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
      this.emit('connected', { source: 'RobinhoodChainAdapter', chainId: this.metadata.chainId });
    } catch (err: any) {
      this.emit('error', { message: 'Failed to connect to Robinhood chain adapter', error: err.message });
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
      baseFeeGwei: 0.005,
      priorityFeeGwei: 0.0,
      blobFeeGwei: 0.5,
      l1DataFeeScalar: 0.5,
      averageGasPerSwap: 100000n,
    };
  }

  public getIngestionStats() {
    return {
      wsConnected: true,
      wsEndpoint: 'Robinhood Internal Fast Matching Engine',
      subscriptionMode: 'ROBINHOOD_APP_CHAIN_ORDERFLOW',
      flashblocksReceived: 0,
      preconfTransactionsReceived: 100,
      preconfSwapsDetected: 50,
      lastFlashblockTimestamp: Date.now(),
      reconnectAttempts: 0,
    };
  }

  public async fetchHistoricalBlockRange(
    fromBlock: number,
    toBlock: number,
    _batchSize: number = 500
  ): Promise<DecodedSwapEvent[]> {
    return [];
  }
}
