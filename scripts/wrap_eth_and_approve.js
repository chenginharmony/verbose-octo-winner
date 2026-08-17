/**
 * wrap_eth_and_approve.js
 *
 * Robinhood Chain uses BRIDGED WETH — no deposit() function.
 * Instead we use swapExactETHForTokens on the Router to acquire WETH,
 * then approve the Router to spend it.
 *
 * Route: native ETH → WETH (via Router swapExactETHForTokens)
 * Pool:  WETH/USDG — 0x8803c117ccae7B5146297876c2A25DF135141C4d (63 WETH, deepest pool)
 *
 * After this script: wallet holds WETH + Router is approved → ready to trade.
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL     = process.env.ROBINHOOD_RPC_URL    || 'https://rpc.mainnet.chain.robinhood.com';
const PRIVATE_KEY = process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const ROUTER      = '0x89e5db8b5aa49aa85ac63f691524311aeb649eba'; // ✅ Verified Router02
const WETH        = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'; // ✅ Bridged WETH on RH Chain
const USDG        = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'; // ✅ USDG stablecoin

// How much native ETH to spend swapping into WETH
// Wallet has ~0.000582 ETH. Use 0.0003 ETH, keep rest for gas.
const SWAP_ETH_AMOUNT = '0.0002';

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint)',
  'function allowance(address,address) view returns (uint)',
  'function approve(address,uint) returns (bool)',
  'function decimals() view returns (uint8)',
];

const ROUTER_ABI = [
  'function WETH() view returns (address)',
  // swapExactETHForTokens: send ETH, receive tokens (path[0] must be WETH)
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  // getAmountsOut: simulate swap to compute expected output
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 ACQUIRE WETH + APPROVE ROUTER — ROBINHOOD CHAIN MAINNET');
  console.log('   (Bridged WETH — using swapExactETHForTokens, not deposit())');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!PRIVATE_KEY) { console.error('❌ ROBINHOOD_BOT_PRIVATE_KEY not set'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL, 4663);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const router   = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
  const wethTok  = new ethers.Contract(WETH, ERC20_ABI, wallet);
  const usdgTok  = new ethers.Contract(USDG, ERC20_ABI, wallet);

  // ── STEP 0: Verify ────────────────────────────────────────────────────────
  console.log('📋 STEP 0: Verify Router.WETH() matches our WETH address');
  const routerWeth = await router.WETH();
  console.log(`   Router.WETH() = ${routerWeth}`);
  if (routerWeth.toLowerCase() !== WETH.toLowerCase()) {
    console.error(`   ❌ WETH mismatch! Expected ${WETH}, Router says ${routerWeth}`);
    process.exit(1);
  }
  console.log(`   ✅ Match confirmed\n`);

  // ── STEP 1: Current balances ──────────────────────────────────────────────
  console.log('📋 STEP 1: Balances BEFORE');
  const ethBefore  = await provider.getBalance(wallet.address);
  const wethBefore = await wethTok.balanceOf(wallet.address);
  const usdgBefore = await usdgTok.balanceOf(wallet.address).catch(() => 0n);
  console.log(`   ETH  balance:  ${ethers.formatEther(ethBefore)} ETH`);
  console.log(`   WETH balance:  ${ethers.formatEther(wethBefore)} WETH`);
  console.log(`   USDG balance:  ${ethers.formatEther(usdgBefore)} USDG\n`);

  const swapAmountWei = ethers.parseEther(SWAP_ETH_AMOUNT);
  if (ethBefore < swapAmountWei + ethers.parseEther('0.0001')) {
    console.error(`❌ Insufficient ETH. Need ${SWAP_ETH_AMOUNT} ETH + gas reserve. Have ${ethers.formatEther(ethBefore)} ETH`);
    process.exit(1);
  }

  // ── STEP 2: Simulate to get expected WETH output ─────────────────────────
  console.log(`📋 STEP 2: Simulate ${SWAP_ETH_AMOUNT} ETH → WETH via Router.getAmountsOut`);
  let amountOutMin = 1n;
  try {
    // Path: WETH → WETH is invalid. ETH IS WETH on this router.
    // swapExactETHForTokens path must start with WETH and end with target token.
    // To get WETH output, we swap ETH→USDG→WETH? No — ETH input IS WETH.
    // Actually: when you call swapExactETHForTokens, the Router wraps your ETH into WETH
    // internally, then swaps WETH → token along the path.
    // path[0] = WETH (the Router wraps for you), path[1] = destination token
    // So to GET USDG: path = [WETH, USDG]
    // To GET WETH: not possible via this function — WETH IS the input
    // Correct approach: swap ETH → USDG using the deep WETH/USDG pool
    const amounts = await router.getAmountsOut(swapAmountWei, [WETH, USDG]);
    const expectedUsdg = amounts[1];
    // Accept 1% slippage
    amountOutMin = (expectedUsdg * 99n) / 100n;
    console.log(`   Expected USDG out: ${ethers.formatEther(expectedUsdg)} USDG`);
    console.log(`   Min USDG (1% slip): ${ethers.formatEther(amountOutMin)} USDG\n`);
  } catch (e) {
    console.log(`   ⚠️  getAmountsOut failed: ${e.message.slice(0, 100)}`);
    console.log(`   Proceeding with amountOutMin = 1 (max slippage tolerance)\n`);
  }

  // ── STEP 3: Execute swapExactETHForTokens (ETH → USDG) ───────────────────
  // Note: on Robinhood Chain, bridged WETH cannot be obtained by wrapping.
  // The correct strategy is: trade native ETH for USDG (or another token)
  // via swapExactETHForTokens. This acquires a real ERC-20 token we can then
  // use in swapExactTokensForTokens strategies.
  console.log(`📋 STEP 3: Swap ${SWAP_ETH_AMOUNT} ETH → USDG via swapExactETHForTokens`);
  console.log(`   Path: native ETH → WETH (Router wraps) → USDG`);
  console.log(`   Pool: WETH/USDG (0x8803c117...) — 63 WETH, 118K USDG`);

  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 20000000n;
  const maxPrio = 2000000n;
  const maxFee  = (baseFee * 150n) / 100n + maxPrio;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const swapTx = await router.swapExactETHForTokens(
    amountOutMin,
    [WETH, USDG],
    wallet.address,
    deadline,
    {
      value: swapAmountWei,
      gasLimit: 200000n,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
    }
  );

  console.log(`   📤 TX sent:  ${swapTx.hash}`);
  console.log(`   ⏳ Waiting for confirmation...`);
  const swapReceipt = await swapTx.wait(1);
  const gasEth = swapReceipt.gasUsed * (swapReceipt.gasPrice || 0n);

  console.log(`   ${swapReceipt.status === 1 ? '✅' : '❌'} Block ${swapReceipt.blockNumber} — Status: ${swapReceipt.status === 1 ? 'SUCCESS' : 'REVERTED'}`);
  console.log(`   ⛽ Gas: ${swapReceipt.gasUsed.toLocaleString()} units (~${ethers.formatEther(gasEth)} ETH)`);
  console.log(`   🪙 ERC-20 Transfers in tx: ${swapReceipt.logs.length}`);
  console.log(`   🔗 https://robinhoodchain.blockscout.com/tx/${swapTx.hash}\n`);

  if (swapReceipt.status !== 1) {
    console.error('❌ Swap reverted. Check the Blockscout link above for the revert reason.');
    process.exit(1);
  }

  // ── STEP 4: Approve Router to spend USDG ─────────────────────────────────
  console.log('📋 STEP 4: Approve Router to spend USDG');
  const existingAllowance = await usdgTok.allowance(wallet.address, ROUTER);
  const usdgAfterSwap = await usdgTok.balanceOf(wallet.address);
  console.log(`   USDG balance now: ${ethers.formatEther(usdgAfterSwap)} USDG`);

  if (existingAllowance >= usdgAfterSwap && existingAllowance > 0n) {
    console.log(`   ✅ Allowance already sufficient — skipping\n`);
  } else {
    const approveTx = await usdgTok.approve(ROUTER, ethers.MaxUint256, {
      gasLimit: 60000n,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
    });
    console.log(`   📤 TX sent:  ${approveTx.hash}`);
    const approveReceipt = await approveTx.wait(1);
    console.log(`   ✅ Approved at block ${approveReceipt.blockNumber}`);
    console.log(`   🔗 https://robinhoodchain.blockscout.com/tx/${approveTx.hash}\n`);
  }

  // ── STEP 5: Final balances ────────────────────────────────────────────────
  console.log('📋 STEP 5: Final balances AFTER');
  const ethAfter  = await provider.getBalance(wallet.address);
  const usdgAfter = await usdgTok.balanceOf(wallet.address);
  const allowance = await usdgTok.allowance(wallet.address, ROUTER);

  console.log(`   ETH  balance:  ${ethers.formatEther(ethAfter)} ETH`);
  console.log(`   USDG balance:  ${ethers.formatEther(usdgAfter)} USDG`);
  console.log(`   Router USDG allowance: ${allowance === ethers.MaxUint256 ? '∞ (MaxUint256)' : ethers.formatEther(allowance)} USDG`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (usdgAfter > 0n) {
    console.log('✅ READY: Wallet holds USDG + Router is approved');
    console.log('   Next trade: USDG → VIRTUAL via USDG/VIRTUAL pool');
    console.log('   Pool: 0xee8D21C0E5AAA31269867Db4E3C66a90C3D5951D');
    console.log('   (93K USDG / 167K VIRTUAL — deepest non-WETH pool)');
    console.log('\n   Run: npm run start:mev');
  } else {
    console.log('⚠️  USDG balance is 0 — swap may have failed, check Blockscout');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error(`\n❌ FATAL: ${e.message}`);
  process.exit(1);
});
