<p align="center">
  <img width="400" height="400" alt="image" src="https://github.com/user-attachments/assets/d587355a-d558-4b0d-b0fa-a86aea3f89db" />
  <img width="400" height="400" alt="starkyy" src="https://github.com/user-attachments/assets/a0eb4f69-b193-40aa-bb28-7b7173f32639" />
</p>

# Starky
A CLI tool for monitoring Starknet smart contracts and streaming events to Datadog dashboards. Starky automatically parses contract ABIs, extracts events and function calls, and creates real-time dashboards.

## Features

- 🚀 **Automatic ABI Parsing**: Supports both Dojo manifests and Scarb contract classes
- 📊 **Real-time Dashboards**: Creates and manages Datadog dashboards automatically
- 🔍 **Event Monitoring**: Tracks contract events with human-readable names
- ⚡ **Function Call Detection**: Monitors contract function invocations
- 🔧 **Multi-Contract Support**: Monitor multiple contracts simultaneously

## Installation

```bash
# Clone the repository
git clone https://github.com/dubzn/starky.git
cd starky

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link

# Set up environment variables
cp .env.example .env
export $(grep -v '^#' .env | xargs)
```

## Environment Setup

Create a `.env` file with your Datadog credentials:

```bash
# Datadog Configuration
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
DD_SITE=us5.datadoghq.com  # or your Datadog site

# Starknet RPC (optional, defaults to Alchemy)
# Supports any RPC included Katana
STARKNET_RPC_URL=rpc_url
```

## Quick Start

### 1. Create a Dashboard

```bash
starky board create "my-starknet-monitor"
```

### 2. Set Up Contract Monitoring

For **Dojo projects** (automatic contract detection):
```bash
starky setup ./manifest.json
```

For **Scarb contracts** (manual setup):
```bash
# Edit starky.config.json manually
{
  "activeBoardId": "your-board-id",
  "abiFile": "./contract_class.json",
  "contracts": ["0x1234...", "0x5678..."]
}
```

### 3. Start Monitoring

```bash
# Monitor from latest block
starky ingest --from-block latest

# Monitor from specific block
starky ingest --from-block 1000000

# Monitor with custom interval
starky ingest --from-block latest --interval-ms 2000
```

## Commands

### Board Management

```bash
# Create a new dashboard
starky board create "dashboard-name"
```

### Contract Setup

```bash
# Auto-setup for Dojo projects
starky setup ./manifest.json
```

### Event Ingestion

```bash
# Basic monitoring
starky ingest

# Advanced options
starky ingest --from-block latest --lookback-blocks 10 --interval-ms 1500 --verbose
```

## Configuration

### starky.config.json

```json
{
  "activeBoardId": "your-datadog-board-id",
  "abiFile": "./contract_class.json",
  "contracts": [
    "0x1234567890abcdef...",
    "0xabcdef1234567890..."
  ],
  "eventNames": []
}
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--from-block` | Start monitoring from block number or 'latest' | `latest` |
| `--lookback-blocks` | Number of blocks to look back when starting from latest | `500` |
| `--interval-ms` | Polling interval between cycles (milliseconds) | `1500` |
| `--verbose` | Enable verbose logging | `false` |

## Dashboard Features

Starky automatically creates dashboards with:

- 📊 **Event Counts**: Real-time event occurrence statistics
- 🔧 **Function Calls**: Contract function invocation tracking
- 📈 **Time Series**: Historical event and function call trends
- 🎯 **Contract Filtering**: Filter by specific contracts
- 🔍 **Event Details**: Detailed event data and parameters
- 📋 **Live Logs**: Real-time log stream from Datadog

## Event Detection

Starky automatically detects and processes:

### Events
- ✅ Contract events with human-readable names
- ✅ Event selectors and parameters
- ✅ Block numbers and transaction hashes
- ✅ Timestamps and contract addresses

### Function Calls
- ✅ Function names and selectors
- ✅ Target contract addresses
- ✅ Transaction details
- ✅ Call parameters and results

## Optimization Features

- 🚀 **Smart Block Skipping**: Only processes new blocks using `starknet_blockNumber`
- ⚡ **Efficient RPC Usage**: Minimal API calls for maximum performance
- 🔄 **Automatic Retry**: Handles RPC errors gracefully
- 📊 **Memory Efficient**: Optimized data structures for large-scale monitoring

## Troubleshooting

### Common Issues

**Missing Events**
- Verify contract addresses in `starky.config.json`
- Check ABI file path and format
- Ensure contracts are deployed and active

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

---

**Starky** - Making Starknet monitoring simple and powerful! 🚀
