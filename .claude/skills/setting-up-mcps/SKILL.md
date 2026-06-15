---
name: setting-up-mcps
description: >
  Guide for connecting Claude Code to new external tools via MCP (Model
  Context Protocol). Use when adding a new MCP server, troubleshooting
  MCP connections, integrating external services, or when the user
  mentions "MCP", "integrations", or asks how to give Claude access to
  an external service. NOT for general Claude Code troubleshooting —
  that's claude-code-troubleshooting.
---

# Setting Up MCPs

MCP connects Claude Code to external tools. This skill covers adding
new ones and the credential-storage conventions that keep them safe.

**Principle: every MCP earns its place.** If a CLI + a few shell
commands cover the integration cleanly, don't add an MCP. Reserve MCPs
for tools where the API surface is genuinely useful inside the agent
loop.

## Quick Reference

| Action | Command |
|---|---|
| Add cloud service | `claude mcp add --transport http <name> <url>` |
| Add local tool | `claude mcp add --transport stdio <name> -- <command>` |
| List connections | `claude mcp list` |
| Check status | `/mcp` (inside Claude Code) |
| Authenticate | `/mcp` → select service → "Authenticate" |
| Remove connection | `claude mcp remove <name>` |

## Setup Workflow

```
- [ ] Step 1: Identify the service type (cloud or local)
- [ ] Step 2: Get the MCP URL or command
- [ ] Step 3: Run the add command
- [ ] Step 4: Verify with `claude mcp list`
- [ ] Step 5: Authenticate if needed (`/mcp`)
- [ ] Step 6: Test with a simple request
- [ ] Step 7: Store the credential per CLAUDE.md → Credentials conventions
```

### Step 1 — Identify Service Type

**Cloud services** (GitHub, Notion, Sentry, Drive, etc.):
- Use `--transport http` or `--transport sse`
- Require a URL like `https://mcp.servicename.com/...`
- Usually need browser authentication

**Local tools** (databases, file servers, custom scripts):
- Use `--transport stdio`
- Require a command like `npx -y package-name`
- May need API keys via `--env`

### Step 2 — Get Setup Information

Find the service's MCP documentation. Look for:
- **URL** for cloud services
- **npm package** or **command** for local tools
- **Required environment variables** (API keys)

### Step 3 — Run the Add Command

**Cloud service (HTTP):**
```bash
claude mcp add --transport http <name> <url>
```

**Cloud service with auth header:**
```bash
claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"
```

**Local tool (stdio):**
```bash
claude mcp add --transport stdio <name> -- <command>
```

**Local tool with API key:**
```bash
claude mcp add --transport stdio <name> --env API_KEY=<value> -- <command>
```

**Important:** All flags (`--transport`, `--env`, `--scope`,
`--header`) must come before the server name. Use `--` to separate the
name from the command.

### Step 4 — Verify Connection

```bash
claude mcp list
```

Confirm the new connection appears.

### Step 5 — Authenticate (If Required)

Inside Claude Code:
1. Type `/mcp`
2. Select the service
3. Choose "Authenticate"
4. Complete browser login

### Step 6 — Test

Ask Claude something that uses the tool. Example test prompts:
- Drive: "list my recent files"
- GitHub: "list my open pull requests"
- Notion: "show my recent pages"
- Database: "list the tables"

### Step 7 — Credential Storage

Standard conventions:

| Service type | Where the credential lives |
|---|---|
| OAuth cloud service (Drive, Notion, GitHub via OAuth) | Browser-managed; nothing to store locally |
| API-key cloud service with public endpoint | No key needed |
| Production runtime secrets | Cloud provider secret manager (Cloudflare Workers, AWS Secrets Manager, etc.) |
| Local CLI tokens (gh, git) | `~/.netrc` with `0600` perms |
| API keys for research tools | MCP-managed; no project storage |

**Never:** commit API keys to the repo, put credentials in `.env` files
that are checked into git, or hardcode tokens in scripts.

## Scopes

| Scope | Flag | Use Case |
|---|---|---|
| local (default) | none | Personal, this project only |
| project | `--scope project` | Team-shared via `.mcp.json` in Git |
| user | `--scope user` | Personal, all your projects |

Example:
```bash
claude mcp add --transport http github --scope user https://api.githubcopilot.com/mcp/
```

## Management Commands

```bash
# List all connections
claude mcp list

# Get details for one
claude mcp get <name>

# Remove connection
claude mcp remove <name>

# Check status inside Claude Code
/mcp
```

## Troubleshooting

**Quick fixes:**
- **Windows "Connection closed"**: Add `cmd /c` before `npx` commands
- **Tools not appearing**: Restart Claude Code after adding MCPs
  (subagents and MCP tool schemas only load at session start)
- **Auth failing**: Use `/mcp` → "Clear authentication" and retry
- **Timeout errors**: Set `MCP_TIMEOUT=30000 claude` for longer startup

For deeper Claude Code harness issues, route to the
`claude-code-troubleshooting` skill.

## When NOT to add an MCP

- The integration is covered by a CLI (`gh` for GitHub, `aws` for AWS).
  Use that instead.
- The interaction is one-off and won't recur.
- The tool's API doesn't benefit from agent-loop integration (no
  multi-step workflows).
- You're tempted to add it "in case it's useful." Add when you have a
  specific recurring use case.
