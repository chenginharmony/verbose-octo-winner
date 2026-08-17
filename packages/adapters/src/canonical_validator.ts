import { ethers } from 'ethers';
import {
  BASE_FACTORIES,
  BASE_TOKENS,
  ARBITRUM_FACTORIES,
  ARBITRUM_TOKENS,
  ROBINHOOD_FACTORIES,
  ROBINHOOD_TOKENS,
  DexRegistry,
} from './dex_registry.js';
import { DexPoolIdentity } from './types.js';

export interface ValidationItemResult {
  target: string;
  name: string;
  type: 'FACTORY' | 'TOKEN' | 'POOL';
  address: string;
  status: 'VALID' | 'INVALID' | 'WARN';
  details: string;
  onChainVerified?: boolean;
}

export interface CanonicalAuditReport {
  timestamp: number;
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  warnCount: number;
  passed: boolean;
  allValid: boolean;
  items: ValidationItemResult[];
  results: ValidationItemResult[];
}

export class CanonicalValidator {
  private registry: DexRegistry;
  private provider: ethers.JsonRpcProvider | null = null;

  constructor(registry: DexRegistry, rpcUrl?: string) {
    this.registry = registry;
    if (rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl, 8453);
    }
  }

  public validateStaticRegistry(): CanonicalAuditReport {
    const items: ValidationItemResult[] = [];

    // 1. Audit Base, Arbitrum & Robinhood Factory Addresses
    for (const [name, address] of Object.entries({ ...BASE_FACTORIES, ...ARBITRUM_FACTORIES, ...ROBINHOOD_FACTORIES })) {
      const isValidAddress = ethers.isAddress(address);
      items.push({
        target: 'FACTORY',
        name,
        type: 'FACTORY',
        address,
        status: isValidAddress ? 'VALID' : 'INVALID',
        details: isValidAddress ? 'Valid EVM address format' : 'Invalid hex address format',
      });
    }

    // 2. Audit Token Specs (Base, Arbitrum & Robinhood)
    for (const [symbol, token] of Object.entries({ ...BASE_TOKENS, ...ARBITRUM_TOKENS, ...ROBINHOOD_TOKENS })) {
      const isValidAddress = ethers.isAddress(token.address);
      const isExpectedDecimals =
        (symbol === 'USDC' || symbol === 'USDbC') ? token.decimals === 6 : (symbol === 'BTC' ? token.decimals === 8 : token.decimals === 18);

      const valid = isValidAddress && isExpectedDecimals;
      items.push({
        target: 'TOKEN',
        name: symbol,
        type: 'TOKEN',
        address: token.address,
        status: valid ? 'VALID' : 'INVALID',
        details: `Decimals: ${token.decimals} (Expected: ${isExpectedDecimals ? 'OK' : 'MISMATCH'}), Address: ${isValidAddress ? 'OK' : 'INVALID'}`,
      });
    }

    // 3. Audit Registered Pools across all chains
    const pools = this.registry.getAllPools();
    for (const pool of pools) {
      const isValidPoolAddress = ethers.isAddress(pool.address);
      const isValidFactory = ethers.isAddress(pool.factoryAddress);
      const tokensValid = ethers.isAddress(pool.token0.address) && ethers.isAddress(pool.token1.address);
      const tokensDistinct = pool.token0.address.toLowerCase() !== pool.token1.address.toLowerCase();

      const valid = isValidPoolAddress && isValidFactory && tokensValid && tokensDistinct;
      items.push({
        target: 'POOL',
        name: pool.name,
        type: 'POOL',
        address: pool.address,
        status: valid ? 'VALID' : 'INVALID',
        details: `Chain: ${pool.chainId}, Protocol: ${pool.protocol}, Token0: ${pool.token0.symbol} (${pool.token0.decimals}d), Token1: ${pool.token1.symbol} (${pool.token1.decimals}d)`,
      });
    }

    const invalidCount = items.filter(i => i.status === 'INVALID').length;
    const warnCount = items.filter(i => i.status === 'WARN').length;
    const validCount = items.filter(i => i.status === 'VALID').length;

    return {
      timestamp: Date.now(),
      totalChecked: items.length,
      validCount,
      invalidCount,
      warnCount,
      passed: invalidCount === 0,
      allValid: invalidCount === 0,
      items,
      results: items,
    };
  }

  public async validateOnChain(): Promise<CanonicalAuditReport> {
    const report = this.validateStaticRegistry();
    if (!this.provider) {
      return report;
    }

    for (const item of report.items) {
      try {
        const code = await this.provider.getCode(item.address);
        if (code === '0x' || code.length <= 2) {
          item.status = 'INVALID';
          item.details += ' | ON-CHAIN ERROR: No bytecode at address (EOA or un-deployed)';
          item.onChainVerified = false;
        } else {
          item.onChainVerified = true;
          item.details += ` | Bytecode verified (${(code.length - 2) / 2} bytes)`;
        }
      } catch (err: any) {
        item.status = 'WARN';
        item.details += ` | RPC Verification Warn: ${err.message}`;
      }
    }

    report.invalidCount = report.items.filter((i: ValidationItemResult) => i.status === 'INVALID').length;
    report.warnCount = report.items.filter((i: ValidationItemResult) => i.status === 'WARN').length;
    report.validCount = report.items.filter((i: ValidationItemResult) => i.status === 'VALID').length;
    report.passed = report.invalidCount === 0;
    report.allValid = report.invalidCount === 0;
    report.results = report.items;

    return report;
  }
}
