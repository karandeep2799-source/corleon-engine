# Google Pay & Wallet Developer MCP — Claude Code

This configures Google's remote developer MCP server in Claude Code. It does **not** enable customer checkout, move money, or replace Corleon's payment processor.

## Google Cloud prerequisites

1. Select or create a Google Cloud project.
2. Enable the **Pay & Wallet Developer API**.
3. In Google Auth Platform → Clients → Create client, choose **Web application** for Claude Code.
4. Register the exact callback URI `http://localhost:<CLAUDE_REDIRECT_PORT>/callback`.
5. Create the OAuth client and store its ID and secret in a local secret manager or shell environment.

Use a dedicated Google identity for the agent. Google's documented scopes are:

| Scope | Access |
|---|---|
| `https://www.googleapis.com/auth/paydeveloper.merchant` | Manage Google Pay merchant developer data |
| `https://www.googleapis.com/auth/paydeveloper.issuer.readonly` | Read Google Wallet issuer data |

The merchant scope is not read-only. Do not grant it unless merchant-management actions are required and approved.

## Configure locally

In the terminal where you will run Claude Code:

```bash
export CLAUDE_CODE_CLIENT_ID="YOUR_GOOGLE_OAUTH_CLIENT_ID"
export CLAUDE_CODE_CLIENT_SECRET="YOUR_GOOGLE_OAUTH_CLIENT_SECRET"
export CLAUDE_REDIRECT_PORT="8787"
node scripts/setup-google-pay-wallet-mcp.mjs
```

Use a free local port between 1024 and 65535. The port must match the registered callback URI. The setup helper validates the values and runs Claude Code without a shell. It passes the secret through `MCP_CLIENT_SECRET` in the child process environment, never as a command-line argument or committed config value.

Equivalent documented CLI command:

```bash
MCP_CLIENT_SECRET="$CLAUDE_CODE_CLIENT_SECRET" claude mcp add --transport http \
  --client-id "$CLAUDE_CODE_CLIENT_ID" --client-secret \
  --callback-port "$CLAUDE_REDIRECT_PORT" \
  google-pay-wallet-dev https://paydeveloper.googleapis.com/mcp
```

## Authenticate and verify

1. Run `claude`.
2. Run `/mcp` and select `google-pay-wallet-dev`.
3. Complete Google's OAuth consent flow using the dedicated identity.
4. Ask Claude Code to search official Google Pay integration documentation.
5. If authorized, inspect existing merchant integration status or list Wallet issuer data.

Do not enable APIs, change merchant settings, create passes, or perform other mutations until the exact action and target account have been reviewed and approved.

## Tests

```bash
node --test scripts/setup-google-pay-wallet-mcp.node-test.mjs
pnpm --filter @corleon/web test -- src/mcp/google-pay-wallet-mcp.test.ts
```

## Security and operating boundaries

- Google labels this MCP service **Pre-GA**; tools and behavior may change.
- The server does not accept API keys.
- Use a dedicated agent identity and least-privilege IAM.
- Never print, commit, upload, or place OAuth secrets/tokens in Vercel or browser variables.
- OAuth consent and token storage remain owned by Claude Code. Corleon stores only non-secret registry metadata.
- Keep Developer MCP separate from customer payment checkout. In India, Google Pay may be presented as a UPI method through a supported PSP such as Razorpay; the Developer MCP is not that PSP.
- Production merchant mutations, customer payments, refunds, and publishing remain disabled unless separately implemented, reviewed, and explicitly approved.
- Revoke/rotate the OAuth client if its secret is exposed.

## Official references

- https://developers.google.com/pay-wallet/ai-tools/mcp-server/mcp-server
- https://developers.google.com/pay/api/web/guides/use-pay-wallet-mcp
- https://developers.google.com/identity/protocols/oauth2
- https://docs.anthropic.com/en/docs/claude-code/mcp
