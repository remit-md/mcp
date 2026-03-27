# remit.md / mcp

> [Skill MD](https://remit.md) · [Docs](https://remit.md/docs) · [Agent Spec](https://remit.md/agent.md)

MCP server for [remit.md](https://remit.md) - language-agnostic agent payments with zero code.

Any AI agent with MCP support can pay for services, manage escrows, stream funds, and post bounties through natural language.

## Quick start

Three wallet modes, checked in priority order:

| Priority | Mode | Env vars | Key storage |
|----------|------|----------|-------------|
| 1 | **Local Signer** | `REMIT_SIGNER_URL` + `REMIT_SIGNER_TOKEN` | Signing server (keys never leave the server) |
| 2 | **OWS** | `OWS_WALLET_ID` | Encrypted local vault |
| 3 | **Raw key** | `REMITMD_KEY` | Plaintext in env var |

When multiple are set, the highest-priority mode wins.

**With Local Signer** - keys stay on a signing server you control:

```json
{
  "mcpServers": {
    "remit": {
      "command": "npx",
      "args": ["@remitmd/mcp-server"],
      "env": {
        "REMIT_SIGNER_URL": "http://127.0.0.1:7402",
        "REMIT_SIGNER_TOKEN": "$REMIT_SIGNER_TOKEN",
        "REMITMD_CHAIN": "base"
      }
    }
  }
}
```

Start a signing server with `remit signer start` (see [remit-cli](https://github.com/remit-md/remit-cli)).

**With OWS** - keys stay in an encrypted local vault:

```json
{
  "mcpServers": {
    "remit": {
      "command": "npx",
      "args": ["@remitmd/mcp-server"],
      "env": {
        "OWS_WALLET_ID": "remit-my-agent",
        "OWS_API_KEY": "$OWS_API_KEY",
        "REMITMD_CHAIN": "base"
      }
    }
  }
}
```

Install OWS and create a wallet with `remit init` (see [remit-cli](https://github.com/remit-md/remit-cli)), or manually:

```bash
npm install -g @open-wallet-standard/core
```

**With raw key** - simpler setup, key in env var:

```json
{
  "mcpServers": {
    "remit": {
      "command": "npx",
      "args": ["@remitmd/mcp-server"],
      "env": {
        "REMITMD_KEY": "0x...",
        "REMITMD_CHAIN": "base"
      }
    }
  }
}
```

## Capabilities

**20 Tools:**
Direct payments, escrow (create/release), tabs (open/close), streams (open/close), bounties (post/award), deposits (lock), status checks, fund/withdraw links (create_fund_link, create_withdraw_link), webhooks (register_webhook, list_webhooks, delete_webhook), x402 paywall (x402_paywall_setup, x402_config).

**6 Resources:**
Wallet balance, reputation score, transaction history, escrow details, tab details, stream details, protocol status.

**3 Prompts:**
`hire_agent` - negotiate and pay for agent work.
`negotiate_price` - compare offers and agree on terms.
`verify_delivery` - check deliverables before releasing escrow.

## Development

```bash
npm install
npm test     # 116 tests
npm run build
```

Requires Node.js 20+.

## License

MIT
