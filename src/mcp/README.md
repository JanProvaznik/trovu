# Trovu MCP Server

This directory contains a Model Context Protocol (MCP) server implementation for Trovu. The MCP server exposes Trovu's shortcut functionality as tools that can be used by AI assistants and other MCP clients.

## Overview

The Trovu MCP server provides programmatic access to Trovu's web shortcuts system, allowing AI assistants to:
- Search for shortcuts by keyword, title, or tags
- Get redirect URLs for queries
- List available namespaces
- Retrieve detailed shortcut information

## Tool Specifications

### 1. `search_shortcuts`

Search for shortcuts by keyword, title, tags, or URL content.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query to find shortcuts. Can include filters like 'ns:namespace', 'tag:tagname', 'url:domain'"
    },
    "language": {
      "type": "string",
      "description": "Language code (e.g., 'en', 'de'). Defaults to 'en'",
      "default": "en"
    },
    "country": {
      "type": "string",
      "description": "Country code (e.g., 'us', 'de'). Defaults to 'us'",
      "default": "us"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return. Defaults to 10",
      "default": 10
    }
  },
  "required": ["query"]
}
```

**Output:**
Returns an array of matching shortcuts with their details (keyword, title, URL, namespace, tags).

### 2. `get_redirect_url`

Process a Trovu query and return the redirect URL.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The Trovu query (e.g., 'g berlin' for Google search, 'w berlin' for Wikipedia)"
    },
    "language": {
      "type": "string",
      "description": "Language code (e.g., 'en', 'de'). Defaults to 'en'",
      "default": "en"
    },
    "country": {
      "type": "string",
      "description": "Country code (e.g., 'us', 'de'). Defaults to 'us'",
      "default": "us"
    }
  },
  "required": ["query"]
}
```

**Output:**
Returns the redirect URL or status information if the shortcut was not found.

### 3. `list_namespaces`

List available namespaces for a given language and country.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "language": {
      "type": "string",
      "description": "Language code (e.g., 'en', 'de'). Defaults to 'en'",
      "default": "en"
    },
    "country": {
      "type": "string",
      "description": "Country code (e.g., 'us', 'de'). Defaults to 'us'",
      "default": "us"
    }
  }
}
```

**Output:**
Returns a list of available namespaces with basic information.

### 4. `get_shortcut_details`

Get detailed information about a specific shortcut.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "keyword": {
      "type": "string",
      "description": "The shortcut keyword (e.g., 'g', 'w', 'gm')"
    },
    "argumentCount": {
      "type": "number",
      "description": "Number of arguments for the shortcut. Defaults to 1",
      "default": 1
    },
    "namespace": {
      "type": "string",
      "description": "Optional specific namespace to search in"
    },
    "language": {
      "type": "string",
      "description": "Language code (e.g., 'en', 'de'). Defaults to 'en'",
      "default": "en"
    },
    "country": {
      "type": "string",
      "description": "Country code (e.g., 'us', 'de'). Defaults to 'us'",
      "default": "us"
    }
  },
  "required": ["keyword"]
}
```

**Output:**
Returns detailed shortcut information including URL template, title, description, examples, and tags.

## Technology Stack

The MCP server is built using:
- **TypeScript** - Matching the main Trovu codebase
- **@modelcontextprotocol/sdk** - Official MCP SDK for building servers
- **Node.js** - Runtime environment

## Usage

### Installation

```bash
cd src/mcp
npm install
npm run build
```

### Running the Server

The server communicates via stdio (standard input/output):

```bash
node dist/index.js
```

### Integration with AI Assistants

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "trovu": {
      "command": "node",
      "args": ["/path/to/trovu/src/mcp/dist/index.js"]
    }
  }
}
```

## Examples

### Search for map shortcuts
```json
{
  "tool": "search_shortcuts",
  "arguments": {
    "query": "tag:maps",
    "language": "en",
    "country": "us"
  }
}
```

### Get Google search URL
```json
{
  "tool": "get_redirect_url",
  "arguments": {
    "query": "g berlin",
    "language": "en",
    "country": "us"
  }
}
```

### List German namespaces
```json
{
  "tool": "list_namespaces",
  "arguments": {
    "language": "de",
    "country": "de"
  }
}
```

## Architecture

The MCP server reuses Trovu's core modules:
- `Env` - Environment and configuration management
- `QueryParser` - Query parsing
- `ShortcutFinder` - Shortcut matching
- `SuggestionsGetter` - Search and suggestion functionality
- `UrlProcessor` - URL template processing

This ensures consistent behavior between the web interface and MCP server.

## License

AGPL-3.0-or-later (same as main Trovu project)
