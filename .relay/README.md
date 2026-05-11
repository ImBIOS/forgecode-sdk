# ForgeCode SDK Relay — MCP Server Integration for AI Agents

> Extend AI agent capabilities by importing Model Context Protocol (MCP) servers before agent sessions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)

This directory contains relay patch features for the ForgeCode SDK, specifically for MCP (Model Context Protocol) server integration.

## Overview

The relay module provides utilities for importing and configuring MCP servers before running ForgeCode agent sessions. MCP servers extend the agent's capabilities by providing additional tools, resources, and prompts defined by the Model Context Protocol specification.

## What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open protocol that enables seamless integration between AI models and external data sources and tools. MCP servers provide:

- **Tools** — Capabilities the AI agent can invoke
- **Resources** — Data and context the agent can access
- **Prompts** — Predefined templates for common tasks

## Usage

```typescript
import { query } from "@imbios/forgecode-sdk";
import { importMcpServers } from "@imbios/forgecode-sdk/mcp";

async function main() {
  // Import MCP servers before querying
  await importMcpServers([
    { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"] }
  ]);

  for await (const message of query("Analyze the files in ./data")) {
    // Handle messages...
  }
}
```

## Available MCP Servers

Popular MCP servers you can use with ForgeCode SDK:

| Server | Description |
|--------|-------------|
| [`@modelcontextprotocol/server-filesystem`](https://github.com/modelcontextprotocol/servers/tree/main/filesystem) | File system operations |
| [`@modelcontextprotocol/server-github`](https://github.com/modelcontextprotocol/servers/tree/main/github) | GitHub API integration |
| [`@modelcontextprotocol/server-brave-search`](https://github.com/modelcontextprotocol/servers/tree/main/brave-search) | Web search capabilities |
| [`@modelcontextprotocol/server-slack`](https://github.com/modelcontextprotocol/servers/tree/main/slack) | Slack integration |

## Related Documentation

- [TypeScript SDK](https://github.com/ImBIOS/forgecode-sdk/tree/main/sdks/typescript) — Main SDK with MCP support
- [Python SDK](https://github.com/ImBIOS/forgecode-sdk/tree/main/sdks/python) — Python MCP support
- [ForgeCode CLI](https://github.com/tailcallhq/forgecode) — Official CLI documentation
- [MCP Specification](https://modelcontextprotocol.io/) — Model Context Protocol specification
