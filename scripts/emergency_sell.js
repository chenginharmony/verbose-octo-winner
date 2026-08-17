import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const PK  = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const WETH = '0x4200000000000000000000000000000000000006';
const UNISWAP_V2_ROUTER = '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24';

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const ROUTER_ABI = [
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, 8453);
  const wallet   = new ethers.Wallet(PK, provider);
  const router   = new ethers.Contract(UNISWAP_V2_ROUTER, ROUTER_ABI, wallet);

  const snipedFile = path.join(process.cwd(), 'state', 'sniped_tokens.json');
  if (!fs.existsSync(snipedFile)) {
    console.log('No sniped tokens found.');
    return;
  }

  const tokens = JSON.parse(fs.readFileSync(snipedFile, 'utf8'));
  console.log(`Checking ${tokens.length} tokens for remaining balances...`);

  for (const tokenAddr of tokens) {
    try {
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
      const symbol = await contract.symbol().catch(() => 'TOKEN');
      const bal = await contract.balanceOf(wallet.address);

      if (bal > 0n) {
        console.log(`Found balance of ${bal.toString()} for ${symbol} (${tokenAddr})`);
        
        console.log(`Approving...`);
        const approveTx = await contract.approve(UNISWAP_V2_ROUTER, ethers.MaxUint256);
        await approveTx.wait(1);

        const block = await provider.getBlock('latest');
        const baseFee = block?.baseFeePerGas || 1000000n;
        const maxFee = (baseFee * 150n) / 100n + 50000n;
        const deadline = Math.floor(Date.now() / 1000) + 120;

        console.log(`Selling ${symbol}...`);
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          bal,
          1n, // Accept any amount back
          [tokenAddr, WETH],
          wallet.address,
          deadline,
          { gasLimit: 300000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: 50000n }
        );

        console.log(`Tx broadcasted: ${tx.hash}`);
        await tx.wait(1);
        console.log(`✅ Sold ${symbol}!`);
      } else {
        console.log(`Empty balance for ${symbol}`);
      }
    } catch (err) {
      console.log(`Failed to sell ${tokenAddr}: ${err.message}`);
    }
  }

  console.log('Clearing bot state...');
  fs.writeFileSync(path.join(process.cwd(), 'state', 'base_positions.json'), '{}');
  fs.writeFileSync(path.join(process.cwd(), 'state', 'blocked_positions.json'), '[]');
  console.log('Done!');
}

main();
