import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const walletAddress = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';

const BASE_TOKENS = [
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { symbol: 'BRETT', address: '0x532f2710150E2112bd7CD5375027408856125011', decimals: 18 },
  { symbol: 'DEGEN', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18 },
  { symbol: 'AERO', address: '0x940181A94A35a4569E4529A3cDfb74e48fD986cA', decimals: 18 },
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

async function checkBaseWallet() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔵 BASE MAINNET LIVE WALLET & LIQUIDITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(baseRpcUrl, 8453);
  const blockNumber = await provider.getBlockNumber();
  const ethBalance = await provider.getBalance(walletAddress);
  const nonce = await provider.getTransactionCount(walletAddress);

  console.log(`🌐 Target Network: Base Mainnet (Chain ID: 8453)`);
  console.log(`📦 Current Block Height: ${blockNumber}`);
  console.log(`👤 Hot Wallet Address: ${walletAddress}`);
  console.log(`🔢 Nonce on Base: ${nonce}`);
  console.log(`⛽ Native ETH Balance: ${ethers.formatEther(ethBalance)} ETH (~$${(Number(ethers.formatEther(ethBalance)) * 3000).toFixed(4)} USD)\n`);

  console.log('--- 🪙 LIVE BASE ERC-20 TOKEN BALANCES ---');
  let hasWorkingCapital = Number(ethers.formatEther(ethBalance)) > 0.001;

  for (const token of BASE_TOKENS) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const bal = await contract.balanceOf(walletAddress);
      const formatted = ethers.formatUnits(bal, token.decimals);
      console.log(`- ${token.symbol}: ${formatted} ${token.symbol}`);
      if (Number(formatted) > 0) hasWorkingCapital = true;
    } catch (e) {
      console.log(`- ${token.symbol}: 0.0`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (Number(ethers.formatEther(ethBalance)) === 0) {
    console.log('⚠️ Notice: Wallet has 0 ETH on Base Mainnet.');
    console.log('To execute live trades and pay Base gas, please fund:');
    console.log(`👉 Address: ${walletAddress}`);
    console.log('👉 Network: Base (Chain ID: 8453)');
    console.log('👉 Recommended Amount: 0.005 ETH (~$15 USD) or $10-$50 in USDC');
  } else {
    console.log('✅ Wallet has live funds on Base Mainnet ready for execution!');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkBaseWallet().catch(console.error);
