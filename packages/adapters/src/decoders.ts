import { ethers } from 'ethers';
import { DecodedSwapEvent, DexPoolIdentity } from './types.js';

export const SWAP_TOPICS = {
  // Uniswap V2 / Aerodrome V2 Swap
  V2_SWAP: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  // Uniswap V2 Sync
  V2_SYNC: '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
  // Uniswap V3 Swap
  V3_SWAP: '0xc42079f931a1e39a36e2394dd48e5459fa563d3add4c449bc33e1427743196ad',
};

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class EventDecoder {
  public static decodeV2Swap(
    log: { topics: string[]; data: string; address: string; transactionHash: string; blockNumber: number; index: number },
    pool: DexPoolIdentity
  ): DecodedSwapEvent | null {
    try {
      if (log.topics[0] !== SWAP_TOPICS.V2_SWAP) return null;

      const sender = ethers.getAddress('0x' + log.topics[1].slice(26));
      const recipient = ethers.getAddress('0x' + log.topics[2].slice(26));

      const decoded = ABI_CODER.decode(['uint256', 'uint256', 'uint256', 'uint256'], log.data);
      const amount0In = BigInt(decoded[0].toString());
      const amount1In = BigInt(decoded[1].toString());
      const amount0Out = BigInt(decoded[2].toString());
      const amount1Out = BigInt(decoded[3].toString());

      const zeroForOne = amount0In > 0n;
      const amountIn = zeroForOne ? amount0In : amount1In;
      const amountOut = zeroForOne ? amount1Out : amount0Out;

      return {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        sender,
        recipient,
        amount0In,
        amount1In,
        amount0Out,
        amount1Out,
        zeroForOne,
        amountIn,
        amountOut,
        tokenIn: zeroForOne ? pool.token0.symbol : pool.token1.symbol,
        tokenOut: zeroForOne ? pool.token1.symbol : pool.token0.symbol,
        observedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  public static decodeV3Swap(
    log: { topics: string[]; data: string; address: string; transactionHash: string; blockNumber: number; index: number },
    pool: DexPoolIdentity
  ): DecodedSwapEvent | null {
    try {
      if (log.topics[0] !== SWAP_TOPICS.V3_SWAP) return null;

      const sender = ethers.getAddress('0x' + log.topics[1].slice(26));
      const recipient = ethers.getAddress('0x' + log.topics[2].slice(26));

      const decoded = ABI_CODER.decode(['int256', 'int256', 'uint160', 'uint128', 'int24'], log.data);
      const amount0 = BigInt(decoded[0].toString());
      const amount1 = BigInt(decoded[1].toString());

      const zeroForOne = amount0 > 0n;
      const amountIn = zeroForOne ? amount0 : amount1;
      const amountOut = zeroForOne ? -amount1 : -amount0;

      return {
        poolAddress: pool.address,
        protocol: pool.protocol,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        sender,
        recipient,
        amount0In: amount0 > 0n ? amount0 : 0n,
        amount1In: amount1 > 0n ? amount1 : 0n,
        amount0Out: amount0 < 0n ? -amount0 : 0n,
        amount1Out: amount1 < 0n ? -amount1 : 0n,
        zeroForOne,
        amountIn,
        amountOut,
        tokenIn: zeroForOne ? pool.token0.symbol : pool.token1.symbol,
        tokenOut: zeroForOne ? pool.token1.symbol : pool.token0.symbol,
        observedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }
}
