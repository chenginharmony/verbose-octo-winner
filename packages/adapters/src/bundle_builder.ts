import { CanonicalSandwichOpportunity, TransactionPayload } from './types.js';

export interface BundlePayload {
  txs: string[];
  blockNumber: string; // Hex string e.g. "0x1534a2"
  minTimestamp?: number;
  maxTimestamp?: number;
  revertingTxHashes?: string[];
  replacementUuid?: string;
}

export interface JsonRpcBundleRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'eth_sendBundle' | 'mev_sendBundle';
  params: [BundlePayload];
}

export interface BundleBuilderConfig {
  defaultMaxTimestampWindowMs?: number;
  revertingTxHashesAllowed?: boolean;
}

/**
 * BundleBuilder
 * Encapsulates standard Flashbots / Titan / Base Flashblocks private bundle construction.
 */
export class BundleBuilder {
  private defaultMaxTimestampWindowMs: number;

  constructor(config: BundleBuilderConfig = {}) {
    this.defaultMaxTimestampWindowMs = config.defaultMaxTimestampWindowMs || 2500;
  }

  /**
   * Build standard private bundle payload for atomic submission
   */
  public buildBundle(
    opportunity: CanonicalSandwichOpportunity,
    frontRunTxHex: string,
    backRunTxHex: string,
    options: { targetBlockOffset?: number; customTxs?: string[] } = {}
  ): BundlePayload {
    const targetBlock = opportunity.blockNumber + (options.targetBlockOffset || 1);
    const now = Math.floor(Date.now() / 1000);

    const txs: string[] = options.customTxs || [
      frontRunTxHex,
      opportunity.targetTransaction.hash, // Victim transaction inclusion
      backRunTxHex,
    ];

    return {
      txs,
      blockNumber: `0x${targetBlock.toString(16)}`,
      minTimestamp: now,
      maxTimestamp: now + Math.ceil(this.defaultMaxTimestampWindowMs / 1000),
      revertingTxHashes: [],
    };
  }

  /**
   * Format as standard JSON-RPC request for builder endpoints
   */
  public formatJsonRpcRequest(
    bundle: BundlePayload,
    method: 'eth_sendBundle' | 'mev_sendBundle' = 'eth_sendBundle',
    reqId: number = 1
  ): JsonRpcBundleRequest {
    return {
      jsonrpc: '2.0',
      id: reqId,
      method,
      params: [bundle],
    };
  }
}
