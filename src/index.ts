import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CloudflareClient } from './client/cloudflare-client.js';
import { zonesToolDefinitions, handleZonesTool } from './tools/zones.js';
import { dnsToolDefinitions, handleDnsTool } from './tools/dns.js';
import { diagnosticsToolDefinitions, handleDiagnosticsTool } from './tools/diagnostics.js';
import { tunnelsToolDefinitions, handleTunnelsTool } from './tools/tunnels.js';
import { wafToolDefinitions, handleWafTool } from './tools/waf.js';
import { zerotrustToolDefinitions, handleZerotrustTool } from './tools/zerotrust.js';
import { securityToolDefinitions, handleSecurityTool } from './tools/security.js';
import { kvToolDefinitions, handleKvTool } from './tools/kv.js';
import { workersToolDefinitions, handleWorkersTool } from './tools/workers.js';
import { workerSecretsToolDefinitions, handleWorkerSecretsTool } from './tools/worker-secrets.js';
import { workerAnalyticsToolDefinitions, handleWorkerAnalyticsTool } from './tools/worker-analytics.js';
import { webAnalyticsToolDefinitions, handleWebAnalyticsTool } from './tools/web-analytics.js';
import { r2ToolDefinitions, handleR2Tool } from './tools/r2.js';

const allToolDefinitions: Tool[] = ([
  ...zonesToolDefinitions,
  ...dnsToolDefinitions,
  ...diagnosticsToolDefinitions,
  ...tunnelsToolDefinitions,
  ...wafToolDefinitions,
  ...zerotrustToolDefinitions,
  ...securityToolDefinitions,
  ...kvToolDefinitions,
  ...workersToolDefinitions,
  ...workerSecretsToolDefinitions,
  ...workerAnalyticsToolDefinitions,
  ...webAnalyticsToolDefinitions,
  ...r2ToolDefinitions,
] as unknown) as Tool[];

const toolHandlers = new Map<
  string,
  (name: string, args: Record<string, unknown>, client: CloudflareClient) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
>();

for (const def of zonesToolDefinitions) toolHandlers.set(def.name, handleZonesTool);
for (const def of dnsToolDefinitions) toolHandlers.set(def.name, handleDnsTool);
for (const def of diagnosticsToolDefinitions) toolHandlers.set(def.name, handleDiagnosticsTool);
for (const def of tunnelsToolDefinitions) toolHandlers.set(def.name, handleTunnelsTool);
for (const def of wafToolDefinitions) toolHandlers.set(def.name, handleWafTool);
for (const def of zerotrustToolDefinitions) toolHandlers.set(def.name, handleZerotrustTool);
for (const def of securityToolDefinitions) toolHandlers.set(def.name, handleSecurityTool);
for (const def of kvToolDefinitions) toolHandlers.set(def.name, handleKvTool);
for (const def of workersToolDefinitions) toolHandlers.set(def.name, handleWorkersTool);
for (const def of workerSecretsToolDefinitions) toolHandlers.set(def.name, handleWorkerSecretsTool);
for (const def of workerAnalyticsToolDefinitions) toolHandlers.set(def.name, handleWorkerAnalyticsTool);
for (const def of webAnalyticsToolDefinitions) toolHandlers.set(def.name, handleWebAnalyticsTool);
for (const def of r2ToolDefinitions) toolHandlers.set(def.name, handleR2Tool);

const server = new Server(
  { name: 'mcp-cloudflare', version: '2026.3.16.10' },
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
