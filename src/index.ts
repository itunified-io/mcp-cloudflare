import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CloudflareClient } from './client/cloudflare-client.js';

// Tool definitions and handlers will be added here as tool modules are implemented.
// Each domain (dns, zones, tunnels, waf, zerotrust, security) will export:
//   - <domain>ToolDefinitions: ToolDefinition[]
//   - handle<Domain>Tool: (name, args, client) => Promise<{ content: ... }>

const allToolDefinitions: never[] = [];

const toolHandlers = new Map<
  string,
  (name: string, args: Record<string, unknown>, client: CloudflareClient) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
>();

const server = new Server(
  { name: 'mcp-cloudflare', version: '2026.3.13' },
  { capabilities: { tools: {} } }
);

const client = CloudflareClient.fromEnv();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allToolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers.get(name);

  if (!handler) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return handler(name, (args ?? {}) as Record<string, unknown>, client);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
