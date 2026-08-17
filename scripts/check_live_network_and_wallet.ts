import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function checkLiveWallet() {
  console.log('📡 CONNECTING TO LIVE BLOCKCHAIN NETWORKS...\n');

  const privateKey = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
  const address = process.env.BASE_BOT_WALLET_ADDRESS || process.env.ROBINHOOD_BOT_WALLET_ADDRESS;

  if (!privateKey || !address) {
    console.error('❌ Missing private key or wallet address in .env');
    return;
  }

  // 1. Check Base Mainnet
  const baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  console.log(`Checking Base Mainnet (${baseRpcUrl})...`);
  try {
    const baseProvider = new ethers.JsonRpcProvider(baseRpcUrl);
    const baseNetwork = await baseProvider.getNetwork();
    const baseBalance = await baseProvider.getBalance(address);
    const baseNonce = await baseProvider.getTransactionCount(address);
    const baseFeeData = await baseProvider.getFeeData();

    console.log(`✅ Base Mainnet Connected! (Chain ID: ${baseNetwork.chainId})`);
    console.log(`   - Address: ${address}`);
    console.log(`   - On-Chain Balance: ${ethers.formatEther(baseBalance)} ETH`);
    console.log(`   - Nonce: ${baseNonce}`);
    console.log(`   - Gas Price: ${ethers.formatUnits(baseFeeData.gasPrice || 0n, 'gwei')} gwei`);
  } catch (err: any) {
    console.log(`⚠️ Base Mainnet connection failed: ${err.message}`);
  }

  // 2. Check Robinhood Chain
  const rhRpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://robinhood.gateway.dex/rpc';
  console.log(`\nChecking Robinhood Chain (${rhRpcUrl})...`);
  try {
    const rhProvider = new ethers.JsonRpcProvider(rhRpcUrl);
    const rhNetwork = await rhProvider.getNetwork();
    const rhBalance = await rhProvider.getBalance(address);
    const rhNonce = await rhProvider.getTransactionCount(address);

    console.log(`✅ Robinhood Chain Connected! (Chain ID: ${rhNetwork.chainId})`);
    console.log(`   - Address: ${address}`);
    console.log(`   - On-Chain Balance: ${ethers.formatEther(rhBalance)} ETH`);
    console.log(`   - Nonce: ${rhNonce}`);
  } catch (err: any) {
    console.log(`⚠️ Robinhood RPC endpoint (${rhRpcUrl}) connection notice: ${err.message}`);
  }
}

checkLiveWallet().catch(console.error);
