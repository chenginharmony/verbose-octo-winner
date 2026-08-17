import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const privateKey = process.env.ROBINHOOD_BOT_PRIVATE_KEY || '0xc1ecffae315aaeafa23474aac85eb45fb635b01a8daf78da526edaec12235e19';
const breadAddress = process.env.ROBINHOOD_BREAD_ADDRESS || '0x7d42c122923f17B3307C0Dc13366F657186220b1';

const BREAD_ABI = [
  'function owner() view returns (address)',
  'function sweepETH() external',
  'function sweepToken(address token) external',
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const tokensToCheck = [
  { name: 'USDC', address: '0x100000000000000000000000000000000000000b', decimals: 6 },
  { name: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { name: 'HOOD', address: '0x100000000000000000000000000000000000000c', decimals: 18 },
  { name: 'BRETT', address: '0x100000000000000000000000000000000000001b', decimals: 18 },
];

async function sweepFunds() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧹 EXECUTING SWEEP: BREAD CONTRACT -> OWNER WALLET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const bread = new ethers.Contract(breadAddress, BREAD_ABI, wallet);

  console.log(`📍 Bread Contract: ${breadAddress}`);
  console.log(`👤 Recipient (Owner): ${wallet.address}`);

  const contractEthBalance = await provider.getBalance(breadAddress);
  console.log(`💰 Contract Native ETH Balance: ${ethers.formatEther(contractEthBalance)} ETH\n`);

  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 30000000n;
  const maxPriorityFeePerGas = 5000000n;
  const maxFeePerGas = (baseFee * 200n) / 100n + maxPriorityFeePerGas;

  // 1. Sweep Native ETH if any
  if (contractEthBalance > 0n) {
    console.log('🚀 Sweeping native ETH to your wallet...');
    const tx = await bread.sweepETH({
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: 80000n,
    });
    console.log(`⏳ Tx Hash: ${tx.hash}`);
    const receipt = await tx.wait(1);
    console.log(`✅ ETH Sweep Mined in Block: ${receipt.blockNumber}`);
    console.log(`🌐 Block Explorer: https://robinhoodchain.blockscout.com/tx/${tx.hash}\n`);
  } else {
    console.log('ℹ️ Contract has 0 wei native ETH. Calling sweepETH() verification transaction on-chain...');
    try {
      const tx = await bread.sweepETH({
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 80000n,
      });
      console.log(`⏳ Tx Hash: ${tx.hash}`);
      const receipt = await tx.wait(1);
      console.log(`✅ On-Chain Sweep Verified & Mined in Block: ${receipt.blockNumber}`);
      console.log(`🌐 Block Explorer: https://robinhoodchain.blockscout.com/tx/${tx.hash}\n`);
    } catch (e) {
      console.log(`Notice: ${e.message}`);
    }
  }

  // 2. Check & Sweep ERC-20 Tokens
  for (const token of tokensToCheck) {
    try {
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(breadAddress);
      const formatted = ethers.formatUnits(bal, token.decimals);
      console.log(`📦 ${token.name} Balance in Contract: ${formatted} ${token.name}`);

      if (bal > 0n) {
        console.log(`🚀 Sweeping ${formatted} ${token.name} to owner wallet...`);
        const tx = await bread.sweepToken(token.address, {
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: 100000n,
        });
        console.log(`⏳ Token Sweep Tx Hash: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`✅ ${token.name} Sweep Mined in Block: ${receipt.blockNumber}`);
        console.log(`🌐 Block Explorer: https://robinhoodchain.blockscout.com/tx/${tx.hash}\n`);
      }
    } catch {
      // Continue next token
    }
  }

  const finalWalletBal = await provider.getBalance(wallet.address);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`💰 Updated Hot Wallet Balance: ${ethers.formatEther(finalWalletBal)} ETH (~$${(Number(ethers.formatEther(finalWalletBal)) * 3000).toFixed(4)} USD)`);
  console.log(`🌐 Wallet on Explorer: https://robinhoodchain.blockscout.com/address/${wallet.address}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

sweepFunds().catch(console.error);
