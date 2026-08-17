import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const privateKey = process.env.ROBINHOOD_BOT_PRIVATE_KEY || '0xc1ecffae315aaeafa23474aac85eb45fb635b01a8daf78da526edaec12235e19';

async function deployBread() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🍞 DEPLOYING BREAD CONTRACT TO ROBINHOOD CHAIN MAINNET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`👤 Deployer Address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Read Solidity source code
  const contractPath = path.resolve('contracts', 'Bread.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  console.log('⚙️ Compiling Bread.sol using solc v0.8.20...');
  const input = {
    language: 'Solidity',
    sources: {
      'Bread.sol': {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === 'error') {
        throw new Error(`Solidity Compilation Error: ${err.formattedMessage}`);
      }
    }
  }

  const contractOutput = output.contracts['Bread.sol']['Bread'];
  const abi = contractOutput.abi;
  const bytecode = contractOutput.evm.bytecode.object;

  console.log('✅ Compilation successful!');
  console.log(`📦 Bytecode size: ${bytecode.length / 2} bytes\n`);

  // 2. Deploy contract using ContractFactory
  console.log('📡 Broadcasting Bread deployment transaction to Robinhood Chain RPC...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  const wethAddress = '0x4200000000000000000000000000000000000006';
  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 30000000n;
  const maxPriorityFeePerGas = 5000000n;
  const maxFeePerGas = (baseFee * 200n) / 100n + maxPriorityFeePerGas;

  console.log(`⛽ Using maxFeePerGas: ${ethers.formatUnits(maxFeePerGas, 'gwei')} Gwei`);

  const deployTx = await factory.deploy(wethAddress, {
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit: 1200000n,
  });

  console.log(`⏳ Deployment Transaction Hash: ${deployTx.deploymentTransaction()?.hash}`);
  console.log('⏳ Waiting for block confirmation on-chain...');

  const contract = await deployTx.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const txReceipt = await deployTx.deploymentTransaction()?.wait(1);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 BREAD CONTRACT DEPLOYED ON-CHAIN SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📍 Contract Name: Bread`);
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`📦 Mined in Block: ${txReceipt?.blockNumber}`);
  console.log(`⛽ Gas Used: ${txReceipt?.gasUsed.toString()} units`);
  console.log(`🌐 Blockscout Explorer: https://robinhoodchain.blockscout.com/address/${contractAddress}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Save address to artifacts
  const outDir = path.resolve('contracts', 'artifacts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'Bread.json'),
    JSON.stringify({ name: 'Bread', address: contractAddress, abi, network: 'Robinhood Chain Mainnet', chainId: 4663 }, null, 2)
  );

  return contractAddress;
}

deployBread().catch(console.error);
