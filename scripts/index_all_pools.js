import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const RPC = 'https://developer-access-mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, 8453);

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicall = new ethers.Contract(MULTICALL3_ADDRESS, [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
], provider);

const FACTORIES = {
  BaseSwap: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
  SwapBased: '0x04C9f118d21e8B767D2e50C946f0cC9F6C367300',
  AlienBase: '0x3E84D913803b02A4a7f027165E8cA42C14C0FdE7'
};

const WETH = '0x4200000000000000000000000000000000000006';
const REGISTRY_FILE = path.join(process.cwd(), 'data', 'pools_registry.json');

const factoryIface = new ethers.Interface([
  'function getPair(address, address) view returns (address)'
]);
const pairIface = new ethers.Interface([
  'function token0() view returns (address)'
]);

const TOP_BASE_TOKENS = [
  { symbol: 'USDC', addr: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { symbol: 'USDbC', addr: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' },
  { symbol: 'DAI', addr: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' },
  { symbol: 'cbETH', addr: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' },
  { symbol: 'wstETH', addr: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452' },
  { symbol: 'TOSHI', addr: '0xac3211a50254149e59203673f9217646549e7090' },
  { symbol: 'DEGEN', addr: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
  { symbol: 'BRETT', addr: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
  { symbol: 'AERO', addr: '0x940181a94a35a4569e4529a3cdfb74e438e73580' },
  { symbol: 'HIGHER', addr: '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe' },
  { symbol: 'VIRTUAL', addr: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b' },
  { symbol: 'CLANKER', addr: '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb' },
  { symbol: 'KEYCAT', addr: '0x9a26f5433671751c3276a26524315446dd1ecc82' },
  { symbol: 'MOCHI', addr: '0xf6e932ca12afa26665dc4dde7e27be02a7669e50' },
  { symbol: 'NORMIE', addr: '0x7f12d43b53671407868050643494077f55c8429c' },
  { symbol: 'SEAM', addr: '0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85' },
  { symbol: 'BSWAP', addr: '0x78a087d713be963bf307b18f2ff8122ef9a63ae9' },
  { symbol: 'ALB', addr: '0x1dd2d631c92b68df9ad7a7a3b155c991d474c29d' },
  { symbol: 'BASED', addr: '0xd07379a755a8f10d46864d3006cf65279fe6ab33' },
  { symbol: 'SKI', addr: '0x76a6642c92435b473766b7512224322238472421' },
  { symbol: 'MOG', addr: '0x2da56acb9ea78330f947bd57c54119debda7af71' },
  { symbol: 'BENJI', addr: '0xbc45647ea894030a4e9801ec03f73194bce29c12' },
  { symbol: 'TYBG', addr: '0x0d97f261b1e88845f81716070093a4b6c7e2e089' },
  { symbol: 'DOGINME', addr: '0x6921b130d297cc43754afba22e5eac0fbf8db75b' },
  { symbol: 'TN100X', addr: '0x5b5dee44552546ecea05edea0439418363098620' },
  { symbol: 'ROOST', addr: '0xe1abd004250ac8d1f199421d647e01d094faa180' },
  { symbol: 'EZETH', addr: '0x2416092f143378750bb29b79ed961ab195cceea5' },
  { symbol: 'RSETH', addr: '0x4186bfc76e2e237523cbc30fd220fe055156b41f' },
  { symbol: 'WEETH', addr: '0x04c0599ae5a44757c0af6f9ec3b93da8976c150a' },
  { symbol: 'SNX', addr: '0x22e6966b799c4d5b13be962e1d117b56327fda66' },
  { symbol: 'CRV', addr: '0x8ee73c484a26106699652b06b27e11285b023421' },
  { symbol: 'UNI', addr: '0x6fda405d61e9ce2182941605e528d80c5d6664da' }
];

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       🚀 FAST MULTICALL3 V2 POOL DISCOVERY MATRIX         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  let existing = { lastScannedBlock: 0, tokens: {} };
  if (fs.existsSync(REGISTRY_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    } catch {}
  }
  const allDiscovered = { ...existing.tokens };

  // Build chunked Multicall3 requests to avoid rate limits
  const cleanTokens = [];
  for (const token of TOP_BASE_TOKENS) {
    try {
      cleanTokens.push({ ...token, addr: ethers.getAddress(token.addr.toLowerCase()) });
    } catch {}
  }

  const foundPairs = [];
  const CHUNK_SIZE = 8; // 8 tokens * 3 DEXs = 24 calls per batch

  console.log(`📡 Querying ${cleanTokens.length} tokens across ${Object.keys(FACTORIES).length} DEXs in gentle chunks...`);

  for (let i = 0; i < cleanTokens.length; i += CHUNK_SIZE) {
    const chunk = cleanTokens.slice(i, i + CHUNK_SIZE);
    const calls = [];
    const meta = [];

    for (const token of chunk) {
      for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
        calls.push({
          target: factoryAddr,
          allowFailure: true,
          callData: factoryIface.encodeFunctionData('getPair', [WETH, token.addr])
        });
        meta.push({ dex, token });
      }
    }

    try {
      const results = await multicall.aggregate3(calls);
      for (let j = 0; j < results.length; j++) {
        const res = results[j];
        const { dex, token } = meta[j];
        if (res.success && res.returnData !== '0x') {
          const pairAddr = factoryIface.decodeFunctionResult('getPair', res.returnData)[0];
          if (pairAddr && pairAddr !== ethers.ZeroAddress) {
            foundPairs.push({ dex, token, pairAddr });
          }
        }
      }
    } catch (e) {
      console.log(`  Chunk ${i / CHUNK_SIZE + 1} warning: ${e.message}`);
    }

    process.stdout.write(`  Indexed ${Math.min(i + CHUNK_SIZE, cleanTokens.length)}/${cleanTokens.length} tokens (found ${foundPairs.length} pools)...\r`);
    await new Promise(r => setTimeout(r, 250)); // 250ms spacing
  }

  console.log(`\n✅ Found ${foundPairs.length} active liquidity pairs on-chain!`);

  // Query token0 for orientation (isWeth0) in gentle chunks
  for (let i = 0; i < foundPairs.length; i += 15) {
    const chunk = foundPairs.slice(i, i + 15);
    const orientationCalls = chunk.map(p => ({
      target: p.pairAddr,
      allowFailure: true,
      callData: pairIface.encodeFunctionData('token0')
    }));

    try {
      const orientationResults = await multicall.aggregate3(orientationCalls);
      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        const res = orientationResults[j];
        let isWeth0 = true;
        if (res.success && res.returnData !== '0x') {
          const t0 = pairIface.decodeFunctionResult('token0', res.returnData)[0];
          isWeth0 = t0.toLowerCase() === WETH.toLowerCase();
        }

        const normAddr = ethers.getAddress(p.token.addr.toLowerCase());
        if (!allDiscovered[normAddr]) allDiscovered[normAddr] = {};
        allDiscovered[normAddr][p.dex] = {
          pairAddr: ethers.getAddress(p.pairAddr.toLowerCase()),
          isWeth0,
          symbol: p.token.symbol
        };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  // Summary of Cross-DEX Candidates
  let candidateTokens = 0;
  let candidatePoolCount = 0;
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 CROSS-DEX ARBITRAGE CANDIDATES IDENTIFIED:');
  console.log('═══════════════════════════════════════════════════════════');

  for (const [tAddr, dexMap] of Object.entries(allDiscovered)) {
    const dexes = Object.keys(dexMap);
    if (dexes.length >= 2) {
      candidateTokens++;
      candidatePoolCount += dexes.length;
      const sym = Object.values(dexMap)[0].symbol;
      console.log(`  🪙 ${sym.padEnd(10)} (${tAddr}) -> Present on [${dexes.join(', ')}]`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Total Discovered Tokens: ${Object.keys(allDiscovered).length}`);
  console.log(`🔥 Multi-DEX Candidate Tokens (≥2 DEXs): ${candidateTokens}`);
  console.log(`⚡ Total Multi-DEX Pools Monitored: ${candidatePoolCount}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const currentBlock = await provider.getBlockNumber();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify({
    lastScannedBlock: currentBlock,
    tokens: allDiscovered
  }, null, 2));

  console.log(`💾 Saved updated pool registry to ${REGISTRY_FILE}`);
}

main().catch(console.error);

