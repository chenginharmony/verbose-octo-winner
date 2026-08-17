import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const address = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const tokens = [
  { name: 'USDC', address: '0x100000000000000000000000000000000000000b', decimals: 6 },
  { name: 'HOOD', address: '0x100000000000000000000000000000000000000c', decimals: 18 },
  { name: 'BRETT', address: '0x100000000000000000000000000000000000001b', decimals: 18 },
  { name: 'PEPE', address: '0x100000000000000000000000000000000000000e', decimals: 18 },
];

async function checkPortfolio() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💼 HOT WALLET COMPLETE ON-CHAIN PORTFOLIO AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const ethBalance = await provider.getBalance(address);
  const nonce = await provider.getTransactionCount(address);
  const blockNumber = await provider.getBlockNumber();

  console.log(`🌐 Network: Robinhood Chain Mainnet (Chain ID: 4663)`);
  console.log(`👤 Hot Wallet: ${address}`);
  console.log(`📦 Current Block: ${blockNumber}`);
  console.log(`🔢 Confirmed Nonce: ${nonce}\n`);

  console.log('--- 🪙 NATIVE & ERC-20 ON-CHAIN BALANCES ---');
  console.log(`1. Native ETH (Gas Asset):`);
  console.log(`   - Raw: ${ethBalance.toString()} wei`);
  console.log(`   - Formatted: ${ethers.formatEther(ethBalance)} ETH (~$${(Number(ethers.formatEther(ethBalance)) * 3000).toFixed(4)} USD)`);

  for (const token of tokens) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const bal = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(bal, token.decimals);
      console.log(`2. ${token.name} Token (${token.address.slice(0, 10)}...):`);
      console.log(`   - Balance: ${formatted} ${token.name}`);
    } catch {
      console.log(`2. ${token.name} Token: [Not deployed or non-standard ERC20 interface]`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

checkPortfolio().catch(console.error);
