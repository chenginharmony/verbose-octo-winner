export interface ChainCostParams {
  ethPriceUsd: number;
  l2BaseFeeGwei: number;
  l2PriorityFeeGwei: number;
  l1BlobBaseFeeGwei: number;
  l1DataFeeScalar?: number;
  estimatedL2GasUnits: bigint;
  estimatedL1DataBytes: number;
}

export interface EstimatedCostBreakdown {
  l2GasCostEth: number;
  l1DataCostEth: number;
  totalCostEth: number;
  totalCostUsd: number;
  assumptions: string;
}

/**
 * ChainCostModel
 * Multi-chain cost model computing exact L2 execution and L1 blob/calldata fees for Base and Robinhood ecosystems.
 */
export class ChainCostModel {
  private ethPriceUsd: number;
  private l2BaseFeeGwei: number;
  private l2PriorityFeeGwei: number;
  private l1BlobBaseFeeGwei: number;
  private l1DataFeeScalar: number;

  constructor(
    ethPriceUsd: number = 3000,
    l2BaseFeeGwei: number = 0.05,
    l2PriorityFeeGwei: number = 0.01,
    l1BlobBaseFeeGwei: number = 1.0,
    l1DataFeeScalar: number = 1.0
  ) {
    this.ethPriceUsd = ethPriceUsd;
    this.l2BaseFeeGwei = l2BaseFeeGwei;
    this.l2PriorityFeeGwei = l2PriorityFeeGwei;
    this.l1BlobBaseFeeGwei = l1BlobBaseFeeGwei;
    this.l1DataFeeScalar = l1DataFeeScalar;
  }

  public static createForBase(ethPriceUsd: number = 3000): ChainCostModel {
    return new ChainCostModel(ethPriceUsd, 0.05, 0.01, 1.0, 1.0);
  }

  public static createForArbitrum(ethPriceUsd: number = 3000): ChainCostModel {
    return new ChainCostModel(ethPriceUsd, 0.01, 0.0, 1.0, 0.8);
  }

  public static createForRobinhood(ethPriceUsd: number = 3000): ChainCostModel {
    return ChainCostModel.createForArbitrum(ethPriceUsd);
  }

  public updateMarketFees(
    ethPriceUsd?: number,
    l2BaseFeeGwei?: number,
    l2PriorityFeeGwei?: number,
    l1BlobBaseFeeGwei?: number
  ): void {
    if (ethPriceUsd !== undefined) this.ethPriceUsd = ethPriceUsd;
    if (l2BaseFeeGwei !== undefined) this.l2BaseFeeGwei = l2BaseFeeGwei;
    if (l2PriorityFeeGwei !== undefined) this.l2PriorityFeeGwei = l2PriorityFeeGwei;
    if (l1BlobBaseFeeGwei !== undefined) this.l1BlobBaseFeeGwei = l1BlobBaseFeeGwei;
  }

  public calculateCost(
    gasUnits: bigint = 150000n,
    dataBytes: number = 160
  ): EstimatedCostBreakdown {
    // 1. L2 Execution Fee
    const effectiveL2GasPriceGwei = this.l2BaseFeeGwei + this.l2PriorityFeeGwei;
    const l2GasCostEth = (Number(gasUnits) * effectiveL2GasPriceGwei) / 1e9;

    // 2. L1 Data Fee (EIP-4844 / Rollup Formula)
    const l1DataCostEth = (dataBytes * 16 * this.l1BlobBaseFeeGwei * this.l1DataFeeScalar) / 1e9;

    const totalCostEth = l2GasCostEth + l1DataCostEth;
    const totalCostUsd = totalCostEth * this.ethPriceUsd;

    return {
      l2GasCostEth,
      l1DataCostEth,
      totalCostEth,
      totalCostUsd,
      assumptions: `ETH=$${this.ethPriceUsd}, L2Fee=${effectiveL2GasPriceGwei.toFixed(4)}gwei, L1BlobFee=${this.l1BlobBaseFeeGwei}gwei, Gas=${gasUnits}`,
    };
  }

  public getEthPriceUsd(): number {
    return this.ethPriceUsd;
  }
}

// Backwards-compatible aliases
export type BaseCostModel = ChainCostModel;
export const BaseCostModel = ChainCostModel;
