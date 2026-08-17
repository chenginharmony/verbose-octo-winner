/**
 * Probe the token at 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
 * to discover what it actually is and how to get WETH on Robinhood Chain.
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const provider = new ethers.JsonRpcProvider(
  process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', 4663
);

const WALLET = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';
const MYSTERY_TOKEN = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const ROUTER = '0x89e5db8b5aa49aa85ac63f691524311aeb649eba';

// Try every possible WETH address
const WETH_CANDIDATES = [
  '0x4200000000000000000000000000000000000006', // Standard OP-stack WETH
  '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', // Token0 in pools
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum WETH
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint)',
  'function balanceOf(address) view returns (uint)',
];

// WETH-specific ABI
const WETH_ABI = [
  ...ERC20_ABI,
  'function deposit() payable',
  'function withdraw(uint)',
  'function allowance(address,address) view returns (uint)',
];

// Probe function selectors manually — check if the contract has deposit()
// deposit() selector = 0xd0e30db0
// withdraw(uint) selector = 0x2e1a7d4d
async function probeSelectors(address) {
  const depositData  = '0xd0e30db0';
  const withdrawData = '0x2e1a7d4d0000000000000000000000000000000000000000000000000000000000000001';
  
  const [depositResult, withdrawResult] = await Promise.allSettled([
    provider.call({ to: address, data: depositData, value: 1n }),
    provider.call({ to: address, data: withdrawData }),
  ]);
  
  return {
    hasDeposit:  depositResult.status === 'fulfilled',
    hasWithdraw: withdrawResult.status === 'fulfilled',
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 WETH DISCOVERY — ROBINHOOD CHAIN MAINNET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check all candidates
  for (const addr of WETH_CANDIDATES) {
    const code = await provider.getCode(addr);
    const hasCode = code !== '0x';
    console.log(`\n📜 ${addr}`);
    console.log(`   Bytecode: ${hasCode ? `${(code.length - 2)/2} bytes` : '❌ No code'}`);
    if (!hasCode) continue;

    const tok = new ethers.Contract(addr, ERC20_ABI, provider);
    let name = '?', symbol = '?', decimals = 18, supply = 0n;
    try { name     = await tok.name();        } catch { name = '(no name fn)'; }
    try { symbol   = await tok.symbol();      } catch { symbol = '(no symbol fn)'; }
    try { decimals = await tok.decimals();    } catch {}
    try { supply   = await tok.totalSupply(); } catch {}

    const balance = await tok.balanceOf(WALLET).catch(() => 0n);
    const { hasDeposit, hasWithdraw } = await probeSelectors(addr);

    console.log(`   name():        ${name}`);
    console.log(`   symbol():      ${symbol}`);
    console.log(`   decimals():    ${decimals}`);
    console.log(`   totalSupply(): ${ethers.formatUnits(supply, decimals)}`);
    console.log(`   Our balance:   ${ethers.formatUnits(balance, decimals)}`);
    console.log(`   deposit() fn:  ${hasDeposit  ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   withdraw() fn: ${hasWithdraw ? '✅ EXISTS' : '❌ MISSING'}`);
  }

  // Also check Router to find WETH() function — many routers expose it
  console.log('\n\n📜 ROUTER WETH() query — routers expose the canonical WETH address');
  const routerWethAbi = ['function WETH() view returns (address)'];
  const router = new ethers.Contract(ROUTER, routerWethAbi, provider);
  let routerWeth = null;
  try {
    routerWeth = await router.WETH();
    console.log(`   ✅ Router.WETH() = ${routerWeth}`);
    // Now check that address
    const wethCode = await provider.getCode(routerWeth);
    console.log(`   Bytecode: ${wethCode === '0x' ? '❌ No code' : `${(wethCode.length-2)/2} bytes`}`);
    const { hasDeposit, hasWithdraw } = await probeSelectors(routerWeth);
    console.log(`   deposit():  ${hasDeposit  ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   withdraw(): ${hasWithdraw ? '✅ EXISTS' : '❌ MISSING'}`);
    const wethTok = new ethers.Contract(routerWeth, ERC20_ABI, provider);
    const sym = await wethTok.symbol().catch(() => '?');
    const bal = await wethTok.balanceOf(WALLET).catch(() => 0n);
    console.log(`   symbol():   ${sym}`);
    console.log(`   Our WETH balance: ${ethers.formatEther(bal)}`);
  } catch (e) {
    console.log(`   ❌ Router.WETH() failed: ${e.message}`);
  }

  // What is native ETH balance?
  const ethBal = await provider.getBalance(WALLET);
  console.log(`\n💰 Wallet native ETH: ${ethers.formatEther(ethBal)} ETH`);
  
  if (routerWeth) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎯 ANSWER: Use Router.WETH() address for deposit() call');
    console.log(`   WETH = ${routerWeth}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
  }
}

main().catch(console.error);
