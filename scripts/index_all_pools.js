import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const RPC = 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 8453, name: 'base' }, { staticNetwork: true });

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicall = new ethers.Contract(MULTICALL3_ADDRESS, [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
], provider);

const FACTORIES = {
  UniswapV2: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
  Aerodrome: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
  SushiSwap: '0x71524B4f93c58fcbF659783284E38825f0622859',
  BaseSwap: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
  AlienBase: '0x3E84D913803b02A4a7f027165E8cA42C14C0FdE7'
};

const WETH = '0x4200000000000000000000000000000000000006';
const REGISTRY_FILE = path.join(process.cwd(), 'data', 'pools_registry.json');

const factoryIface = new ethers.Interface([
  'function getPair(address, address) view returns (address)'
]);
const aeroIface = new ethers.Interface([
  'function getPool(address, address, bool) view returns (address)'
]);
const pairIface = new ethers.Interface([
  'function token0() view returns (address)'
]);

const MEME_AND_CORE_TOKENS = [
  // Major Meme Coins on Base
  { symbol: 'BRETT', addr: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
  { symbol: 'DEGEN', addr: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
  { symbol: 'TOSHI', addr: '0xac3211a50254149e59203673f9217646549e7090' },
  { symbol: 'KEYCAT', addr: '0x9a26f5433671751c3276a065f57e5a02d2817973' },
  { symbol: 'MOCHI', addr: '0xf6e932ca12afa26665dc4dde7e27be02a7669e50' },
  { symbol: 'NORMIE', addr: '0x7f12d43b53671407868050643494077f55c8429c' },
  { symbol: 'MOG', addr: '0x2da56acb9ea78330f947bd57c54119debda7af71' },
  { symbol: 'TYBG', addr: '0x0d97f261b1e88845f81716070093a4b6c7e2e089' },
  { symbol: 'DOGINME', addr: '0x6921b130d297cc43754afba22e5eac0fbf8db75b' },
  { symbol: 'HIGHER', addr: '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe' },
  { symbol: 'VIRTUAL', addr: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b' },
  { symbol: 'CLANKER', addr: '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb' },
  { symbol: 'CHOMP', addr: '0xe3c4baa68b60e589f77f54c2579df6469619669e' },
  { symbol: 'MIGGLES', addr: '0xbbcfe075253818e69d7249a5b7ff22ebaa803ec2' },
  { symbol: 'SKI', addr: '0x76427245647a748c9df17434a9496a7ef64ee800' },
  { symbol: 'BASED', addr: '0x018b14421ea9ec0d3dcbb39f972bcae2f1f50689' },
  { symbol: 'FOFAR', addr: '0xeff38fb87d7b003a274534fb68d9e6eb73f15c7e' },
  { symbol: 'BOOMER', addr: '0xb46166371c667431264c9bf6fa5947a79e43b174' },
  { symbol: 'BSTONK', addr: '0x0f61edbfe6cd86024c0f210c0695b08df55fdfc9' },
  { symbol: 'MEOW', addr: '0x03ee11923326d54a580af44ec633f1cdcb414632' },
  { symbol: 'Basecat', addr: '0xb2000000000000000000004c27f6523082f41d01' },
  { symbol: 'ROOST', addr: '0xe1a0ddeb706684169879756c9a591179469385b3' },
  { symbol: 'BENJI', addr: '0xbc45647ea894030a4e9801ec03479739fa983b4d' },
  { symbol: 'PEPE', addr: '0x52b492a33e447cdb854c7fc19f1e5648d6117263' },
  { symbol: 'SHIB', addr: '0x4642995b018dd0c83eb6d3e3ba4cb9b014be3618' },
  { symbol: 'ELSA', addr: '0x0bc989104ad5c40464f1d39f40822659e98e7278' },
  { symbol: 'VVV', addr: '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf' },
  { symbol: 'BRIAN', addr: '0x5d9ab553cfb9b80b27b3b9b47e828d57865c3bb5' },
  { symbol: 'ALB', addr: '0x1dd2d631c92b68df9ad7a7a3b155c991d474c29d' },
  { symbol: 'BSWAP', addr: '0x78a087d713be963bf307b18f2ff8122ef9a63ae9' },
  { symbol: 'SEAM', addr: '0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85' },
  { symbol: 'AERO', addr: '0x940181a94a35a4569e4529a3cdfb74e438e73580' },
  // Major Base Core / DeFi
  { symbol: 'USDC', addr: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { symbol: 'USDbC', addr: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' },
  { symbol: 'USDT', addr: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2' },
  { symbol: 'DAI', addr: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' },
  { symbol: 'cbETH', addr: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' },
  { symbol: 'wstETH', addr: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452' },
  { symbol: 'cbBTC', addr: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' },
  { symbol: 'EZETH', addr: '0x2416092f143378750bb29b79ed961ab195cceea5' },
  { symbol: 'WEETH', addr: '0x04c0599ae5a44757c0af6f9ec3b93da8976c150a' },
  { symbol: 'SNX', addr: '0x22e6966b799c4d5b13be962e1d117b56327fda66' },
  { symbol: 'CRV', addr: '0x8ee73c484a26106699652b06b27e11285b023421' },
  { symbol: 'UNI', addr: '0x6fd9d7ad17242c41f7131d257212c54a0e816691' }
];

async function fetchGeckoTokens() {
  console.log('📡 Fetching active trending + new + top meme coins from GeckoTerminal Base...');
  const discoveredMap = new Map();

  for (const t of MEME_AND_CORE_TOKENS) {
    discoveredMap.set(t.addr.toLowerCase(), t.symbol);
  }

  const endpoints = [
    'https://api.geckoterminal.com/api/v2/networks/base/trending_pools',
    'https://api.geckoterminal.com/api/v2/networks/base/new_pools'
  ];
  for (let i = 1; i <= 8; i++) {
    endpoints.push(`https://api.geckoterminal.com/api/v2/networks/base/pools?page=${i}`);
  }

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) continue;

      for (const pool of data.data) {
        const baseAddr = pool.relationships?.base_token?.data?.id?.replace('base_', '');
        const quoteAddr = pool.relationships?.quote_token?.data?.id?.replace('base_', '');
        const name = pool.attributes?.name || '';
        const parts = name.split(' / ');

        if (baseAddr && ethers.isAddress(baseAddr) && baseAddr.toLowerCase() !== WETH.toLowerCase() && !discoveredMap.has(baseAddr.toLowerCase())) {
          discoveredMap.set(baseAddr.toLowerCase(), parts[0]?.replace(/\s.*$/, '') || 'TOKEN');
        }
        if (quoteAddr && ethers.isAddress(quoteAddr) && quoteAddr.toLowerCase() !== WETH.toLowerCase() && !discoveredMap.has(quoteAddr.toLowerCase())) {
          discoveredMap.set(quoteAddr.toLowerCase(), parts[1]?.replace(/\s.*$/, '') || 'TOKEN');
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`✅ Discovered ${discoveredMap.size} unique candidate meme & trading tokens.`);
  return Array.from(discoveredMap.entries()).map(([addr, symbol]) => ({ addr, symbol }));
}

async function indexAll() {
  const tokenUniverse = await fetchGeckoTokens();
  console.log(`\n🔍 Querying Multicall3 across ${Object.keys(FACTORIES).join(', ')}...`);

  const calls = [];
  const queryMeta = [];

  for (const token of tokenUniverse) {
    for (const [dexName, factoryAddr] of Object.entries(FACTORIES)) {
      if (dexName === 'Aerodrome') {
        calls.push({
          target: factoryAddr,
          allowFailure: true,
          callData: aeroIface.encodeFunctionData('getPool', [WETH, token.addr, false])
        });
      } else {
        calls.push({
          target: factoryAddr,
          allowFailure: true,
          callData: factoryIface.encodeFunctionData('getPair', [WETH, token.addr])
        });
      }
      queryMeta.push({ dex: dexName, tokenAddr: token.addr.toLowerCase(), symbol: token.symbol });
    }
  }

  console.log(`   Executing ${calls.length} Multicall3 pair checks in a single batch...`);
  const results = await multicall.aggregate3(calls);

  const validPairs = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const meta = queryMeta[i];
    if (r.success && r.returnData !== '0x') {
      const decoded = meta.dex === 'Aerodrome' 
        ? aeroIface.decodeFunctionResult('getPool', r.returnData)
        : factoryIface.decodeFunctionResult('getPair', r.returnData);
      const pairAddr = decoded[0];
      if (pairAddr && pairAddr !== ethers.ZeroAddress) {
        validPairs.push({
          dex: meta.dex,
          tokenAddr: meta.tokenAddr,
          symbol: meta.symbol,
          pairAddr
        });
      }
    }
  }

  console.log(`✅ Discovered ${validPairs.length} active WETH pairs.`);

  // Check token0 orientations
  const t0Calls = validPairs.map(p => ({
    target: p.pairAddr,
    allowFailure: true,
    callData: pairIface.encodeFunctionData('token0')
  }));

  const t0Results = await multicall.aggregate3(t0Calls);
  for (let i = 0; i < validPairs.length; i++) {
    const r = t0Results[i];
    if (r.success && r.returnData !== '0x') {
      const decoded = pairIface.decodeFunctionResult('token0', r.returnData);
      validPairs[i].token0 = decoded[0];
      validPairs[i].isWeth0 = decoded[0].toLowerCase() === WETH.toLowerCase();
    } else {
      validPairs[i].isWeth0 = true;
    }
  }

  // Build multi-DEX candidate registry
  const registry = {
    updatedAt: new Date().toISOString(),
    factories: FACTORIES,
    tokens: {}
  };

  for (const pair of validPairs) {
    if (!registry.tokens[pair.tokenAddr]) {
      registry.tokens[pair.tokenAddr] = {};
    }
    registry.tokens[pair.tokenAddr][pair.dex] = {
      pairAddr: pair.pairAddr,
      symbol: pair.symbol,
      isWeth0: pair.isWeth0
    };
  }

  // Filter to multi-DEX tokens only (exists on >= 2 DEXs)
  const multiDexTokens = {};
  let totalCandidatePools = 0;

  for (const [tAddr, dexMap] of Object.entries(registry.tokens)) {
    const dexCount = Object.keys(dexMap).length;
    if (dexCount >= 2) {
      multiDexTokens[tAddr] = dexMap;
      totalCandidatePools += dexCount;
    }
  }

  registry.tokens = multiDexTokens;
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));

  console.log(`\n🎉 Pool Indexing Complete!`);
  console.log(`   Multi-DEX Candidate Tokens (≥2 DEXs): ${Object.keys(multiDexTokens).length}`);
  console.log(`   Total Cross-DEX Pools Monitored:       ${totalCandidatePools}`);
  console.log(`   Active Matrix: ${Object.keys(FACTORIES).join(' ↔️ ')}`);
  console.log(`   Registry saved to: ${REGISTRY_FILE}\n`);

  for (const [tAddr, dexMap] of Object.entries(multiDexTokens)) {
    const sym = Object.values(dexMap)[0].symbol;
    const dexList = Object.keys(dexMap).join(' ↔️ ');
    console.log(`   • ${sym.padEnd(10)} [${dexList}]`);
  }
}

indexAll().catch(err => {
  console.error('Indexing Failed:', err);
});
