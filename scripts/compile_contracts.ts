import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore
import solc from 'solc';

async function compile() {
  console.log('🔨 Compiling SandwichExecutor.sol with Solidity 0.8.20 (200 Optimizer Runs)...');

  const contractPath = path.resolve(process.cwd(), 'contracts', 'SandwichExecutor.sol');
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'SandwichExecutor.sol': {
        content: sourceCode,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'evm.gasEstimates'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasFatal = false;
    for (const err of output.errors) {
      if (err.severity === 'error') {
        console.error('❌ Solidity Error:', err.formattedMessage);
        hasFatal = true;
      } else {
        console.warn('⚠️ Solidity Warning:', err.formattedMessage);
      }
    }
    if (hasFatal) {
      process.exit(1);
    }
  }

  const contract = output.contracts['SandwichExecutor.sol']['SandwichExecutor'];
  const bytecode = contract.evm.bytecode.object;
  const deployedBytecode = contract.evm.deployedBytecode.object;
  const abi = contract.abi;
  const methodIdentifiers = contract.evm.methodIdentifiers;

  const artifact = {
    contractName: 'SandwichExecutor',
    sourcePath: 'contracts/SandwichExecutor.sol',
    compilerVersion: '0.8.20+commit.a1b79de6',
    optimizer: { enabled: true, runs: 200 },
    abi,
    bytecode: `0x${bytecode}`,
    deployedBytecode: `0x${deployedBytecode}`,
    bytecodeSizeBytes: bytecode.length / 2,
    methodIdentifiers,
    compiledAt: new Date().toISOString(),
  };

  const artifactsDir = path.resolve(process.cwd(), 'contracts', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const outputPath = path.join(artifactsDir, 'SandwichExecutor.json');
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

  console.log(`✅ Compilation successful!`);
  console.log(`📁 Artifact written to: contracts/artifacts/SandwichExecutor.json`);
  console.log(`📊 Bytecode Size: ${artifact.bytecodeSizeBytes} bytes`);
  console.log(`🔑 Function Selectors:`, methodIdentifiers);
}

compile().catch((err) => {
  console.error('Compilation failed:', err);
  process.exit(1);
});
