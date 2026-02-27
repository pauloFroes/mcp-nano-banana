# mcp-nano-banana

MCP server that wraps the [Google Gemini Image Generation API](https://ai.google.dev/gemini-api/docs/image-generation) (Nano Banana) as semantic tools for LLM agents.

Generate, edit, compose, and describe images using Gemini 2.5 Flash and Gemini 3 Pro — directly from Claude Code, Codex, Cursor, or any MCP client.

---

## Prerequisites

- Node.js 18+
- Google Gemini API key with billing enabled ([get one here](https://aistudio.google.com/apikey))

| Variable | Where to find |
| -------- | ------------- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → Create API key |

> **Note**: Image generation via API requires billing enabled on your Google Cloud project. The free tier does not support image generation via API.

## Installation

### Claude Code

```bash
claude mcp add nano-banana \
  --transport stdio \
  -e GEMINI_API_KEY=your-key \
  -- npx -y github:pauloFroes/mcp-nano-banana
```

### Codex

Add to your Codex configuration:

```toml
[mcp_servers.nano-banana]
command = "npx"
args = ["-y", "github:pauloFroes/mcp-nano-banana"]
env_vars = ["GEMINI_API_KEY"]
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["-y", "github:pauloFroes/mcp-nano-banana"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["-y", "github:pauloFroes/mcp-nano-banana"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "nano-banana": {
      "command": "npx",
      "args": ["-y", "github:pauloFroes/mcp-nano-banana"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["-y", "github:pauloFroes/mcp-nano-banana"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate an image from a text prompt (text-to-image) |
| `edit_image` | Edit/transform an existing image with text instructions (image-to-image) |
| `compose_images` | Combine multiple images into a new one with text instructions |
| `describe_image` | Analyze and describe the content of an image (image-to-text) |

### Models

| Model | ID | Resolution | Cost | Best for |
|-------|----|-----------|------|----------|
| **flash** (default) | gemini-2.5-flash | Up to 1K | $0.039/img | Fast iterations, drafts |
| **pro** | gemini-3-pro | Up to 4K | $0.134-0.24/img | Final quality, text in images |

## Authentication

Uses a simple API key from Google AI Studio. The key is passed via the `GEMINI_API_KEY` environment variable and sent as an `x-goog-api-key` header on every request. No OAuth or token refresh needed.

## License

MIT
