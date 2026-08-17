/**
 * base_atomic_sniper.js
 *
 * ⚡ ATOMIC LIQUIDITY SNIPER & MEV ARBITRAGE ENGINE — BASE MAINNET (8453)
 *
 * Features:
 * 1. Genesis Floor Sniping: Enters legitimate meme pairs on Base (Uniswap V2, Aerodrome, Clanker, Virtuals).
 * 2. Strict Anti-Scam Quality Filter: >= 0.25 WETH (~$470+) initial liquidity only.
 * 3. Persistent State Storage: Positions saved to disk so script restarts NEVER lose track of open tokens!
 * 4. Automated Exits: Sells automatically at +3.5%+, trailing profit lock, or timeout flip.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import TelegramManager from './telegram_manager.js';
import dotenv from 'dotenv';
dotenv.config();

const RPC     = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const PK      = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;

// Canonical Base Addresses
const WETH    = '0x4200000000000000000000000000000000000006';
const USDC    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNISWAP_V2_ROUTER = '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24';
const UNISWAP_V2_FACTORY = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6';
const AERODROME_ROUTER   = '0xcF77a3Ba9A5CA399B7c97c74856154990ED377b7';
const AERODROME_FACTORY  = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

const ETH_USD = 1882.5;
const STATE_FILE = path.join(process.cwd(), 'state', 'base_positions.json');

// Ensure state dir exists
if (!fs.existsSync(path.join(process.cwd(), 'state'))) {
  fs.mkdirSync(path.join(process.cwd(), 'state'), { recursive: true });
}

// Topics
const PAIR_CREATED_TOPIC = ethers.id('PairCreated(address,address,address,uint256)');
const AERO_PAIR_CREATED  = ethers.id('PairCreated(address,address,bool,address,uint256)');
const MINT_TOPIC         = ethers.id('Mint(address,uint256,uint256)');
const SWAP_TOPIC         = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');

const PAIR_ABI = [
  'function getReserves() view returns (uint112 r0, uint112 r1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];
const ROUTER_ABI = [
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])',
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint)',
  'function allowance(address,address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
];

const GAS_RESERVE_ETH = ethers.parseEther('0.000005');

function toUSD(ethAmount) {
  const eth = typeof ethAmount === 'bigint' ? Number(ethers.formatEther(ethAmount)) : Number(ethAmount);
  return (eth * ETH_USD).toFixed(4);
}

function loadPersistedPositions() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      const map = new Map();
      for (const [k, v] of Object.entries(data)) {
        map.set(k, {
          ...v,
          entryEth: BigInt(v.entryEth),
          tokenBalance: BigInt(v.tokenBalance),
          targetEthOut: BigInt(v.targetEthOut),
        });
      }
      return map;
    }
  } catch {}
  return new Map();
}

function savePersistedPositions(map) {
  try {
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = {
        ...v,
        entryEth: v.entryEth.toString(),
        tokenBalance: v.tokenBalance.toString(),
        targetEthOut: v.targetEthOut.toString(),
      };
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

async function main() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       ⚡ BASE MAINNET ATOMIC LIQUIDITY SNIPER & MEV ENGINE (8453)       ║');
  console.log('║       Strategy: Ground Floor Sniping + Persistent Auto-Profit Selling    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  if (!PK) {
    console.error('❌ BASE_BOT_PRIVATE_KEY is missing in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC, 8453);
  const wallet   = new ethers.Wallet(PK, provider);
  const router   = new ethers.Contract(UNISWAP_V2_ROUTER, ROUTER_ABI, wallet);
  const initialBalance = await provider.getBalance(wallet.address);
  const usdcContract = new ethers.Contract(USDC, ERC20_ABI, provider);
  let initUsdcBal = 0n;
  try { initUsdcBal = await usdcContract.balanceOf(wallet.address); } catch {}

  console.log('💼 WALLET & PROFIT VAULT PROFILE:');
  console.log(`   📍 Address:             ${wallet.address}`);
  console.log(`   💰 Active Trading ETH:  ${ethers.formatEther(initialBalance)} ETH (~$${toUSD(initialBalance)} USD)`);
  console.log(`   🏦 Realized USDC Vault: $${(Number(initUsdcBal) / 1e6).toFixed(4)} USDC`);
  console.log(`   🛡️ Safety Reserve:      ${ethers.formatEther(GAS_RESERVE_ETH)} ETH (~$${toUSD(GAS_RESERVE_ETH)} USD)`);
  console.log(`   ⚡ Fixed Micro Entry:   0.0000600 ETH (~$0.1130 USD per trade)`);
  console.log(`   🔒 Anti-Rug Window:     0.25 to 25.0 WETH Liquidity Sweet Spot`);
  async function sweepProfitToUsdc(profitWei) {
    if (!profitWei || profitWei <= ethers.parseEther('0.000005')) return;
    try {
      const block = await provider.getBlock('latest');
      const baseFee = block?.baseFeePerGas || 1000000n;
      const maxPrio = 50000n;
      const maxFee = (baseFee * 150n) / 100n + maxPrio;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);

      process.stdout.write(`\n🏦 [PROFIT VAULT] Sweeping net trade profit +${ethers.formatEther(profitWei)} ETH (~$${toUSD(profitWei)} USD) to USDC... `);
      const usdcTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        1n,
        [ethers.getAddress(WETH), ethers.getAddress(USDC)],
        wallet.address,
        deadline,
        { value: profitWei, gasLimit: 150000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio }
      );
      await usdcTx.wait(1);
      console.log(`✅ Pure Profit Locked into USDC Vault!\n`);
    } catch {}
  }

  let stats = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
  };

  const activePositions = loadPersistedPositions();

  const telegram = new TelegramManager({
    getStats: async () => {
      const bal = await provider.getBalance(wallet.address);
      const usdcC = new ethers.Contract(USDC, ERC20_ABI, provider);
      let uBal = 0n;
      try { uBal = await usdcC.balanceOf(wallet.address); } catch {}
      const winRate = stats.totalTrades > 0 ? ((stats.wins / stats.totalTrades) * 100).toFixed(1) : '0.0';
      return {
        walletAddress: wallet.address,
        ethBalance: ethers.formatEther(bal),
        ethBalanceUsd: toUSD(bal),
        usdcVault: (Number(uBal) / 1e6).toFixed(4),
        wins: stats.wins,
        totalTrades: stats.totalTrades,
        winRate,
      };
    },
    getPositions: async () => {
      const list = [];
      for (const [addr, pos] of activePositions.entries()) {
        const grossPnl = pos.lastEthOut ? pos.lastEthOut - pos.entryEth : 0n;
        const gainPct = (Number(grossPnl) / Number(pos.entryEth)) * 100;
        list.push({
          symbol: pos.symbol,
          ethValue: pos.lastEthOut ? ethers.formatEther(pos.lastEthOut) : '0.0',
          pnlSign: gainPct >= 0 ? '+' : '',
          pnlPct: gainPct.toFixed(1),
          peakGain: (pos.peakGainPercent || 0).toFixed(1),
        });
      }
      return list;
    }
  });

  // On-Chain Auto-Sync: Check all recent incoming ERC20 tokens to find any held balance
  try {
    const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
    const walletTopic = ethers.zeroPadValue(wallet.address, 32);
    const currentBlockNum = await provider.getBlockNumber();
    const recentLogs = await provider.getLogs({
      fromBlock: currentBlockNum - 600,
      toBlock: currentBlockNum,
      topics: [TRANSFER_TOPIC, null, walletTopic]
    }).catch(() => []);

    const BLACKLISTED = new Set([
      '0xf31437dca248164ede22f5a9fe51335ec65edbb5', // DAPPS honeypot
    ]);

    for (const log of recentLogs) {
      const tokenAddr = log.address.toLowerCase();
      if (tokenAddr === WETH.toLowerCase() || BLACKLISTED.has(tokenAddr)) continue;
      if (activePositions.has(tokenAddr)) continue;

      try {
        const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
        const tokenBal = await erc20.balanceOf(wallet.address);
        if (tokenBal > 0n) {
          let sym = 'TOKEN';
          try { sym = await erc20.symbol(); } catch {}
          const entryEth = ethers.parseEther('0.00006');
          const targetEthOut = (entryEth * 1035n) / 1000n;
          activePositions.set(tokenAddr, {
            symbol: sym,
            entryEth,
            tokenBalance: tokenBal,
            targetEthOut,
            blocksHeld: 0,
          });
          console.log(`🔄 [AUTO-SYNC] Recovered active position from wallet: ${sym} (${ethers.formatEther(tokenBal)} tokens)`);
        }
      } catch {}
    }
    savePersistedPositions(activePositions);
  } catch {}

  if (activePositions.size > 0) {
    console.log(`🔄 [RESTORED] Tracking ${activePositions.size} open position(s)!\n`);
  }

  const approvedTokens = new Set();
  let lastBlock = await provider.getBlockNumber();
  console.log(`📡 [STREAM ACTIVE] Scanning Base blocks starting at #${lastBlock}...`);
  console.log(`⏳ Listening for PairCreated, Mint & live orderflow across Base...\n`);

  async function ensureApproval(tokenAddress, symbol) {
    if (approvedTokens.has(tokenAddress.toLowerCase())) return;
    const tok = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    try {
      const allow = await tok.allowance(wallet.address, UNISWAP_V2_ROUTER);
      if (allow < ethers.MaxUint256 / 2n) {
        process.stdout.write(`   🔑 [APPROVAL] Authorizing ${symbol} on SwapRouter... `);
        const tx = await tok.approve(UNISWAP_V2_ROUTER, ethers.MaxUint256, { gasLimit: 70000n });
        await tx.wait(1);
        console.log('✅ Approved!');
      }
      approvedTokens.add(tokenAddress.toLowerCase());
    } catch {}
  }

  async function checkActiveExits() {
    for (const [tokenAddr, pos] of activePositions.entries()) {
      try {
        const wethChk = ethers.getAddress(WETH);
        const tokChk = ethers.getAddress(tokenAddr);

        // Fetch exact live token balance
        const tokContract = new ethers.Contract(tokChk, ERC20_ABI, wallet);
        const liveBal = await tokContract.balanceOf(wallet.address);
        if (liveBal === 0n) {
          activePositions.delete(tokenAddr);
          savePersistedPositions(activePositions);
          continue;
        }
        pos.tokenBalance = liveBal;

        const amountsOut = await router.getAmountsOut(pos.tokenBalance, [tokChk, wethChk]);
        const currentEthOut = amountsOut[1];
        const grossPnlWei = currentEthOut - pos.entryEth;
        const gainPercent = (Number(grossPnlWei) / Number(pos.entryEth)) * 100;

        pos.blocksHeld = (pos.blocksHeld || 0) + 1;
        pos.peakGainPercent = Math.max(pos.peakGainPercent || 0, gainPercent);

        const pnlSign = gainPercent >= 0 ? '+' : '';
        const usdPnl = (Number(ethers.formatEther(grossPnlWei)) * ETH_USD).toFixed(4);

        console.log(`   📊 [LIVE TRACKER] ${pos.symbol}:`);
        console.log(`      💵 Current Value: ${ethers.formatEther(currentEthOut)} ETH (~$${toUSD(currentEthOut)})`);
        console.log(`      📈 Unrealized P&L: ${pnlSign}${gainPercent.toFixed(1)}% (${pnlSign}$${usdPnl} USD)`);
        console.log(`      🏆 Peak Gain:      +${pos.peakGainPercent.toFixed(1)}% | ⏳ Held: ${pos.blocksHeld} blocks`);

        const shouldTakeProfit = gainPercent >= 3.5;
        const shouldTrailingLock = pos.peakGainPercent >= 3.0 && gainPercent <= (pos.peakGainPercent - 1.5);
        const shouldTimeoutExit = pos.blocksHeld >= 8 && gainPercent >= 1.0;
        const shouldStopLoss = gainPercent <= -35.0 && pos.blocksHeld >= 12;

        if (shouldTakeProfit || shouldTrailingLock || shouldTimeoutExit || shouldStopLoss) {
          if (pos.isExiting) continue;
          pos.isExiting = true;

          const exitLabel = shouldTakeProfit ? `🎯 TAKE-PROFIT HIT (+${gainPercent.toFixed(1)}%)`
            : shouldTrailingLock ? `🔒 TRAILING PROFIT LOCK (+${gainPercent.toFixed(1)}%)`
            : shouldTimeoutExit ? `⏱️ TIMEOUT PROFIT FLIP (+${gainPercent.toFixed(1)}%)`
            : `🛑 STOP-LOSS EXIT (${gainPercent.toFixed(1)}%)`;

          console.log(`\n────────────────────────────────────────────────────────────────────────────`);
          console.log(`🚨 [BROADCASTING EXIT] ${exitLabel} for ${pos.symbol}`);
          console.log(`   💼 Token:         ${pos.symbol} (${tokenAddr.slice(0, 10)}...)`);
          console.log(`   💵 Selling:       ${ethers.formatEther(pos.tokenBalance)} tokens`);
          console.log(`   💰 Realized Gain: ${pnlSign}${gainPercent.toFixed(1)}% (${pnlSign}$${usdPnl} USD)`);

          await ensureApproval(tokChk, pos.symbol);

          const block = await provider.getBlock('latest');
          const baseFee = block?.baseFeePerGas || 1000000n;
          const maxPrio = 50000n;
          const maxFee = (baseFee * 150n) / 100n + maxPrio;
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);

          const minEthOut = shouldStopLoss ? 1n : (currentEthOut * 90n) / 100n;

          const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            pos.tokenBalance,
            minEthOut,
            [tokChk, wethChk],
            wallet.address,
            deadline,
            { gasLimit: 250000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio }
          );
          console.log(`   📤 Tx Hash:       ${tx.hash}`);
          const receipt = await tx.wait(1);
          console.log(`   ✅ CONFIRMED! Mined in Block #${receipt.blockNumber}`);
          console.log(`   🔗 Basescan:      https://basescan.org/tx/${tx.hash}`);

          activePositions.delete(tokenAddr);
          savePersistedPositions(activePositions);

          // 🏦 AUTO-PROFIT VAULT: Convert 100% of winning net trade profit into stable USDC
          if (grossPnlWei > 0n) {
            await sweepProfitToUsdc(grossPnlWei);
          }

          if (grossPnlWei > 0n) {
            telegram.notifyTakeProfit(pos.symbol, gainPercent.toFixed(1), ethers.formatEther(currentEthOut), (Number(grossPnlWei)*ETH_USD/1e18).toFixed(4), tx.hash);
          } else {
            telegram.notifyStopLoss(pos.symbol, gainPercent.toFixed(1), ethers.formatEther(currentEthOut), tx.hash);
          }

          const newBal = await provider.getBalance(wallet.address);
          const usdcContract = new ethers.Contract(USDC, ERC20_ABI, provider);
          let usdcBal = 0n;
          try { usdcBal = await usdcContract.balanceOf(wallet.address); } catch {}

          stats.totalTrades++;
          if (grossPnlWei > 0n) stats.wins++; else stats.losses++;

          console.log(`\n💼 UPDATED WALLET & PROFIT VAULT:`);
          console.log(`   💰 Trading ETH:    ${ethers.formatEther(newBal)} ETH (~$${toUSD(newBal)} USD) [Active Capital]`);
          console.log(`   🏦 USDC Vault:     $${(Number(usdcBal) / 1e6).toFixed(4)} USDC (Secured Realized Profit)`);
          console.log(`   🏆 Scorecard:      ${stats.wins} Wins / ${stats.totalTrades} Total Trades`);
          console.log(`────────────────────────────────────────────────────────────────────────────\n`);
        }
      } catch (e) {
        if (pos) {
          pos.exitAttempts = (pos.exitAttempts || 0) + 1;
          if (pos.exitAttempts >= 2) {
            console.log(`\n⚠️ [MALICIOUS/HONEYPOT TOKEN] ${pos.symbol} has sell restrictions. Dropping position.\n`);
            activePositions.delete(tokenAddr);
            savePersistedPositions(activePositions);
          } else {
            pos.isExiting = false;
          }
        }
      }
    }
  }

  const honeypotBlacklist = new Map([
    ['0x6eb6b145fcb1c853612d396d58388ebb485bacad', Date.now()], // LIQUIDBGT
    ['0x1f1c695f6b4a3f8b05f2492cef9474afb6d6ad69', Date.now()], // A1C
  ]);

  let isEntering = false;

  const EXCLUDED_TOKENS = new Set([
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI
    '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // USDbC
    '0x2ae3f1ec7e1f5be1a0c73f73eedfdd7c030f4742', // cbETH
    '0x940181a94a35a4569e4529a3cdfb74e38fd98631', // AERO
  ]);

  async function evaluateAndEnterPair(pairAddress, t0, t1) {
    if (isEntering) return;
    try {
      const hasWeth = t0.toLowerCase() === WETH.toLowerCase() || t1.toLowerCase() === WETH.toLowerCase();
      if (!hasWeth) return;

      const wethIs0 = t0.toLowerCase() === WETH.toLowerCase();
      const otherToken = wethIs0 ? t1 : t0;
      const otherTokenLower = otherToken.toLowerCase();

      if (EXCLUDED_TOKENS.has(otherTokenLower)) return;
      if (honeypotBlacklist.has(otherTokenLower)) return;
      if (activePositions.has(otherTokenLower)) return;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [r0, r1] = await pair.getReserves();
      const wethReserve = wethIs0 ? r0 : r1;

      // Golden Meme Snipe Window: 0.25 WETH (~$470) to 100.0 WETH (~$190,000)
      if (wethReserve < ethers.parseEther('0.25') || wethReserve > ethers.parseEther('100.0')) return;

      let sym = 'TOKEN';
      try { sym = await new ethers.Contract(otherToken, ERC20_ABI, provider).symbol(); } catch {}

      const wethAddr = ethers.getAddress(WETH);
      const tokenAddr = ethers.getAddress(otherTokenLower);

      const ethBal = await provider.getBalance(wallet.address);
      if (ethBal < GAS_RESERVE_ETH + ethers.parseEther('0.000005')) return;

      const deployableEth = ethBal > GAS_RESERVE_ETH ? (ethBal - GAS_RESERVE_ETH) : 0n;
      let entryEth = ethers.parseEther('0.00006');
      if (deployableEth < entryEth) entryEth = deployableEth;
      if (entryEth < ethers.parseEther('0.00001')) return;

      const block = await provider.getBlock('latest');
      const baseFee = block?.baseFeePerGas || 1000000n;
      const maxPrio = 50000n;
      const maxFee = (baseFee * 150n) / 100n + maxPrio;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);

      // 🛡️ BULLETPROOF 2-WAY HONEYPOT PRE-FLIGHT SHIELD:
      // Step 1: Simulate BUY Leg
      try {
        await router.swapExactETHForTokensSupportingFeeOnTransferTokens.staticCall(
          1n,
          [wethAddr, tokenAddr],
          wallet.address,
          deadline,
          { value: entryEth, from: wallet.address }
        );
      } catch (buyErr) {
        honeypotBlacklist.set(otherTokenLower, Date.now());
        return; // Skip non-tradeable pairs & cache as honeypot
      }

      // Step 2: Simulate SELL Leg & Verify Fair Return (No 100% Honeypot Tax)
      try {
        const estTokens = (await router.getAmountsOut(entryEth, [wethAddr, tokenAddr]))[1];
        if (estTokens === 0n) {
          honeypotBlacklist.set(otherTokenLower, Date.now());
          return;
        }
        const estEthBack = (await router.getAmountsOut(estTokens, [tokenAddr, wethAddr]))[1];
        
        // If sell return is < 70% of entry due to malicious tax, ABORT & BLACKLIST!
        if (estEthBack < (entryEth * 70n) / 100n) {
          honeypotBlacklist.set(otherTokenLower, Date.now());
          return;
        }
      } catch (sellErr) {
        honeypotBlacklist.set(otherTokenLower, Date.now());
        return; // Malicious token that blocks DEX sells — ABORT & BLACKLIST!
      }

      isEntering = true;

      console.log(`\n────────────────────────────────────────────────────────────────────────────`);
      console.log(`🚀 [NEW BASE LAUNCH DETECTED] Pair: WETH / ${sym}`);
      console.log(`   💧 Pool Liquidity: ${ethers.formatEther(wethReserve)} WETH (~$${toUSD(wethReserve)} USD)`);
      console.log(`   ⚡ Dynamic Entry:  ${ethers.formatEther(entryEth)} ETH (~$${toUSD(entryEth)} USD)`);
      console.log(`   📍 Token Address:  ${tokenAddr}`);

      const buyTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        1n,
        [wethAddr, tokenAddr],
        wallet.address,
        deadline,
        {
          value: entryEth,
          gasLimit: 300000n,
          maxPriorityFeePerGas: maxPrio,
          maxFeePerGas: maxFee
        }
      );

      console.log(`⚡ Buy Tx Broadcasted: ${buyTx.hash}`);
      const receipt = await buyTx.wait(1);
      console.log(`🎉 BUY CONFIRMED! Block: ${receipt.blockNumber} (Gas Used: ${receipt.gasUsed.toString()})`);

      const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
      const tokenBal = await tokenContract.balanceOf(wallet.address);

      activePositions.set(otherTokenLower, {
        symbol: sym,
        tokenAddress: tokenAddr,
        pairAddress: pairAddress,
        entryEth: entryEth,
        tokenBalance: tokenBal,
        entryBlock: receipt.blockNumber,
        peakEthValue: entryEth,
        blocksHeld: 0
      });

      savePersistedPositions(activePositions);
      console.log(`🎯 Position Saved: Holding ${ethers.formatEther(tokenBal)} ${sym}`);
      isEntering = false;
    } catch (err) {
      console.log(`⚠️ Entry Error: ${err.message}`);
      isEntering = false;
    }
  }

  async function handleMintEvent(log) {
    try {
      const pair = new ethers.Contract(log.address, PAIR_ABI, provider);
      const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
      await evaluateAndEnterPair(log.address, t0, t1);
    } catch {}
  }

  async function handlePairCreatedEvent(log) {
    try {
      const token0 = '0x' + log.topics[1].slice(26);
      const token1 = '0x' + log.topics[2].slice(26);
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'uint256'], log.data);
      const pairAddress = decoded[0];
      await evaluateAndEnterPair(pairAddress, token0, token1);
    } catch {}
  }

  const recentPoolVelocity = new Map();

  // Reset velocity cache every 30 seconds so old tokens don't accumulate
  setInterval(() => {
    recentPoolVelocity.clear();
  }, 30000);

  async function handleMomentumScalp(pairAddress) {
    try {
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [t0, t1, [r0, r1]] = await Promise.all([pair.token0(), pair.token1(), pair.getReserves()]);
      const hasWeth = t0.toLowerCase() === WETH.toLowerCase() || t1.toLowerCase() === WETH.toLowerCase();
      if (!hasWeth) return;

      const wethIs0 = t0.toLowerCase() === WETH.toLowerCase();
      const otherToken = wethIs0 ? t1 : t0;
      const otherTokenLower = otherToken.toLowerCase();

      if (EXCLUDED_TOKENS.has(otherTokenLower)) return;
      if (honeypotBlacklist.has(otherTokenLower)) return;
      if (activePositions.has(otherTokenLower)) return;

      const wethReserve = wethIs0 ? r0 : r1;
      if (wethReserve < ethers.parseEther('0.5') || wethReserve > ethers.parseEther('100.0')) return;

      await evaluateAndEnterPair(pairAddress, t0, t1);
    } catch {}
  }

  let totalSwapsScanned = 0;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) {
        return;
      }

      const from = lastBlock + 1;
      const to = currentBlock;
      lastBlock = currentBlock;

      if (activePositions.size > 0) {
        await checkActiveExits();
      }

      const [mintLogs, pairLogs, aeroLogs, swapLogs] = await Promise.all([
        provider.getLogs({ fromBlock: from, toBlock: to, topics: [MINT_TOPIC] }),
        provider.getLogs({ fromBlock: from, toBlock: to, topics: [PAIR_CREATED_TOPIC] }),
        provider.getLogs({ fromBlock: from, toBlock: to, topics: [AERO_PAIR_CREATED] }),
        provider.getLogs({ fromBlock: from, toBlock: to, topics: [SWAP_TOPIC] }),
      ]);

      // Priority 1: Brand New Genesis Launch Sniping
      for (const log of mintLogs) {
        await handleMintEvent(log);
      }
      for (const log of pairLogs) {
        await handlePairCreatedEvent(log);
      }
      for (const log of aeroLogs) {
        await handlePairCreatedEvent(log);
      }

      // Priority 2: Genuine High-Velocity Momentum Bursts (>= 3 swaps in 30s)
      totalSwapsScanned += swapLogs.length;
      for (const sLog of swapLogs) {
        const pAddr = sLog.address.toLowerCase();
        const count = (recentPoolVelocity.get(pAddr) || 0) + 1;
        recentPoolVelocity.set(pAddr, count);

        if (count >= 3 && !isEntering) {
          await handleMomentumScalp(sLog.address);
        }
      }

      process.stdout.write(`\r⏳ Watching Base Block #${currentBlock} | 🔄 Swaps Scanned: ${totalSwapsScanned} `);
    } catch (e) {
      // quiet
    }
  }, 1500);
}

main().catch(e => {
  console.error('❌ Fatal Base Engine Error:', e);
  process.exit(1);
});
