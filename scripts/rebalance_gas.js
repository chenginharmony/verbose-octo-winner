import 'dotenv/config';
import { ethers } from 'ethers';

const RPC = 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 8453, name: 'base' }, { staticNetwork: true });

const PK = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
if (!PK) {
  console.error('❌ Private key missing.');
  process.exit(1);
}

const wallet = new ethers.Wallet(PK, provider);
const BREAD_ROUTER = process.env.BREAD_ROUTER_ADDRESS || '0x91d567073d3C389564bd446Ffddb6D2a541b11E7';
const WETH = '0x4200000000000000000000000000000000000006';

const BREAD_ABI = [
  'function sweepToken(address token) external',
  'function sweepETH() external'
];

const WETH_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function withdraw(uint256 wad) external'
];

async function rebalanceGas() {
  console.log('🔄 Rebalancing WETH to Native ETH for Gas...');
  console.log('   Wallet:        ', wallet.address);
  console.log('   Bread Contract:', BREAD_ROUTER);

  const bread = new ethers.Contract(BREAD_ROUTER, BREAD_ABI, wallet);
  const weth = new ethers.Contract(WETH, WETH_ABI, wallet);

  const breadWethBal = await weth.balanceOf(BREAD_ROUTER);
  const walletEthBefore = await provider.getBalance(wallet.address);
  console.log(`\n📊 Current Balances:`);
  console.log(`   Bread WETH:  ${ethers.formatEther(breadWethBal)} WETH`);
  console.log(`   Wallet ETH:  ${ethers.formatEther(walletEthBefore)} ETH`);

  if (breadWethBal === 0n) {
    console.log('⚠️ No WETH in Bread contract to convert.');
    return;
  }

  // Target conversion amount: 0.00030 WETH (~$0.75 USD for gas)
  const CONVERT_AMOUNT = ethers.parseEther('0.00030');
  const keepInBread = breadWethBal > CONVERT_AMOUNT ? breadWethBal - CONVERT_AMOUNT : 0n;
  const toConvert = breadWethBal - keepInBread;

  console.log(`\n⚡ Step 1: Sweeping WETH from Bread contract to wallet...`);
  const sweepTx = await bread.sweepToken(WETH, { gasLimit: 100000 });
  console.log(`   Tx: ${sweepTx.hash}`);
  await sweepTx.wait(1);

  console.log(`⚡ Step 2: Unwrapping ${ethers.formatEther(toConvert)} WETH -> Native ETH...`);
  const unwrapTx = await weth.withdraw(toConvert, { gasLimit: 100000 });
  console.log(`   Tx: ${unwrapTx.hash}`);
  await unwrapTx.wait(1);

  if (keepInBread > 0n) {
    console.log(`⚡ Step 3: Returning ${ethers.formatEther(keepInBread)} WETH back to Bread contract...`);
    const returnTx = await weth.transfer(BREAD_ROUTER, keepInBread, { gasLimit: 100000 });
    console.log(`   Tx: ${returnTx.hash}`);
    await returnTx.wait(1);
  }

  const [walletEthAfter, walletWethAfter, breadWethAfter] = await Promise.all([
    provider.getBalance(wallet.address),
    weth.balanceOf(wallet.address),
    weth.balanceOf(BREAD_ROUTER)
  ]);

  console.log(`\n🎉 Rebalance Successful!`);
  console.log(`   Wallet Native ETH (Gas): ${ethers.formatEther(walletEthAfter)} ETH (~$${(Number(ethers.formatEther(walletEthAfter)) * 1882.5).toFixed(2)})`);
  console.log(`   Bread Trading WETH:      ${ethers.formatEther(breadWethAfter)} WETH (~$${(Number(ethers.formatEther(breadWethAfter)) * 1882.5).toFixed(2)})`);
}

rebalanceGas().catch(err => {
  console.error('❌ Rebalance Failed:', err);
});
