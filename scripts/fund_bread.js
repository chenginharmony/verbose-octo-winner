import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const PK = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const BREAD_ROUTER = process.env.BREAD_ROUTER_ADDRESS;
const WETH = '0x4200000000000000000000000000000000000006';

const WETH_ABI = [
  'function deposit() public payable',
  'function transfer(address to, uint value) public returns (bool)'
];

async function main() {
  if (!BREAD_ROUTER) {
    console.error('❌ BREAD_ROUTER_ADDRESS not found in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC, 8453);
  const wallet = new ethers.Wallet(PK, provider);
  const wethContract = new ethers.Contract(WETH, WETH_ABI, wallet);

  console.log(`Checking balances for: ${wallet.address}`);
  const ethBal = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.formatEther(ethBal)} ETH`);

  // We need to keep ~0.0001 ETH ($0.25) for gas fees, fund the rest to Bread
  const gasReserve = ethers.parseEther('0.0001');
  
  if (ethBal <= gasReserve) {
    console.error(`\n❌ You do not have enough ETH. Please deposit at least 0.0002 ETH to fund the contract and cover gas.`);
    process.exit(1);
  }

  const fundAmount = ethBal - gasReserve;
  console.log(`\nWrapping ${ethers.formatEther(fundAmount)} ETH into WETH...`);

  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 1000000n;
  const maxFee = (baseFee * 150n) / 100n + 50000n;

  const tx1 = await wethContract.deposit({ 
    value: fundAmount,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: 50000n 
  });
  console.log(`   Tx: ${tx1.hash}`);
  await tx1.wait();
  console.log(`✅ Wrapped to WETH successfully.`);

  console.log(`\nTransferring WETH to Bread.sol (${BREAD_ROUTER})...`);
  const tx2 = await wethContract.transfer(BREAD_ROUTER, fundAmount, {
    gasLimit: 100000n,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: 50000n 
  });
  console.log(`   Tx: ${tx2.hash}`);
  await tx2.wait();
  console.log(`✅ Bread.sol is funded and ready for Arbitrage!`);
}

main().catch(console.error);
