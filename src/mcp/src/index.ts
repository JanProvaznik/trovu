import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { TrovuService } from "./trovu-service.js";

const SEARCH_SHORTCUTS_TOOL: Tool = {
  name: "search_shortcuts",
  description:
    "Search for Trovu web shortcuts by keyword, title, tags, or URL content. " +
    "Trovu provides shortcuts to search 1000+ websites in a command-line way.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query to find shortcuts. Can include filters like 'ns:namespace', 'tag:tagname', 'url:domain'",
      },
      language: {
        type: "string",
        description: "Language code (e.g., 'en', 'de'). Defaults to 'en'",
        default: "en",
      },
      country: {
        type: "string",
        description: "Country code (e.g., 'us', 'de'). Defaults to 'us'",
        default: "us",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return. Defaults to 10",
        default: 10,
      },
    },
    required: ["query"],
  },
};

const GET_REDIRECT_URL_TOOL: Tool = {
  name: "get_redirect_url",
  description:
    "Process a Trovu query and return the redirect URL. " +
    "Examples: 'g berlin' for Google search, 'w berlin' for Wikipedia, 'gm berlin' for Google Maps.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The Trovu query (e.g., 'g berlin' for Google search, 'w berlin' for Wikipedia)",
      },
      language: {
        type: "string",
        description: "Language code (e.g., 'en', 'de'). Defaults to 'en'",
        default: "en",
      },
      country: {
        type: "string",
        description: "Country code (e.g., 'us', 'de'). Defaults to 'us'",
        default: "us",
      },
    },
    required: ["query"],
  },
};

const LIST_NAMESPACES_TOOL: Tool = {
  name: "list_namespaces",
  description:
    "List available Trovu namespaces for a given language and country. " +
    "Namespaces organize shortcuts by language (e.g., 'en'), country (e.g., '.de'), or category (e.g., 'o' for global).",
  inputSchema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        description: "Language code (e.g., 'en', 'de'). Defaults to 'en'",
        default: "en",
      },
      country: {
        type: "string",
        description: "Country code (e.g., 'us', 'de'). Defaults to 'us'",
        default: "us",
      },
    },
  },
};

const GET_SHORTCUT_DETAILS_TOOL: Tool = {
  name: "get_shortcut_details",
  description:
    "Get detailed information about a specific Trovu shortcut including URL template, title, description, examples, and tags.",
  inputSchema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "The shortcut keyword (e.g., 'g', 'w', 'gm')",
      },
      argumentCount: {
        type: "number",
        description: "Number of arguments for the shortcut. Defaults to 1",
        default: 1,
      },
      namespace: {
        type: "string",
        description: "Optional specific namespace to search in",
      },
      language: {
        type: "string",
        description: "Language code (e.g., 'en', 'de'). Defaults to 'en'",
        default: "en",
      },
      country: {
        type: "string",
        description: "Country code (e.g., 'us', 'de'). Defaults to 'us'",
        default: "us",
      },
    },
    required: ["keyword"],
  },
};

const ALL_TOOLS = [
  SEARCH_SHORTCUTS_TOOL,
  GET_REDIRECT_URL_TOOL,
  LIST_NAMESPACES_TOOL,
  GET_SHORTCUT_DETAILS_TOOL,
];

export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: "trovu-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const trovuService = new TrovuService();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "search_shortcuts": {
          const query = args?.query as string;
          const language = (args?.language as string) || "en";
          const country = (args?.country as string) || "us";
          const limit = (args?.limit as number) || 10;

          const results = await trovuService.searchShortcuts(
            query,
            language,
            country,
            limit
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case "get_redirect_url": {
          const query = args?.query as string;
          const language = (args?.language as string) || "en";
          const country = (args?.country as string) || "us";

          const result = await trovuService.getRedirectUrl(
            query,
            language,
            country
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "list_namespaces": {
          const language = (args?.language as string) || "en";
          const country = (args?.country as string) || "us";

          const namespaces = await trovuService.listNamespaces(
            language,
            country
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(namespaces, null, 2),
              },
            ],
          };
        }

        case "get_shortcut_details": {
          const keyword = args?.keyword as string;
          const argumentCount = (args?.argumentCount as number) || 1;
          const namespace = args?.namespace as string | undefined;
          const language = (args?.language as string) || "en";
          const country = (args?.country as string) || "us";

          const details = await trovuService.getShortcutDetails(
            keyword,
            argumentCount,
            language,
            country,
            namespace
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(details, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
