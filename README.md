# remit.md / mcp

MCP server for [remit.md](https://remit.md) — language-agnostic agent payments with zero code.

Any AI agent with MCP support can pay for services, manage escrows, stream funds, and post bounties through natural language.

## Quick start

```json
{
  "mcpServers": {
    "remitmd": {
      "command": "npx",
      "args": ["@remitmd/mcp-server"],
      "env": {
        "REMITMD_API_KEY": "your-api-key",
        "REMITMD_PRIVATE_KEY": "your-wallet-private-key"
      }
    }
  }
}
```

## Capabilities

**13 Tools:**
Direct payments, escrow (create/release), tabs (open/close), streams (open/close), bounties (post/award), deposits (lock), disputes, status checks.

**7 Resources:**
Wallet balance, reputation score, transaction history, escrow details, tab details, stream details, protocol status.

**3 Prompts:**
`hire_agent` — negotiate and pay for agent work.
`negotiate_price` — compare offers and agree on terms.
`verify_delivery` — check deliverables before releasing escrow.

## Development

```bash
npm install
npm test     # 60 tests
npm run build
```

Requires Node.js 20+.

## License

MIT
