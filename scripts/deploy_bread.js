import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const PK  = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const WETH = '0x4200000000000000000000000000000000000006';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, 8453);
  const wallet   = new ethers.Wallet(PK, provider);

  console.log(`Deploying from: ${wallet.address}`);
  const ethBal = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(ethBal)} ETH`);

  const abiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts_Bread_sol_Bread.abi');
  const binPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts_Bread_sol_Bread.bin');
  
  if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
    console.error('❌ Artifacts not found. Please compile Bread.sol first.');
    process.exit(1);
  }

  const abi = fs.readFileSync(abiPath, 'utf8');
  const bin = fs.readFileSync(binPath, 'utf8');

  const factory = new ethers.ContractFactory(abi, bin, wallet);

  console.log('Deploying Bread.sol (Atomic Arbitrage Router)...');
  
  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 1000000n;
  const maxFee = (baseFee * 150n) / 100n + 50000n;

  const contract = await factory.deploy(WETH, {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: 50000n
  });
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`✅ Bread deployed successfully to: ${address}`);

  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (envContent.includes('BREAD_ROUTER_ADDRESS')) {
    envContent = envContent.replace(/BREAD_ROUTER_ADDRESS=.*/, `BREAD_ROUTER_ADDRESS=${address}`);
  } else {
    envContent += `\nBREAD_ROUTER_ADDRESS=${address}\n`;
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('Saved to .env');
}

main().catch(console.error);
