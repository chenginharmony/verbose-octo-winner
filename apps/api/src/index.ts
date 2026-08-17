import path from 'node:path';
import dotenv from 'dotenv';
import { createServer } from './server.js';

// Resolve .env from cwd and workspace root
dotenv.config({ override: true });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const port = Number(process.env.API_PORT) || 4000;
const targetChain = (process.env.TARGET_CHAIN || 'ROBINHOOD').toUpperCase();
const rpcUrl = targetChain === 'BASE'
  ? (process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  : (process.env.ROBINHOOD_RPC_URL && !process.env.ROBINHOOD_RPC_URL.includes('gateway.dex')
      ? process.env.ROBINHOOD_RPC_URL
      : 'https://mainnet.base.org');
const wsUrl = process.env.BASE_FLASHBLOCKS_WS_URL || process.env.BASE_WS_URL;
const startingCapitalUsd = Number(process.env.STARTING_CAPITAL_USD) || 0.0;
const compounding = process.env.COMPOUNDING === 'true';

createServer({
  port,
  targetChain,
  rpcUrl,
  wsUrl,
  startingCapitalUsd,
  compounding,
});

