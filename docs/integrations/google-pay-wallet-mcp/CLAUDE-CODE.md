# Google Pay & Wallet Developer MCP — Claude Code

This guide configures the remote Google Developer MCP server in Claude Code. It does **not** enable Google Pay customer checkout, move money, create a payment processor, or change the existing Razorpay integration.

## 1. Google Cloud setup

1. Select or create a Google Cloud project.
2. Enable the **Pay & Wallet Developer API**.
3. Open Google Auth Platform → Clients → Create client.
4. Select **Web application** for Claude Code.
5. Add the callback URI:
   `http://localhost:<CLAUDE_REDIRECT_PORT>/callback`
6. Create the OAuth client and copy the client ID and secret into a secure local secret manager or shell environment.

Use a dedicated Google identity for the agent. Grant only the permissions required for the intended MCP tools. Google documents these scopes:

| Scope | Access |
|---|---|
| `https://www.googleapis.com/auth/paydeveloper.merchant` | Manage Google Pay merchant developer data |
| `https://www.googleapis.com/auth/paydeveloper.issuer.readonly` | Read Google Wallet issuer data |

The merchant scope is not read-only. Do not grant it to an agent unless merchant-management actions are explicitly required and approved.

## 2. Set local environment variables

Do this in the same terminal session from which Claude Code will be launched. Do not add these values to the repository's Next.js `.env`, Vercel environment variables, browser code, CI logs, or source control.

```bash
export CLAUDE_CODE_CLIENT_ID="YOUR_GOOGLE_OAUTH_CLIENT_ID"
export CLAUDE_CODE_CLIENT_SECRET="YOUR_GOOGLE_OAUTH_CLIENT_SECRET"
export CLAUDE_REDIRECT_PORT="8787"
```

The callback port must match the redirect URI registered in Google Auth Platform. Ensure the port is available locally.

## 3. Install the MCP server

From the repository root:

```bash
node scripts/setup-google-pay-wallet-mcp.mjs
```

The script validates the required values, invokes Claude Code without a shell, and passes the client secret through the child process environment variable `MCP_CLIENT_SECRET`. The secret is not written to a config file or passed as a command-line argument.

Equivalent documented CLI command:

```bash
MCP_CLIENT_SECRET="$CLAUDE_CODE_CLIENT_SECRET" claude mcp add --transport http \
  --client-id "$CLAUDE_CODE_CLIENT_ID" --client-secret \
  --callback-port "$CLAUDE_REDIRECT_PORT" \
  google-pay-wallet-dev https://paydeveloper.googleapis.com/mcp
```

## 4. Authenticate and verify

1. Start Claude Code with `claude`.
2. Run `/mcp` and select `google-pay-wallet-dev`.
3. Complete Google's OAuth consent flow using the dedicated identity.
4. Ask Claude Code to search official Google Pay integration documentation.
5. If authorized, ask it to list Wallet issuer data or inspect the status of an existing merchant integration.

Do not ask the agent to enable APIs, modify merchant settings, create passes, or make other changes until the exact action and target account have been reviewed and approved.

## 5. Local tests

```bash
node --test scripts/setup-google-pay-wallet-mcp.node-test.mjs
```

## 6. Security and operational controls

- Treat this Google MCP service as **Pre-GA**; availability, tools, and behavior may change.
- The Google MCP server does not accept API keys.
- Use a separate identity for the agent and least-privilege IAM.
- Never print, commit, or upload OAuth client secrets or access/refresh tokens.
- Keep OAuth authorization and token storage inside the MCP host. This Corleon integration registry does not persist Google OAuth tokens.
- Keep this integration separate from payment checkout. In India, Google Pay may be offered as a UPI method through a supported PSP such as Razorpay; the Developer MCP is not the PSP.
- Production merchant mutations, customer payments, refunds, and publishing remain disabled unless separately implemented, reviewed, and explicitly approved.
- Rotate/revoke the OAuth client if its secret is exposed.

## Official references

- [Google Pay & Wallet Developer MCP server](https://developers.google.com/pay-wallet/ai-tools/mcp-server/mcp-server)
- [Google Pay API MCP setup guide](https://developers.google.com/pay/api/web/guides/use-pay-wallet-mcp)
- [Google Cloud OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
