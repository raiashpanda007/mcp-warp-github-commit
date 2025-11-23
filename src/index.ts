import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runGitCommand, readStageDiff, readChangedFiles } from "./git.js";
import { z } from "zod";

async function main() {
  const server = new McpServer({
    name: 'git-commit-mcp',
    version: '1.0.0'
  });

  // Register tools before connecting the transport so capabilities are set up first

  // Handler signatures must accept (args, extra) and return content items with literal "type" values.
  server.registerTool(
    'getGitDiffTool',
    {
      title: "get_git_diff",
      description: "Return the staged git diff (git diff --cached). Returns { diff, truncated, error }",
      inputSchema: z.object({
        maxBytes: z.number().optional()
      }) as any,
      outputSchema: z.object({
        diff: z.string().nullable(),
        truncated: z.boolean(),
        error: z.string().nullable()
      }) as any
    },
    async (args: { maxBytes?: number }, _extra: any) => {
      const { maxBytes } = args ?? {};
      const output = await readStageDiff({ maxBytes });

      // return content items using the exact literal types expected by the SDK
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output)
          }
        ],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    'getChangedFilesTool',
    {
      title: 'get_changed_files',
      description: 'Return the list of staged changed files (git diff --cached --name-only).',
      inputSchema: z.object({}) as any,
      outputSchema: z.object({
        files: z.array(z.string()),
        error: z.union([z.string(), z.null()])
      }) as any
    },
    async (_args: any, _extra: any) => {
      const output = await readChangedFiles();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output)
          }
        ],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    'getDiffSummaryTool',
    {
      title: 'get_diff_summary',
      description: 'Return a compact summary of the staged diff: list of files and top hunks (trimmed).',
      inputSchema: z.object({
        maxFiles: z.number().default(10),
        maxHunksPerFile: z.number().default(3),
        maxBytes: z.number().default(100000)
      }) as any,
      outputSchema: z.object({
        files: z.array(z.object({
          path: z.string(),
          hunks: z.array(z.string())
        })),
        truncated: z.boolean(),
        error: z.string().nullable()
      }) as any
    },
    async (args: { maxFiles?: number; maxHunksPerFile?: number; maxBytes?: number }, _extra: any) => {
      const { maxFiles = 10, maxHunksPerFile = 3, maxBytes = 100000 } = args ?? {};

      try {
        const diffResult = await readStageDiff({ maxBytes });

        if (!diffResult || !diffResult.diff) {
          const emptyOut = { files: [], truncated: !!(diffResult && diffResult.truncated), error: diffResult?.error ?? null };
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(emptyOut)
              }
            ],
            structuredContent: emptyOut
          };
        }

        const diffText: string = diffResult.diff;
        const fileSections: Array<{ path: string; hunks: string[] }> = [];

        // Split into file sections by "diff --git" header
        const sections = diffText.split(/\n(?=diff --git )/);

        for (const section of sections) {
          const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+?)\b/);
          if (!headerMatch) continue;
          const path = headerMatch[2];

          // split into hunks by lines starting with @@
          const hunkParts = section.split(/\n(?=@@ )/).slice(1); // first part is header
          const hunks: string[] = [];

          for (let i = 0; i < Math.min(hunkParts.length, maxHunksPerFile); i++) {
            let hunk = hunkParts[i].trim();
            if (!hunk.startsWith('@@')) {
              hunk = '@@ ' + hunk;
            }
            if (hunk.length > 1000) {
              hunk = hunk.slice(0, 1000) + '... [truncated]';
            }
            hunks.push(hunk);
          }

          fileSections.push({ path, hunks });

          if (fileSections.length >= maxFiles) break;
        }

        const output = { files: fileSections, truncated: !!diffResult.truncated, error: null as string | null };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(output)
            }
          ],
          structuredContent: output
        };
      } catch (err: any) {
        const output = { files: [], truncated: false, error: String(err) };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(output)
            }
          ],
          structuredContent: output
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  console.info("INFO :: Started github MCP Server");
  await server.connect(transport);
}

main().catch(err => {
  console.error("ERROR :: In starting MCP Server", err);
  process.exit(1);
});