import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const walletAddress = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';

async function checkRobinhoodStatus() {
  const provider = new ethers.JsonRpcProvider(rpcUrl, 4663);
  const balanceWei = await provider.getBalance(walletAddress);
  const nonce = await provider.getTransactionCount(walletAddress);
  const ethBalance = ethers.formatEther(balanceWei);
  const ethPrice = 1882.50; // Current Robinhood Chain ETH price from user blockscout
  const balanceUsd = Number(ethBalance) * ethPrice;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 ROBINHOOD CHAIN MAINNET LIVE ON-CHAIN STATUS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`👤 Hot Wallet Address: ${walletAddress}`);
  console.log(`🔢 Total Confirmed Transactions (Nonce): ${nonce}`);
  console.log(`⛽ Current ETH Balance: ${ethBalance} ETH ($${balanceUsd.toFixed(4)} USD)`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkRobinhoodStatus().catch(console.error);
