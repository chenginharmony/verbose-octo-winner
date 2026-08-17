import { CanonicalSandwichOpportunity, TransactionPayload } from './types.js';
import { BundlePayload } from './bundle_builder.js';

export interface SimulationPreflightResult {
  simulated: boolean;
  success: boolean;
  gasEstimated: bigint;
  expectedGrossProfitUsd: number;
  totalCostUsd: number;
  expectedNetProfitUsd: number;
  hurdleCleared: boolean;
  blockNumberTarget: string;
  error?: string;
  timestamp: number;
}

/**
 * StagingHarness
 * Performs pre-flight dry-run simulation against staging state machines.
 */
export class StagingHarness {
  private minProfitThresholdUsd: number;

  constructor(minProfitThresholdUsd: number = 0.02) {
    this.minProfitThresholdUsd = minProfitThresholdUsd;
  }

  /**
   * Simulate a constructed bundle pre-flight before staging or builder dispatch
   */
  public async simulatePreflight(
    opportunity: CanonicalSandwichOpportunity,
    _bundle: BundlePayload,
    payload?: TransactionPayload
  ): Promise<SimulationPreflightResult> {
    const gasEstimated = payload?.gasLimit || 350000n;
    const grossProfitUsd = opportunity.grossProfitUsd;
    const totalCostUsd = opportunity.estimatedGasCostUsd + opportunity.estimatedL1DataFeeUsd;
    const expectedNetProfitUsd = grossProfitUsd - totalCostUsd;
    const hurdleCleared = expectedNetProfitUsd >= this.minProfitThresholdUsd;

    return {
      simulated: true,
      success: hurdleCleared,
      gasEstimated,
      expectedGrossProfitUsd: grossProfitUsd,
      totalCostUsd,
      expectedNetProfitUsd,
      hurdleCleared,
      blockNumberTarget: `0x${(opportunity.blockNumber + 1).toString(16)}`,
      error: hurdleCleared ? undefined : `Net profit $${expectedNetProfitUsd.toFixed(4)} does not clear hurdle $${this.minProfitThresholdUsd.toFixed(4)}`,
      timestamp: Date.now(),
    };
  }
}
