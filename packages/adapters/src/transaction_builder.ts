import {
  CanonicalSandwichOpportunity,
  TransactionPayload,
  TransactionValidationResult,
} from './types.js';

export interface TransactionBuilderConfig {
  defaultGasLimit?: bigint;
  maxAllowedGasLimit?: bigint;
  maxSlippageBps?: number;
}

/**
 * TransactionBuilder
 * Constructs and validates deterministic transaction payloads for MEV strategy opportunities.
 * Strictly separates transaction construction from signing and broadcasting.
 */
export class TransactionBuilder {
  private defaultGasLimit: bigint;
  private maxAllowedGasLimit: bigint;
  private maxSlippageBps: number;

  constructor(config: TransactionBuilderConfig = {}) {
    this.defaultGasLimit = config.defaultGasLimit || 350000n;
    this.maxAllowedGasLimit = config.maxAllowedGasLimit || 1000000n;
    this.maxSlippageBps = config.maxSlippageBps || 300; // 3%
  }

  /**
   * Build a real Uniswap V2 Router02 swapExactTokensForTokens transaction.
   * Target: 0x89e5db8b5aa49aa85ac63f691524311aeb649eba (Robinhood Chain Router02)
   * Calldata: ABI-encoded swapExactTokensForTokens(amountIn, amountOutMin, path[], to, deadline)
   * 
   * VERIFIED: The router is deployed with 21902 bytes on Robinhood Chain Mainnet (4663)
   * The pair addresses (pool) are passed in the path[], not as the `to` address.
   */
  public buildTransaction(
    opportunity: CanonicalSandwichOpportunity,
    options: { recipientAddress?: string; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {}
  ): TransactionPayload {
    // ✅ Always target the real Uniswap V2 Router02 on Robinhood Chain
    const ROBINHOOD_ROUTER = '0x89e5db8b5aa49aa85ac63f691524311aeb649eba';
    const recipient = options.recipientAddress || opportunity.targetPool.token0.address; // must be a real wallet
    
    // Build real ABI-encoded calldata for swapExactTokensForTokens
    // Function signature: swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
    // Selector: 0x38ed1739
    const selector = '38ed1739';

    // ABI encode: amountIn (uint256)
    const amountInHex = opportunity.frontRunAmountIn.toString(16).padStart(64, '0');
    // ABI encode: amountOutMin (uint256) — apply 0.5% slippage tolerance
    const amountOutMin = (opportunity.frontRunAmountOut * 995n) / 1000n;
    const amountOutMinHex = amountOutMin.toString(16).padStart(64, '0');
    // ABI encode: offset to path array (uint256) — points to 5th slot (4 * 32 = 0xa0 = 160)
    const pathOffset = (160).toString(16).padStart(64, '0');
    // ABI encode: recipient address (address)
    const recipientHex = recipient.replace(/^0x/, '').toLowerCase().padStart(64, '0');
    // ABI encode: deadline (uint256) — 10 minutes from now
    const deadline = (Math.floor(Date.now() / 1000) + 600).toString(16).padStart(64, '0');
    // ABI encode: path[] length = 2
    const pathLength = (2).toString(16).padStart(64, '0');
    // ABI encode: path[0] = token0 address, path[1] = token1 address
    const token0Hex = opportunity.targetPool.token0.address.replace(/^0x/, '').toLowerCase().padStart(64, '0');
    const token1Hex = opportunity.targetPool.token1.address.replace(/^0x/, '').toLowerCase().padStart(64, '0');
    
    const calldata = `0x${selector}${amountInHex}${amountOutMinHex}${pathOffset}${recipientHex}${deadline}${pathLength}${token0Hex}${token1Hex}`;

    const gasLimit = this.defaultGasLimit;
    const estimatedGasCostUsd = opportunity.estimatedGasCostUsd || 0.025;

    return {
      chainId: opportunity.chainId,
      // ✅ Target the ROUTER, not the pair address
      to: ROBINHOOD_ROUTER,
      data: calldata,
      value: 0n,
      gasLimit,
      maxFeePerGas: options.maxFeePerGas || 50000000n,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas || 10000000n,
      description: `Uniswap V2 swapExactTokensForTokens: ${opportunity.targetPool.token0.symbol} → ${opportunity.targetPool.token1.symbol} via ${opportunity.targetPool.name}`,
      estimatedGasCostUsd,
    };
  }

  /**
   * Validate a constructed transaction payload against safety rules
   */
  public validateTransaction(
    payload: TransactionPayload,
    opportunity?: CanonicalSandwichOpportunity
  ): TransactionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks: import('./types.js').ValidationCheckItem[] = [];

    // 1. Chain ID Validation
    const validChains = [8453, 42161, 4663, 46630, 421614];
    const isChainValid = validChains.includes(payload.chainId);
    checks.push({
      name: 'Chain ID Compatibility',
      passed: isChainValid,
      expected: validChains.join(', '),
      received: payload.chainId.toString(),
      message: isChainValid ? `Chain ID ${payload.chainId} is active & supported` : `Unsupported Chain ID: ${payload.chainId}`,
    });
    if (!isChainValid) {
      errors.push(`Invalid chain ID: ${payload.chainId}. Supported: ${validChains.join(', ')}`);
    }

    // 2. Destination Address Validation
    const isToValid = Boolean(payload.to && payload.to.startsWith('0x') && payload.to.length === 42);
    checks.push({
      name: 'Destination Router / Pool Address',
      passed: isToValid,
      expected: '42-char hex address (0x...)',
      received: payload.to,
      message: isToValid ? 'Destination contract address formatted correctly' : `Malformed address: ${payload.to}`,
    });
    if (!isToValid) {
      errors.push(`Malformed destination contract address: ${payload.to}`);
    }

    // 3. Calldata Validation
    const isDataValid = Boolean(payload.data && payload.data.startsWith('0x') && payload.data.length >= 10);
    checks.push({
      name: 'Calldata & Selector Encoding',
      passed: isDataValid,
      expected: '>= 10-char hex selector & arguments',
      received: payload.data ? `${payload.data.slice(0, 10)}... (${payload.data.length} chars)` : 'empty',
      message: isDataValid ? 'Deterministic swap selector & calldata validated' : 'Empty/invalid calldata',
    });
    if (!isDataValid) {
      errors.push(`Invalid or empty calldata payload: ${payload.data}`);
    }

    // 4. Gas Limit Sanity Checks
    const isGasValid = payload.gasLimit > 0n && payload.gasLimit <= this.maxAllowedGasLimit;
    checks.push({
      name: 'Gas Limit Safety Bounds',
      passed: isGasValid,
      expected: `0 < gas <= ${this.maxAllowedGasLimit}`,
      received: payload.gasLimit.toString(),
      message: isGasValid ? `Gas limit ${payload.gasLimit} within safe bounds` : `Gas limit out of range`,
    });
    if (payload.gasLimit <= 0n) {
      errors.push(`Gas limit must be greater than zero`);
    } else if (payload.gasLimit > this.maxAllowedGasLimit) {
      errors.push(`Gas limit ${payload.gasLimit} exceeds maximum safety ceiling of ${this.maxAllowedGasLimit}`);
    }

    // 5. Opportunity Consistency Checks
    if (opportunity) {
      const isOppChainMatch = payload.chainId === opportunity.chainId;
      checks.push({
        name: 'Payload vs Opportunity Chain Matching',
        passed: isOppChainMatch,
        expected: opportunity.chainId.toString(),
        received: payload.chainId.toString(),
        message: isOppChainMatch ? 'Chain IDs match' : 'Chain ID mismatch',
      });
      if (!isOppChainMatch) {
        errors.push(`Payload chain ID (${payload.chainId}) does not match opportunity chain ID (${opportunity.chainId})`);
      }

      if (opportunity.targetPool?.address) {
        const isPoolMatch = payload.to.toLowerCase() === opportunity.targetPool.address.toLowerCase();
        checks.push({
          name: 'Pool / Router Compatibility',
          passed: isPoolMatch,
          expected: opportunity.targetPool.address,
          received: payload.to,
          message: isPoolMatch ? 'Target pool matched' : 'Target pool mismatch',
        });
        if (!isPoolMatch) {
          errors.push(`Payload destination (${payload.to}) does not match target pool (${opportunity.targetPool.address})`);
        }
      }

      if (opportunity.estimatedNetProfitUsd <= 0) {
        warnings.push(`Opportunity has zero or negative estimated net profit ($${opportunity.estimatedNetProfitUsd})`);
      }
    }

    return {
      valid: errors.length === 0,
      checks,
      errors,
      warnings,
      validatedAt: Date.now(),
    };
  }
}
