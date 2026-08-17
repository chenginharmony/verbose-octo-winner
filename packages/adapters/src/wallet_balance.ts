import { ethers } from 'ethers';

export interface WalletOnChainBalance {
  address: string;
  ethBalance: string;
  ethBalanceRaw: bigint;
  ethPriceUsd: number;
  ethValueUsd: number;
  usdcBalance: string;
  usdcBalanceRaw: bigint;
  totalBalanceUsd: number;
  lastUpdated: number;
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Canonical USDC Addresses
const USDC_ADDRESSES: Record<number, string> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',     // Ethereum Mainnet
};

/**
 * WalletBalanceService
 * Fetches real on-chain native ETH and ERC-20 token balances for the configured hot wallet.
 * Strictly performs read-only JSON-RPC queries.
 */
export class WalletBalanceService {
  private provider: ethers.JsonRpcProvider | null = null;
  private chainId: number;
  private walletAddress: string;
  private cachedBalance: WalletOnChainBalance;

  constructor(rpcUrl: string, chainId: number, walletAddress: string) {
    this.chainId = chainId;
    this.walletAddress = (walletAddress || '').toLowerCase();
    this.cachedBalance = {
      address: this.walletAddress,
      ethBalance: '0.0',
      ethBalanceRaw: 0n,
      ethPriceUsd: 3000,
      ethValueUsd: 0.0,
      usdcBalance: '0.0',
      usdcBalanceRaw: 0n,
      totalBalanceUsd: 0.0,
      lastUpdated: 0,
    };

    // Determine reliable RPC URL (fallback to public RPC if private gateway is mock)
    let effectiveUrl = rpcUrl;
    if (rpcUrl.includes('gateway.dex') || rpcUrl.includes('localhost')) {
      effectiveUrl = chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' : 'https://mainnet.base.org';
    }

    try {
      this.provider = new ethers.JsonRpcProvider(effectiveUrl, undefined, {
        staticNetwork: true,
      });
    } catch {
      this.provider = null;
    }
  }

  public async fetchLiveBalance(ethPriceUsd: number = 3000): Promise<WalletOnChainBalance> {
    if (!this.walletAddress || !ethers.isAddress(this.walletAddress)) {
      return this.cachedBalance;
    }

    // 1. If targeting Robinhood Chain (421614), fetch directly from Robinhood Blockscout API
    if (this.chainId === 421614 || this.chainId === 0) {
      try {
        const res = await fetch(`https://robinhoodchain.blockscout.com/api/v2/addresses/${this.walletAddress}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.coin_balance !== undefined) {
            const ethRaw = BigInt(data.coin_balance);
            const ethFormatted = ethers.formatEther(ethRaw);
            const rate = parseFloat(data.exchange_rate) || ethPriceUsd;
            const ethValUsd = parseFloat(ethFormatted) * rate;

            this.cachedBalance = {
              address: this.walletAddress,
              ethBalance: ethFormatted,
              ethBalanceRaw: ethRaw,
              ethPriceUsd: rate,
              ethValueUsd: ethValUsd,
              usdcBalance: '0.0',
              usdcBalanceRaw: 0n,
              totalBalanceUsd: ethValUsd,
              lastUpdated: Date.now(),
            };
            return this.cachedBalance;
          }
        }
      } catch {
        // Fallback to standard provider
      }
    }

    try {
      if (!this.provider) {
        return this.cachedBalance;
      }

      // 1. Fetch Native ETH Balance via JSON-RPC
      const ethRaw = await this.provider.getBalance(this.walletAddress);
      const ethFormatted = ethers.formatEther(ethRaw);
      const ethValUsd = parseFloat(ethFormatted) * ethPriceUsd;

      // 2. Fetch USDC Balance if supported on this chain
      let usdcFormatted = '0.0';
      let usdcRaw = 0n;
      const usdcAddress = USDC_ADDRESSES[this.chainId];
      if (usdcAddress) {
        try {
          const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.provider);
          usdcRaw = await usdcContract.balanceOf(this.walletAddress);
          usdcFormatted = ethers.formatUnits(usdcRaw, 6);
        } catch {
          // Token balance query fallback
        }
      }

      const totalUsd = ethValUsd + parseFloat(usdcFormatted);

      this.cachedBalance = {
        address: this.walletAddress,
        ethBalance: ethFormatted,
        ethBalanceRaw: ethRaw,
        ethPriceUsd,
        ethValueUsd: ethValUsd,
        usdcBalance: usdcFormatted,
        usdcBalanceRaw: usdcRaw,
        totalBalanceUsd: totalUsd,
        lastUpdated: Date.now(),
      };

      return this.cachedBalance;
    } catch (err) {
      // Return cached balance if RPC error occurs
      return this.cachedBalance;
    }
  }

  public getCachedBalance(): WalletOnChainBalance {
    return { ...this.cachedBalance };
  }
}
