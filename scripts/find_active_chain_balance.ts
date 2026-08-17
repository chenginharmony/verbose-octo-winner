import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const address = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';

const networks = [
  { name: 'Arbitrum Sepolia (421614)', rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
  { name: 'Arbitrum Sepolia (PublicNode)', rpc: 'https://arbitrum-sepolia-rpc.publicnode.com' },
  { name: 'Base Sepolia (84532)', rpc: 'https://sepolia.base.org' },
  { name: 'Base Mainnet (8453)', rpc: 'https://mainnet.base.org' },
  { name: 'Arbitrum One (42161)', rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'Ethereum Sepolia (11155111)', rpc: 'https://rpc.sepolia.org' },
];

async function scanBalances() {
  console.log(`🔍 Scanning on-chain balances for wallet: ${address}\n`);

  for (const net of networks) {
    try {
      const provider = new ethers.JsonRpcProvider(net.rpc);
      const balance = await provider.getBalance(address);
      const nonce = await provider.getTransactionCount(address);
      const ethVal = ethers.formatEther(balance);
      const hasFunds = balance > 0n;

      console.log(`${hasFunds ? '💰' : '⚪'} ${net.name}`);
      console.log(`   Balance: ${ethVal} ETH | Nonce: ${nonce}`);
      if (hasFunds) {
        console.log(`   🎉 ACTIVE FUNDS FOUND ON ${net.name.toUpperCase()}! RPC: ${net.rpc}`);
      }
    } catch (err: any) {
      console.log(`❌ ${net.name}: ${err.message}`);
    }
  }
}

scanBalances().catch(console.error);
