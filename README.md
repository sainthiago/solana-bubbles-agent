# Solana Address Analysis Agent

## Overview

This agent is designed to analyze Solana addresses and provide information about related accounts and their transaction counts. It retrieves data from the Solana blockchain without building any transactions.

## Features

- Validates Solana addresses
- Retrieves related accounts that have interacted with the specified address
- Provides transaction counts and types for each related account
- Orders results by transaction frequency
- Tracks SOL and token balance changes (inflow/outflow analysis)

## RPC Provider Setup

For optimal performance, this agent uses premium RPC providers. The agent supports:

### Helius (Recommended)
1. Get a free API key from [https://helius.xyz/](https://helius.xyz/)
2. Set the environment variable: `HELIUS_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_API_KEY`

### Alternative Providers
- **Ankr**: Used as fallback (no API key required)
- **QuickNode**: Replace the RPC URL with your QuickNode endpoint
- **Standard Solana RPC**: Fallback option (slower, rate-limited)

## API Endpoints

### Analyze Solana Address

**Endpoint:** `/api/tools/solana-address-analysis`

**Method:** `GET`

**Query Parameters:**
- `address` (string, required): The Solana address to analyze

**Response:**
Returns a JSON object containing:
- `address`: The analyzed Solana address
- `isValid`: Whether the address is valid
- `totalTransactions`: Total number of transactions for this address
- `sampledTransactions`: Number of transactions actually analyzed (subset of total)
- `relatedAccounts`: List of related accounts ordered by transaction count
  - `address`: The related account address
  - `transactionCount`: Number of transactions with this account
  - `lastInteraction`: ISO timestamp of last interaction
  - `transactionTypes`: Types of transactions (e.g., 'SOL Inflow', 'SOL Outflow', 'Token Transfer')
  - `totalSolFlow`: Total SOL amount involved in transactions
  - `totalTokenInteractions`: Number of token-related interactions
- `error`: Error message if analysis failed

**Example Request:**
```bash
curl "http://localhost:3000/api/tools/solana-address-analysis?address=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

**Example Response:**
```json
{
  "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "isValid": true,
  "totalTransactions": 100,
  "sampledTransactions": 25,
  "relatedAccounts": [
    {
      "address": "SomeRelatedAddress123...",
      "transactionCount": 45,
      "lastInteraction": "2024-01-15T10:30:00.000Z",
      "transactionTypes": ["SOL Inflow", "Token Transfer"],
      "totalSolFlow": 1500000000,
      "totalTokenInteractions": 12
    }
  ]
}
```

## Dependencies

- `@solana/web3.js`: For interacting with the Solana blockchain
- `Next.js`: React framework for the API endpoints
- `@bitte-ai/agent-sdk`: SDK for creating AI agents
- Other dependencies as listed in `package.json`

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/BitteProtocol/agent-next-boilerplate.git
   cd agent-next-boilerplate
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. (Optional) Set up premium RPC provider:
   ```bash
   # For Helius
   echo "HELIUS_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_API_KEY" >> .env.local
   
   # Or for QuickNode
   echo "HELIUS_RPC_URL=https://your-quicknode-endpoint.com" >> .env.local
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. The agent will be available at `http://localhost:3000`

6. Use the API endpoint to analyze Solana addresses:
   ```bash
   curl "http://localhost:3000/api/tools/solana-address-analysis?address=YOUR_SOLANA_ADDRESS"
   ```

## Performance Notes

- **With Helius/Premium RPC**: ~3-5 seconds response time, higher rate limits
- **With Ankr (fallback)**: ~5-10 seconds response time  
- **With free Solana RPC**: ~10-40 seconds due to rate limiting

The agent automatically uses the best available RPC provider and adjusts batch sizes and delays accordingly.

## License

This project is licensed under the MIT License.
# solana-bubbles-agent
# solana-bubbles-agent
