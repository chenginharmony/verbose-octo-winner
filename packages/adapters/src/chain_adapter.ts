import { EventEmitter } from 'node:events';
import { DecodedSwapEvent, SequencerObservationStage, ChainEvent } from './types.js';

export interface ChainCostParameters {
  nativeTokenPriceUsd: number;
  baseFeeGwei: number;
  priorityFeeGwei: number;
  blobFeeGwei?: number;
  l1DataFeeScalar?: number;
  averageGasPerSwap: bigint;
}

export interface SequencingTaxonomy {
  blockTimeMs: number;
  hasPreconfs: boolean;
  hasPublicMempool: boolean;
  sequencerModel: 'CENTRALIZED_L2' | 'DECENTRALIZED_P2P' | 'APP_CHAIN_PRIVATE';
  supportedStages: SequencerObservationStage[];
}

export interface ChainMetadata {
  chainId: number;
  name: string;
  nativeToken: string;
  rpcUrl: string;
  wsUrl?: string;
  blockExplorerUrl?: string;
}

export interface ChainAdapter extends EventEmitter {
  readonly metadata: ChainMetadata;
  readonly sequencingTaxonomy: SequencingTaxonomy;
  
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  
  fetchHistoricalBlockRange(fromBlock: number, toBlock: number, batchSize?: number): Promise<DecodedSwapEvent[]>;
  getCostParameters(): ChainCostParameters;
}
