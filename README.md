# 🫧 Solana Bubbles Agent

> **Discover the hidden connections in the Solana ecosystem**

## 🎯 Overview

The **Solana Bubbles Agent** analyzes Solana wallet addresses to reveal networks of related accounts and their transaction volumes. Think of it as mapping the "bubbles" of activity around any Solana address - showing who's connected and how much value flows between them.

## ✨ Features

- 🔍 **Relationship Discovery**: Find ALL accounts that have interacted with a given address
- 💰 **Multi-Token Support**: Tracks SOL, USDC, USDT, ETH, JUP, BONK, and 10+ other major tokens
- 🔄 **SOL Conversion**: All token volumes converted to SOL equivalent for easy comparison
- ⚡ **Smart Caching**: 5-minute cache for lightning-fast repeated queries
- 📊 **Volume Ranking**: Results sorted by total transaction volume
- 🛡️ **Rate Limit Handling**: Optimized for Helius free tier and other RPC providers

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/sainthiago/solana-bubbles-agent.git
cd solana-bubbles-agent
pnpm install
```

### 2. Configure RPC (Optional but Recommended)
```bash
# For Helius (recommended)
echo "HELIUS_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_API_KEY" >> .env.local
```

### 3. Start the Agent
```bash
pnpm dev
```

### 4. Analyze an Address
```bash
curl "http://localhost:3000/api/tools/solana-address-analysis?address=5dmVDVM2orDq1ZetuVjedCdRjJGiVasjmqq2woAmyXGd"
```

## 🛠️ API Reference

### Main Endpoint
**`GET /api/tools/solana-address-analysis`**

**Parameters:**
- `address` (required): Solana address to analyze

**Response:**
```json
{
  "address": "5dmVDVM2orDq1ZetuVjedCdRjJGiVasjmqq2woAmyXGd",
  "isValid": true,
  "relatedAccounts": [
    {
      "address": "HZeLxbZ9uHtSpwZC3LBr4Nubd14iHwz7bRSghRZf5VCG",
      "totalSolVolume": "5.95 SOL"
    },
    {
      "address": "ES7yhSrYeFo4U1PfJHNRkbfCWxCwPLk2DjrEbmN8bg58", 
      "totalSolVolume": "2.48 SOL"
    }
  ]
}
```

### Cache Stats Endpoint
**`GET /api/tools/solana-address-analysis?cache=stats`**

Monitor cache performance and see what's currently cached.

## 🎨 Supported Tokens

The agent tracks these tokens and converts them to SOL equivalent:

| Token | Symbol | Conversion Rate |
|-------|--------|----------------|
| SOL | SOL | 1.0 SOL |
| USDC | USDC | ~0.004 SOL |
| USDT | USDT | ~0.004 SOL |
| Ethereum | ETH | ~0.15 SOL |
| Jupiter | JUP | ~0.0035 SOL |
| Bonk | BONK | ~0.00000006 SOL |
| And more... | | |

*Rates are approximate and represent current market conditions*

## ⚡ Performance

### Cache Performance
- **Cache Hit**: ~10ms response time ⚡
- **Cache Miss**: 2-5 seconds (with Helius)
- **Cache TTL**: 5 minutes for successful analyses

### RPC Provider Performance
- **Helius (Free)**: 2-5 seconds, optimized for individual requests
- **Ankr (Fallback)**: 5-10 seconds
- **Public Solana RPC**: 10-40 seconds (rate limited)

## 🔧 Configuration

### Environment Variables
```bash
HELIUS_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_API_KEY  # Optional but recommended
NEXT_PUBLIC_BASE_URL=https://your-domain.com                # For production
```

### RPC Providers
1. **Helius** (Recommended): Get free API key at [helius.xyz](https://helius.xyz/)
2. **QuickNode**: Premium option with higher rate limits
3. **Ankr**: Free fallback, decent performance
4. **Public Solana RPC**: Slowest but always available

## 🧠 How It Works

1. **Address Validation**: Ensures the input is a valid Solana address
2. **Transaction Retrieval**: Fetches recent transaction history
3. **Relationship Mapping**: Analyzes each transaction to find connected accounts
4. **Volume Calculation**: 
   - Tracks SOL balance changes
   - Identifies token transfers and converts to SOL equivalent
   - Accumulates total volume per related account
5. **Smart Sorting**: Orders results by total volume (highest first)
6. **Caching**: Stores results for fast repeated queries

## 🔍 Use Cases

- **Portfolio Analysis**: See who your wallet has interacted with most
- **DeFi Mapping**: Discover related protocols and liquidity pools
- **Security Research**: Identify suspicious account relationships
- **Market Research**: Understand fund flows and connections
- **Trading Intelligence**: Find accounts with similar activity patterns

## 🛡️ Rate Limiting & Optimization

The agent is optimized for different RPC providers:

- **Helius Free**: 3 transactions per batch, 2s delays, individual requests
- **Other RPCs**: 5 transactions per batch, 1s delays, batch requests
- **Error Handling**: Exponential backoff for rate limits
- **Fallback Chain**: Helius → Ankr → Public RPC

## 📊 Cache Statistics

Monitor your cache performance:
```bash
curl "http://localhost:3000/api/tools/solana-address-analysis?cache=stats"
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Docker
```bash
docker build -t solana-bubbles-agent .
docker run -p 3000:3000 solana-bubbles-agent
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the Solana ecosystem**

*Discover the bubbles, map the connections, understand the flow.* 🫧✨
