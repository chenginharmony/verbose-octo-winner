export type PoolVariant =
  | 'uniswap_v2'
  | 'uniswap_v3'
  | 'uniswap_v4'
  | 'aerodrome_v2_volatile'
  | 'aerodrome_v2_stable'
  | 'aerodrome_v3'
  | 'swapbased_v2'
  | 'sushiswap_v2'
  | 'sushiswap_v3'
  | 'pancakeswap_v2'
  | 'pancakeswap_v3';

export interface V2PoolState {
  reserve0: bigint;
  reserve1: bigint;
  feeNumerator: bigint; // e.g. 997n for 0.3% Uniswap V2 retained or 30n fee in Solidly
  feeDenominator: bigint; // e.g. 1000n or 10000n
}

export interface AerodromeV2PoolState {
  reserve0: bigint;
  reserve1: bigint;
  stable: boolean;
  feeNumerator: bigint; // fee fraction numerator, e.g. 30n for 0.3%
  feeDenominator: bigint; // fee fraction denominator, e.g. 10000n
  token0Decimals: number;
  token1Decimals: number;
}

export interface TickData {
  liquidityGross: bigint;
  liquidityNet: bigint;
  initialized: boolean;
}

export interface V3PoolState {
  sqrtPriceX96: bigint;
  currentTick: number;
  liquidity: bigint;
  fee: number; // fee in pips, e.g. 500 = 0.05%, 3000 = 0.3%
  tickSpacing: number;
  ticks: Map<number, TickData>;
  tickBitmap?: Map<number, bigint>;
}

export interface SwapSimulationResult {
  amountIn: bigint;
  amountOut: bigint;
  zeroForOne: boolean;
  priceImpact: number; // percentage, e.g. 0.0012 for 0.12%
  effectivePrice: number; // amountOut / amountIn normalized
  executionPriceX96?: bigint;
  newState: V2PoolState | AerodromeV2PoolState | V3PoolState;
}
