import { EventEmitter } from 'node:events';
import { ethers } from 'ethers';
import WebSocket from 'ws';
import { ChainEvent, DecodedSwapEvent } from './types.js';
import { DexRegistry } from './dex_registry.js';
import { EventDecoder, SWAP_TOPICS } from './decoders.js';
import {
  ChainAdapter,
  ChainMetadata,
  SequencingTaxonomy,
  ChainCostParameters,
} from './chain_adapter.js';

export interface BaseDataAdapterConfig {
  rpcUrl?: string;
  wsUrl?: string;
  flashblocksWsUrl?: string;
  chainId?: number;
  enableFlashblocks?: boolean;
}

export interface IngestionStats {
  wsConnected: boolean;
  wsEndpoint: string | null;
  subscriptionMode: string;
  flashblocksReceived: number;
  preconfTransactionsReceived: number;
  preconfSwapsDetected: number;
  lastFlashblockTimestamp: number | null;
  reconnectAttempts: number;
}

export class BaseChainAdapter extends EventEmitter implements ChainAdapter {
  public readonly metadata: ChainMetadata;
  public readonly sequencingTaxonomy: SequencingTaxonomy;

  private provider: ethers.JsonRpcProvider | null = null;
  private ws: WebSocket | null = null;
  private wsHeartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private dexRegistry: DexRegistry;

  // Subscription management
  private subMap: Map<string, string> = new Map(); // subId -> 'newFlashblocks' | 'newFlashblockTransactions' | 'logs'
  private reqMap: Map<number, string> = new Map(); // reqId -> subType
  private reconnectDelay: number = 2000;
  private reconnectAttempts: number = 0;

  // Ingestion metrics
  private flashblocksCount: number = 0;
  private preconfTxCount: number = 0;
  private preconfSwapsCount: number = 0;
  private lastFlashblockTimestamp: number | null = null;

  constructor(config: BaseDataAdapterConfig = {}, dexRegistry: DexRegistry) {
    super();
    this.dexRegistry = dexRegistry;
    this.metadata = {
      chainId: config.chainId || 8453,
      name: 'Base',
      nativeToken: 'ETH',
      rpcUrl: config.rpcUrl || 'https://mainnet.base.org',
      wsUrl: config.flashblocksWsUrl || config.wsUrl,
      blockExplorerUrl: 'https://basescan.org',
    };
    this.sequencingTaxonomy = {
      blockTimeMs: 2000,
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

    // 1. Initialize HTTP JSON-RPC Provider for state reads, block numbers, and fallback
    try {
      this.provider = new ethers.JsonRpcProvider(this.metadata.rpcUrl, this.metadata.chainId);
      this.emit('connected', { source: 'BaseChainAdapter', rpcUrl: this.metadata.rpcUrl });

      this.provider.on('block', async (blockNumber: number) => {
        const receivedTimestamp = Date.now();
        this.emit('block', { blockNumber, receivedTimestamp, chainId: this.metadata.chainId });
      });

      this.startLogPoller();
    } catch (err: any) {
      this.emit('error', { message: 'Failed to connect to Base chain HTTP RPC', error: err.message });
    }

    // 2. Initialize Alchemy Base WebSocket & Flashblocks Stream
    if (this.metadata.wsUrl) {
      this.startWebSocket();
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getCostParameters(): ChainCostParameters {
    return {
      nativeTokenPriceUsd: 3000,
      baseFeeGwei: 0.05,
      priorityFeeGwei: 0.01,
      blobFeeGwei: 1.0,
      l1DataFeeScalar: 1.0,
      averageGasPerSwap: 150000n,
    };
  }

  public getIngestionStats(): IngestionStats {
    return {
      wsConnected: this.ws !== null && this.ws.readyState === WebSocket.OPEN,
      wsEndpoint: this.metadata.wsUrl ? this.metadata.wsUrl.replace(/(v2\/)[^/?]+/, '$1***') : null,
      subscriptionMode: this.ws !== null ? 'ALCHEMY_FLASHBLOCKS_STREAM' : 'RPC_LOG_POLLING',
      flashblocksReceived: this.flashblocksCount,
      preconfTransactionsReceived: this.preconfTxCount,
      preconfSwapsDetected: this.preconfSwapsCount,
      lastFlashblockTimestamp: this.lastFlashblockTimestamp,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Connect to Alchemy WebSocket and open specialized Flashblock & targeted DEX subscriptions
   */
  private startWebSocket(): void {
    if (!this.running || !this.metadata.wsUrl) return;

    try {
      const ws = new WebSocket(this.metadata.wsUrl);
      this.ws = ws;

      ws.on('open', () => {
        this.reconnectDelay = 2000;
        this.reconnectAttempts = 0;
        this.emit('ws_connected', {
          source: 'BaseFlashblocksWebSocket',
          url: this.metadata.wsUrl?.replace(/(v2\/)[^/?]+/, '$1***'),
        });

        // 1. Subscribe to newFlashblockTransactions (streams ~200ms preconfirmed transactions)
        const reqIdTx = 101;
        this.reqMap.set(reqIdTx, 'newFlashblockTransactions');
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: reqIdTx,
            method: 'eth_subscribe',
            params: ['newFlashblockTransactions', true],
          })
        );

        // 2. Subscribe to newFlashblocks (streams 200ms preconf block header metadata)
        const reqIdFb = 102;
        this.reqMap.set(reqIdFb, 'newFlashblocks');
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: reqIdFb,
            method: 'eth_subscribe',
            params: ['newFlashblocks'],
          })
        );

        // 3. Narrow targeted subscription: Monitor DEX swap logs on watched pools
        // Bandwidth optimized: filter only watched pools and swap topics
        const pools = this.dexRegistry.getPoolsByChain(this.metadata.chainId);
        const poolAddresses = pools.map((p) => p.address);
        if (poolAddresses.length > 0) {
          const reqIdLogs = 103;
          this.reqMap.set(reqIdLogs, 'logs');
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: reqIdLogs,
              method: 'eth_subscribe',
              params: [
                'logs',
                {
                  address: poolAddresses,
                  topics: [[SWAP_TOPICS.V2_SWAP, SWAP_TOPICS.V3_SWAP]],
                },
              ],
            })
          );
        }

        // Keep-alive heartbeat ping every 20s
        if (this.wsHeartbeatInterval) clearInterval(this.wsHeartbeatInterval);
        this.wsHeartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        }, 20000);
      });

      ws.on('message', (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());

          // Handle subscription confirmation
          if (msg.id && this.reqMap.has(msg.id) && msg.result) {
            const subType = this.reqMap.get(msg.id)!;
            this.subMap.set(msg.result, subType);
            this.reqMap.delete(msg.id);
            return;
          }

          // Handle incoming subscription data
          if (msg.method === 'eth_subscription' && msg.params) {
            const { subscription, result } = msg.params;
            const subType = this.subMap.get(subscription);

            if (subType === 'newFlashblocks') {
              this.handleFlashblockHeader(result);
            } else if (subType === 'newFlashblockTransactions') {
              this.handleFlashblockTransaction(result);
            } else if (subType === 'logs') {
              this.handleFlashblockLog(result);
            } else {
              // Generic log fallback
              if (result && result.topics) {
                this.handleFlashblockLog(result);
              }
            }
          }
        } catch (e: any) {
          this.emit('warn', { message: 'Error parsing WebSocket message', error: e.message });
        }
      });

      ws.on('error', (err: Error) => {
        this.emit('warn', { message: 'Alchemy Flashblocks WebSocket error', error: err.message });
      });

      ws.on('close', () => {
        this.ws = null;
        if (this.wsHeartbeatInterval) {
          clearInterval(this.wsHeartbeatInterval);
          this.wsHeartbeatInterval = null;
        }
        this.subMap.clear();

        if (this.running) {
          this.reconnectAttempts++;
          const delay = Math.min(this.reconnectDelay * 2, 30000);
          this.reconnectDelay = delay;
          this.emit('warn', {
            message: `Flashblocks WebSocket disconnected. Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})...`,
          });
          this.reconnectTimeout = setTimeout(() => {
            this.startWebSocket();
          }, delay);
        }
      });
    } catch (err: any) {
      this.emit('warn', { message: 'Failed to initiate Flashblocks WebSocket', error: err.message });
    }
  }

  private handleFlashblockHeader(data: any): void {
    this.flashblocksCount++;
    this.lastFlashblockTimestamp = Date.now();

    const blockNumber = data?.blockNumber ? Number(data.blockNumber) : Number(data?.number || 0);
    const index = data?.index !== undefined ? Number(data.index) : 0;

    this.emit('flashblock', {
      blockNumber,
      index,
      baseFeePerGas: data?.baseFeePerGas || null,
      timestamp: this.lastFlashblockTimestamp,
      source: 'BaseFlashblocks',
      stage: 'STAGE_PRECONF',
    });
  }

  private handleFlashblockTransaction(tx: any): void {
    if (!tx) return;
    this.preconfTxCount++;
    const now = Date.now();

    const toAddress = (tx.to || '').toLowerCase();
    const fromAddress = (tx.from || '').toLowerCase();
    const txHash = tx.hash || tx.transactionHash || `0x${Date.now().toString(16)}`;

    const chainEvent: ChainEvent = {
      eventId: `${txHash}-preconf`,
      chainId: this.metadata.chainId,
      blockNumber: tx.blockNumber ? Number(tx.blockNumber) : 0,
      transactionHash: txHash,
      logIndex: null,
      sender: fromAddress || null,
      recipient: toAddress || null,
      value: tx.value ? tx.value.toString() : '0',
      inputData: tx.input || tx.data || null,
      gasLimit: tx.gas ? tx.gas.toString() : null,
      maxFeePerGas: tx.maxFeePerGas ? tx.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? tx.maxPriorityFeePerGas.toString() : null,
      observedAt: now,
      observationStage: 'STAGE_PRECONF',
      source: 'BaseFlashblocks',
      status: 'PENDING',
      rawLog: tx,
    };

    this.emit('event', chainEvent);

    // If the transaction has embedded logs (e.g. simulated preconf logs)
    if (Array.isArray(tx.logs)) {
      for (const log of tx.logs) {
        this.handleFlashblockLog(log);
      }
    }
  }

  private handleFlashblockLog(log: any): void {
    if (!log || !log.address) return;
    const now = Date.now();

    const pool = this.dexRegistry.getPool(log.address, this.metadata.chainId);
    if (!pool) return;

    const chainEvent: ChainEvent = {
      eventId: `${log.transactionHash || 'tx'}-${log.logIndex || log.index || 0}`,
      chainId: this.metadata.chainId,
      blockNumber: Number(log.blockNumber || 0),
      transactionHash: log.transactionHash || '',
      logIndex: Number(log.logIndex || log.index || 0),
      sender: null,
      recipient: null,
      value: null,
      inputData: log.data,
      gasLimit: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      observedAt: now,
      observationStage: 'STAGE_PRECONF',
      source: 'BaseFlashblocks',
      status: 'PENDING',
      rawLog: log,
    };

    this.emit('event', chainEvent);

    const decoded = pool.protocol.includes('v3')
      ? EventDecoder.decodeV3Swap(log as any, pool)
      : EventDecoder.decodeV2Swap(log as any, pool);

    if (decoded) {
      decoded.observationStage = 'STAGE_PRECONF';
      this.preconfSwapsCount++;
      this.emit('swap', decoded);
    }
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
    const poolAddresses = pools.map((p) => p.address);
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
          if (pool) {
            const decoded = pool.protocol.includes('v3')
              ? EventDecoder.decodeV3Swap(log as any, pool)
              : EventDecoder.decodeV2Swap(log as any, pool);
            if (decoded) {
              decoded.observationStage = 'STAGE_BLOCK_INCLUSION';
              allSwaps.push(decoded);
            }
          }
        }
      } catch (err: any) {
        this.emit('warn', { message: `Failed fetching range ${current}-${end}`, error: err.message });
      }
    }

    return allSwaps;
  }

  /**
   * Periodic log poller for finalized blocks and fallback when WebSocket is offline
   */
  private async startLogPoller(): Promise<void> {
    if (!this.provider) return;

    let lastBlock = await this.provider.getBlockNumber().catch(() => 0);

    const poll = async () => {
      if (!this.running || !this.provider) return;

      try {
        const currentBlock = await this.provider.getBlockNumber();
        if (currentBlock > lastBlock) {
          const fromBlock = Math.max(lastBlock + 1, currentBlock - 5);
          const pools = this.dexRegistry.getPoolsByChain(this.metadata.chainId);
          const poolAddresses = pools.map((p) => p.address);

          const logs = await this.provider
            .getLogs({
              fromBlock,
              toBlock: currentBlock,
              address: poolAddresses,
              topics: [[SWAP_TOPICS.V2_SWAP, SWAP_TOPICS.V3_SWAP]],
            })
            .catch(() => []);

          const now = Date.now();

          for (const log of logs) {
            const chainEvent: ChainEvent = {
              eventId: `${log.transactionHash}-${log.index}`,
              chainId: this.metadata.chainId,
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              logIndex: log.index,
              sender: null,
              recipient: null,
              value: null,
              inputData: log.data,
              gasLimit: null,
              maxFeePerGas: null,
              maxPriorityFeePerGas: null,
              observedAt: now,
              observationStage: 'STAGE_BLOCK_INCLUSION',
              source: 'BaseRPC',
              status: 'CONFIRMED',
              rawLog: log,
            };

            this.emit('event', chainEvent);

            const pool = this.dexRegistry.getPool(log.address, this.metadata.chainId);
            if (pool) {
              const decoded = pool.protocol.includes('v3')
                ? EventDecoder.decodeV3Swap(log as any, pool)
                : EventDecoder.decodeV2Swap(log as any, pool);

              if (decoded) {
                decoded.observationStage = 'STAGE_BLOCK_INCLUSION';
                this.emit('swap', decoded);
              }
            }
          }

          lastBlock = currentBlock;
        }
      } catch (e: any) {
        this.emit('warn', { message: 'Log polling error', error: e.message });
      }

      if (this.running) {
        // If WebSocket is active, poll less frequently; otherwise poll every 2s
        const interval = this.ws && this.ws.readyState === WebSocket.OPEN ? 5000 : 2000;
        setTimeout(poll, interval);
      }
    };

    setTimeout(poll, 1000);
  }

  public stop(): void {
    this.running = false;
    if (this.wsHeartbeatInterval) {
      clearInterval(this.wsHeartbeatInterval);
      this.wsHeartbeatInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (this.provider) {
      this.provider.removeAllListeners();
    }
    this.emit('disconnected', { source: 'BaseChainAdapter' });
  }
}

// Backwards compatibility alias
export const BaseDataAdapter = BaseChainAdapter;
