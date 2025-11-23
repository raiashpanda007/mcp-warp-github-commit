import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";


async function main() {
  const server = new McpServer({
    name: 'git-commit-mcp',
    version: '1.0.0'
  });

  const transport = new StdioServerTransport();
  console.info("INFO :: Started github MCP Server");
  await server.connect(transport)
}

main().catch(err => {
  console.error("ERROR :: In starting MCP Server", err);
  process.exit(1)
}
)
