import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { initRepo, validateRepo, loadConfig } from "./src/repo.js";
import { appendToLog, getUningestedSources } from "./src/ingest.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("apara-init", {
    description: "Initialize an APARA knowledge base in the current directory",
    handler: async (_args, ctx) => {
      const cwd = process.cwd();
      initRepo(cwd);
      ctx.ui.notify("APARA knowledge base initialized!", "info");
    },
  });

  pi.registerCommand("apara-status", {
    description: "Check the health of the current APARA knowledge base",
    handler: async (_args, ctx) => {
      const cwd = process.cwd();
      const errors = validateRepo(cwd);
      if (errors.length === 0) {
        const config = loadConfig(cwd);
        ctx.ui.notify(`✅ ${config.name} — healthy`, "info");
      } else {
        ctx.ui.notify(`❌ ${errors.length} issues found:\n${errors.join("\n")}`, "warning");
      }
    },
  });

  pi.registerTool({
    name: "apara_ingest",
    label: "Ingest Source",
    description:
      "Ingest a raw source file into the APARA wiki. Reads the source, creates a summary page, and updates the index and log. The LLM should then update or create relevant entity/concept pages based on the source content.",
    parameters: Type.Object({
      source_path: Type.String({ description: "Path to the source file relative to raw/, e.g. rust/ch1.md" }),
    }),
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const rawDir = join(cwd, config.raw_dir);
      const wikiDir = join(cwd, config.wiki_dir);
      const fullPath = join(rawDir, params.source_path);

      if (!existsSync(fullPath)) {
        throw new Error(`Source file not found: ${params.source_path}`);
      }

      const content = readFileSync(fullPath, "utf-8");
      appendToLog(wikiDir, "ingest", params.source_path);

      return {
        content: [
          {
            type: "text" as const,
            text: `Source file read successfully: ${params.source_path}\n\nContent:\n\n${content}\n\nPlease:\n1. Create a summary page at wiki/summaries/${basename(params.source_path)}\n2. Update or create relevant entity/concept pages\n3. Update wiki/index.md with new pages\n4. Commit with message "ingest: ${params.source_path}"`,
          },
        ],
      };
    },
  });

  pi.registerTool({
    name: "apara_lint",
    label: "Wiki Lint",
    description:
      "Health-check the APARA wiki. Finds: uningested sources, orphan pages, missing cross-references, and stale pages.",
    parameters: Type.Object({}),
    async execute() {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const rawDir = join(cwd, config.raw_dir);
      const wikiDir = join(cwd, config.wiki_dir);

      const uningested = getUningestedSources(rawDir, wikiDir);
      const errors = validateRepo(cwd);

      let report = "## Wiki Health Report\n\n";

      if (errors.length > 0) {
        report += `### Structural Issues\n${errors.map((e) => `- ❌ ${e}`).join("\n")}\n\n`;
      }

      if (uningested.length > 0) {
        report += `### Uningested Sources (${uningested.length})\n${uningested.map((s) => `- 📄 ${s}`).join("\n")}\n\n`;
      }

      report += "Please also check for:\n- Contradictions between pages\n- Orphan pages with no inbound links\n- Concepts mentioned but lacking their own page\n- Broken [[wiki-links]]";

      appendToLog(wikiDir, "lint", `${errors.length} structural issues, ${uningested.length} uningested`);

      return {
        content: [{ type: "text" as const, text: report }],
      };
    },
  });

  pi.registerTool({
    name: "apara_query",
    label: "Wiki Query",
    description:
      "Query the APARA wiki. Reads the wiki index to find relevant pages, then reads those pages to answer the question.",
    parameters: Type.Object({
      question: Type.String({ description: "The question to answer" }),
    }),
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const wikiDir = join(cwd, config.wiki_dir);
      const indexPath = join(wikiDir, "index.md");

      let indexContent = "";
      if (existsSync(indexPath)) {
        indexContent = readFileSync(indexPath, "utf-8");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Question: ${params.question}\n\nWiki Index:\n\n${indexContent}\n\nPlease:\n1. Identify relevant wiki pages from the index\n2. Read those pages\n3. Synthesize an answer with citations\n4. If the answer is valuable, offer to save it as a wiki/synthesis/ page`,
          },
        ],
      };
    },
  });
}
