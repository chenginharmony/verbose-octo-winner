export type SequencerObservationStage = 
  | 'STAGE_PRECONF'          // Private preconfirmation / builder stream before block inclusion
  | 'STAGE_BLOCK_INCLUSION'  // L2 block header emitted / mined by sequencer (~2s on Base)
  | 'STAGE_L1_BATCHED'       // Batched & posted to Ethereum L1 via blob / calldata
  | 'STAGE_L1_FINALIZED';    // L1 block finalized (irreversible)

export interface ChainEvent {
  eventId: string;
  chainId: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number | null;
  sender: string | null;
  recipient: string | null;
  value: string | null;
  inputData: string | null;
  gasLimit: string | null;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  observedAt: number; // UNIX ms
  observationStage: SequencerObservationStage;
  source: 'BaseRPC' | 'BaseWebSocket' | 'BaseFlashblocks' | 'Replay' | 'HistoricalArchive';
  status: 'PENDING' | 'CONFIRMED' | 'DROPPED';
  rawLog?: any;
}

export interface LatencyRecord {
  sourceTimestamp: number;
  receivedTimestamp: number;
  decodedTimestamp: number;
  simulationStartTimestamp: number;
  simulationEndTimestamp: number;
  decisionTimestamp: number;
  paperExecutionTimestamp?: number;
  confirmationTimestamp?: number;
  // Computed latencies (ms)
  ingestionLatency: number;
  decodeLatency: number;
  simulationLatency: number;
  decisionLatency: number;
  totalLatency: number;
}

export type ExecutionMode = 'disabled' | 'simulation' | 'staging' | 'live';

export type OpportunityStatus = 
  | 'DETECTED'
  | 'SIMULATED'
  | 'QUALIFIED'
  | 'REJECTED'
  | 'STAGED'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVERTED'
  | 'LIVE_EXECUTION_DISABLED';

export interface TransactionPayload {
  chainId: number;
  to: string;
  data: string;
  value: bigint;
  gasLimit: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  description: string;
  estimatedGasCostUsd: number;
}

export interface ValidationCheckItem {
  name: string;
  passed: boolean;
  expected?: string;
  received?: string;
  message?: string;
}

export interface TransactionValidationResult {
  valid: boolean;
  checks: ValidationCheckItem[];
  errors: string[];
  warnings: string[];
  validatedAt: number;
}

export interface ExecutionResult {
  success: boolean;
  status: OpportunityStatus;
  mode: ExecutionMode;
  reason?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  totalFeeUsd?: number;
  grossProfitUsd?: number;
  netProfitUsd?: number;
  latencyMs?: number;
  revertReason?: string;
  stagedPayload?: TransactionPayload;
  timestamp: number;
}

export interface ExecutionAdapter {
  readonly mode: ExecutionMode;
  execute(opportunity: CanonicalSandwichOpportunity, payload?: TransactionPayload): Promise<ExecutionResult>;
  isLive(): boolean;
  getMode(): ExecutionMode;
}

export interface CanonicalSandwichOpportunity {
  id: string;
  chainId: number;
  timestamp: number;
  blockNumber: number;
  flashblockId?: string;

  // Target transaction details
  targetTransaction: {
    hash: string;
    sender: string;
    router: string;
    pool: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOutExpected?: bigint;
  };

  targetPool: DexPoolIdentity;
  targetToken: {
    address: string;
    symbol: string;
    decimals: number;
  };

  // Capital & Position Sizing
  victimAmountUsd: number;
  recommendedFrontRunSizeUsd: number;
  frontRunAmountIn: bigint;
  frontRunAmountOut: bigint;
  victimOutputEstimated: bigint;
  backRunAmountIn: bigint;
  backRunAmountOut: bigint;

  // Profitability Breakdown
  grossProfitUsd: number;
  estimatedGasCostUsd: number;
  estimatedL1DataFeeUsd: number;
  estimatedOrderingCostUsd: number;
  estimatedFailureCostUsd: number;
  estimatedNetProfitUsd: number;

  // Probability & EV
  executionProbability: number;
  survivalProbability: number;
  expectedValueUsd: number;
  capitalEfficiency: number;

  // Latency & Risk
  detectionLatencyMs: number;
  decisionLatencyMs: number;
  riskScore: number;
  priceImpact: number;

  // Lifecycle Status
  status: OpportunityStatus;
  rejectionReason?: string;
  explanation?: string;
}

export interface DexPoolIdentity {
  chainId: number;
  name: string;
  address: string;
  factoryAddress: string;
  protocol: 'aerodrome_v2' | 'aerodrome_v3' | 'uniswap_v2' | 'uniswap_v3' | 'uniswap_v4' | 'swapbased_v2';
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  feeNumerator: bigint;
  feeDenominator: bigint;
  stable?: boolean;
}

export interface DecodedSwapEvent {
  poolAddress: string;
  protocol: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  sender: string;
  recipient: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  observedAt: number;
  observationStage?: SequencerObservationStage;
}

export interface GroundTruthSwapTrace {
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  poolAddress: string;
  protocol: string;
  preState: {
    reserve0?: bigint;
    reserve1?: bigint;
    sqrtPriceX96?: bigint;
    tick?: number;
    liquidity?: bigint;
  };
  swapEvent: DecodedSwapEvent;
  postState: {
    reserve0?: bigint;
    reserve1?: bigint;
    sqrtPriceX96?: bigint;
    tick?: number;
    liquidity?: bigint;
  };
  receiptStatus: number; // 1 = success, 0 = reverted
}
