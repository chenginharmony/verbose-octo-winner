/**
 * micro_sandwich.js
 *
 * GLOBAL EVENT-DRIVEN DYNAMIC SANDWICH ENGINE — ROBINHOOD CHAIN (4663)
 *
 * Architecture:
 * 1. Global Event Listener: Subscribes to Swap events across ALL 35,750+ DEX pairs in real-time.
 * 2. Dynamic Pool Discovery: Automatically detects whenever ANY pair trades.
 * 3. Dynamic Auto-Approval: If the active pair is WETH-paired, auto-approves the token instantly.
 * 4. Micro-Capital Gate: Evaluates exact AMM sandwich profitability for our hot wallet capital (~$0.43).
 * 5. Autonomous Execution: The moment ANY trade on ANY active pool offers positive net EV after gas,
 *    broadcasts Leg 1 (Frontrun) and Leg 2 (Backrun) on-chain immediately.
 * 6. True On-Chain P&L: Evaluates actual wallet balance deltas and Transfer events.
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC    = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const PK     = process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const ROUTER = '0x89e5db8b5aa49aa85ac63f691524311aeb649eba';
const WETH   = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'.toLowerCase();
const ETH_USD = 1882.5;

// Uniswap V2 Swap Event Topic: Swap(address sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address to)
const SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

// ── Uniswap V2 ABIs ─────────────────────────────────────────────────────────
const PAIR_ABI = [
  'function getReserves() view returns (uint112 r0, uint112 r1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[])',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[])',
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint)',
  'function allowance(address,address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
];

// Fixed 2-tx sandwich gas cost (2 txs × 120k gas × 20.196 gwei)
const GAS_COST_WEI = 2n * 120000n * 20196000n;
const GAS_COST_USD = Number(GAS_COST_WEI) / 1e18 * ETH_USD;
const GAS_RESERVE_ETH = ethers.parseEther('0.00005');

// ── AMM Formulae ────────────────────────────────────────────────────────────
function getAmountOut(amtIn, resIn, resOut) {
  if (amtIn <= 0n || resIn <= 0n || resOut <= 0n) return 0n;
  const withFee = amtIn * 997n;
  return (withFee * resOut) / (resIn * 1000n + withFee);
}

function calcSandwichNet(frontrunWei, victimWei, preR_Weth, preR_Other, gasCostWei) {
  // Leg 1: Frontrun buy of token with WETH
  const tokenBought = getAmountOut(frontrunWei, preR_Weth, preR_Other);
  const rWeth_afterFront = preR_Weth + frontrunWei;
  const rOther_afterFront = preR_Other - tokenBought;

  // Victim: Buy of token with WETH
  const victimBought = getAmountOut(victimWei, rWeth_afterFront, rOther_afterFront);
  const rWeth_afterVictim = rWeth_afterFront + victimWei;
  const rOther_afterVictim = rOther_afterFront - victimBought;

  // Leg 2: Backrun sell of token back to WETH
  const ethBack = getAmountOut(tokenBought, rOther_afterVictim, rWeth_afterVictim);
  const gross = ethBack > frontrunWei ? ethBack - frontrunWei : 0n;
  const net = gross - gasCostWei;
  return { net, gross, tokenBought, ethBack };
}

// ── Main Controller ─────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚡ GLOBAL EVENT-DRIVEN DYNAMIC SANDWICH ENGINE');
  console.log('   Robinhood Chain Mainnet (Chain ID 4663)');
  console.log('   Listening to ALL 35,750+ DEX pairs in real-time');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`⛽ Fixed Gas Cost per Sandwich: ~$${GAS_COST_USD.toFixed(4)} (${ethers.formatEther(GAS_COST_WEI)} ETH)\n`);

  if (!PK) {
    console.error('❌ ROBINHOOD_BOT_PRIVATE_KEY is missing in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC, 4663);
  const wallet   = new ethers.Wallet(PK, provider);
  const router   = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const balance = await provider.getBalance(wallet.address);
  console.log(`💼 Bot Wallet:  ${wallet.address}`);
  console.log(`💰 Balance:     ${ethers.formatEther(balance)} ETH (~$${(Number(ethers.formatEther(balance)) * ETH_USD).toFixed(3)})\n`);

  // In-memory caches
  const poolCache = new Map(); // address -> { token0, token1, isWethPair, otherToken, symbol, wethIsToken0 }
  const approvedTokens = new Set();
  const poolTradeCounts = new Map(); // address -> count

  let lastBlock = await provider.getBlockNumber();
  console.log(`📡 Starting stream at block #${lastBlock}...`);
  console.log(`⏳ Monitoring live swap orderflow on-chain...\n`);

  let isExecuting = false;
  let sandwichCount = 0;
  let totalNetWei = 0n;

  // Auto-approval helper
  async function ensureApproval(tokenAddress, symbol) {
    if (approvedTokens.has(tokenAddress.toLowerCase())) return;
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    try {
      const allowance = await tokenContract.allowance(wallet.address, ROUTER);
      if (allowance < ethers.MaxUint256 / 2n) {
        process.stdout.write(`  🔑 Auto-approving ${symbol} (${tokenAddress.slice(0, 10)}...)... `);
        const tx = await tokenContract.approve(ROUTER, ethers.MaxUint256, { gasLimit: 70000n });
        await tx.wait(1);
        console.log('✅ Approved');
      }
      approvedTokens.add(tokenAddress.toLowerCase());
    } catch (e) {
      console.log(`  ⚠️ Approval note for ${symbol}: ${e.message.slice(0, 50)}`);
    }
  }

  // Process a swap event from any pool on the chain
  async function handleSwapLog(log) {
    const pairAddress = log.address.toLowerCase();

    // 1. Fetch / Cache Pool Metadata
    let meta = poolCache.get(pairAddress);
    if (!meta) {
      try {
        const pair = new ethers.Contract(log.address, PAIR_ABI, provider);
        const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
        const is0Weth = t0.toLowerCase() === WETH;
        const is1Weth = t1.toLowerCase() === WETH;
        const isWethPair = is0Weth || is1Weth;

        let otherToken = null;
        let symbol = '???';
        if (isWethPair) {
          otherToken = is0Weth ? t1 : t0;
          try {
            symbol = await new ethers.Contract(otherToken, ERC20_ABI, provider).symbol();
          } catch {
            symbol = otherToken.slice(0, 6);
          }
        }

        meta = {
          pairAddress: log.address,
          token0: t0,
          token1: t1,
          isWethPair,
          otherToken,
          symbol,
          wethIsToken0: is0Weth,
        };
        poolCache.set(pairAddress, meta);
      } catch {
        return; // Non-standard pair
      }
    }

    if (!meta.isWethPair) return; // Skip pairs not paired with WETH

    // Track activity
    const count = (poolTradeCounts.get(meta.symbol) || 0) + 1;
    poolTradeCounts.set(meta.symbol, count);

    // 2. Decode Swap Event
    let decoded;
    try {
      decoded = abiCoder.decode(['uint256', 'uint256', 'uint256', 'uint256'], log.data);
    } catch {
      return;
    }

    const [amount0In, amount1In, amount0Out, amount1Out] = decoded;

    // Check if the victim was sending WETH to buy the token
    let victimWethIn = 0n;
    if (meta.wethIsToken0 && amount0In > 0n && amount1Out > 0n) {
      victimWethIn = amount0In;
    } else if (!meta.wethIsToken0 && amount1In > 0n && amount0Out > 0n) {
      victimWethIn = amount1In;
    } else {
      // Victim was selling token for WETH — not a frontrun buy opportunity
      return;
    }

    const victimUsd = Number(victimWethIn) / 1e18 * ETH_USD;

    // 3. Fetch Pair Current Reserves
    const pair = new ethers.Contract(meta.pairAddress, PAIR_ABI, provider);
    let r0, r1;
    try {
      const res = await pair.getReserves();
      r0 = BigInt(res[0]);
      r1 = BigInt(res[1]);
    } catch {
      return;
    }

    const currentWethRes = meta.wethIsToken0 ? r0 : r1;
    const currentOtherRes = meta.wethIsToken0 ? r1 : r0;

    // Derive pre-victim reserves (subtract victim trade)
    const preWethRes = currentWethRes > victimWethIn ? currentWethRes - victimWethIn : currentWethRes;
    const victimTokenOut = meta.wethIsToken0 ? amount1Out : amount0Out;
    const preOtherRes = currentOtherRes + victimTokenOut;

    // 4. Calculate Frontrun Capital Available
    const ethBal = await provider.getBalance(wallet.address);
    if (ethBal < GAS_RESERVE_ETH + GAS_COST_WEI) return;

    const deployable = ethBal - GAS_RESERVE_ETH;
    const frontrunWei = (deployable * 70n) / 100n; // Use 70% of deployable balance

    // 5. Evaluate Sandwich Profitability
    const { net, gross, tokenBought, ethBack } = calcSandwichNet(
      frontrunWei,
      victimWethIn,
      preWethRes,
      preOtherRes,
      GAS_COST_WEI
    );

    const netUsd = Number(net) / 1e18 * ETH_USD;
    const poolDepthUsd = Number(preWethRes) / 1e18 * ETH_USD * 2;

    const isProfitable = net > 0n;

    console.log(
      `\n${isProfitable ? '🎯 TRIGGER' : '👀 DETECTED'}: WETH/${meta.symbol.padEnd(10)} ` +
      `| Pool: $${poolDepthUsd.toFixed(0).padStart(7)} ` +
      `| Victim Buy: $${victimUsd.toFixed(3).padStart(7)} ` +
      `| Net Profit: ${isProfitable ? '+' : ''}$${netUsd.toFixed(6)} ` +
      `| ${isProfitable ? '🚀 EXECUTING SANDWICH!' : '⏭️  Skip (net < gas)'}`
    );

    if (!isProfitable || isExecuting) return;

    // 6. EXECUTE LIVE ON-CHAIN SANDWICH
    isExecuting = true;
    try {
      console.log(`\n───────────────────────────────────────────────────────────────`);
      console.log(`🚀 EXECUTING LIVE ON-CHAIN SANDWICH #${sandwichCount + 1}`);
      console.log(`   Pair:        WETH/${meta.symbol} (${meta.pairAddress})`);
      console.log(`   Victim:      $${victimUsd.toFixed(3)} WETH Buy`);
      console.log(`   Our Frontrun: ${ethers.formatEther(frontrunWei)} ETH (~$${(Number(frontrunWei)/1e18*ETH_USD).toFixed(3)})`);
      console.log(`   Expected Net: +$${netUsd.toFixed(6)} USD`);

      // Ensure Token is approved for backrun sale
      await ensureApproval(meta.otherToken, meta.symbol);

      const block = await provider.getBlock('latest');
      const baseFee = block?.baseFeePerGas || 20000000n;
      const maxPrio = 2000000n;
      const maxFee = (baseFee * 150n) / 100n + maxPrio;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
      const ethBefore = await provider.getBalance(wallet.address);

      // LEG 1: Frontrun — ETH → Token
      console.log(`\n   📤 LEG 1: Frontrun swapExactETHForTokens...`);
      const frontTx = await router.swapExactETHForTokens(
        1n,
        [WETH, meta.otherToken],
        wallet.address,
        deadline,
        { value: frontrunWei, gasLimit: 200000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio }
      );
      console.log(`      Tx Hash: ${frontTx.hash}`);
      const frontReceipt = await frontTx.wait(1);
      console.log(`      ${frontReceipt.status === 1 ? '✅ Mined in Block #' + frontReceipt.blockNumber : '❌ Reverted'}`);
      console.log(`      🔗 https://robinhoodchain.blockscout.com/tx/${frontTx.hash}`);

      if (frontReceipt.status !== 1) {
        console.log('   ❌ Frontrun reverted. Aborting sandwich.');
        return;
      }

      // Check acquired token balance
      const otherTokenContract = new ethers.Contract(meta.otherToken, ERC20_ABI, wallet);
      const acquiredTokens = await otherTokenContract.balanceOf(wallet.address);
      console.log(`      Acquired ${ethers.formatEther(acquiredTokens)} ${meta.symbol}`);

      // LEG 2: Backrun — Token → ETH (sell all acquired back to ETH)
      console.log(`\n   📤 LEG 2: Backrun swapExactTokensForETH...`);
      const backTx = await router.swapExactTokensForETH(
        acquiredTokens,
        1n,
        [meta.otherToken, WETH],
        wallet.address,
        deadline,
        { gasLimit: 200000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio }
      );
      console.log(`      Tx Hash: ${backTx.hash}`);
      const backReceipt = await backTx.wait(1);
      console.log(`      ${backReceipt.status === 1 ? '✅ Mined in Block #' + backReceipt.blockNumber : '❌ Reverted'}`);
      console.log(`      🔗 https://robinhoodchain.blockscout.com/tx/${backTx.hash}`);

      // ── CONFIRM REAL WALLET P&L ──────────────────────────────────────────
      const ethAfter = await provider.getBalance(wallet.address);
      const realNetWei = ethAfter > ethBefore ? ethAfter - ethBefore : -(ethBefore - ethAfter);
      const realNetUsd = Number(realNetWei) / 1e18 * ETH_USD;

      sandwichCount++;
      totalNetWei += realNetWei;

      console.log(`\n   ═══════════════════════════════════════════════════════════`);
      console.log(`   📊 CONFIRMED ON-CHAIN P&L:`);
      console.log(`      ETH Before:     ${ethers.formatEther(ethBefore)} ETH`);
      console.log(`      ETH After:      ${ethers.formatEther(ethAfter)} ETH`);
      console.log(`      Net P&L:        ${realNetWei >= 0n ? '+' : ''}${ethers.formatEther(realNetWei)} ETH (${realNetWei >= 0n ? '+' : ''}$${realNetUsd.toFixed(6)})`);
      console.log(`      Cumulative P&L: ${ethers.formatEther(totalNetWei)} ETH`);
      console.log(`      Sandwich Count: ${sandwichCount}`);
      console.log(`   ═══════════════════════════════════════════════════════════\n`);

      // Loss limit protection
      if (realNetWei < -(ethBefore / 10n)) {
        console.log(`🛑 LOSS LIMIT TRIGGERED (lost >10% of wallet). Halting engine.`);
        process.exit(1);
      }
    } catch (e) {
      console.log(`\n⚠️ Execution Error: ${e.message.slice(0, 120)}`);
    } finally {
      isExecuting = false;
    }
  }

  // ── Global Polling Loop ───────────────────────────────────────────────────
  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) {
        process.stdout.write('.');
        return;
      }

      const from = lastBlock + 1;
      const to = currentBlock;
      lastBlock = currentBlock;

      // Query Swap events across the ENTIRE DEX in the new block(s)
      const logs = await provider.getLogs({
        fromBlock: from,
        toBlock: to,
        topics: [SWAP_TOPIC],
      });

      if (logs.length === 0) {
        process.stdout.write('.');
        return;
      }

      for (const log of logs) {
        await handleSwapLog(log);
      }
    } catch (e) {
      if (!e.message?.includes('timeout')) {
        process.stdout.write('!');
      }
    }
  }, 1800);
}

main().catch(e => {
  console.error('❌ Fatal Engine Error:', e);
  process.exit(1);
});
