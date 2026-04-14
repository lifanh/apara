import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { initRepo, validateRepo, loadConfig } from "./src/repo.js";
import { appendToLog } from "./src/ingest.js";
import { moveSource } from "./src/lifecycle.js";
import { recalculateAllHeat } from "./src/heat.js";

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
      source_path: Type.String({ description: "Path to the source file relative to raw/, e.g. projects/learn-rust/ch1.md" }),
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
    name: "apara_lifecycle",
    label: "PARA Lifecycle",
    description:
      "Move a source between PARA categories (projects, areas, resources, archives). Recalculates heat on affected wiki pages.",
    parameters: Type.Object({
      source_path: Type.String({ description: "Current path relative to raw/, e.g. projects/learn-rust" }),
      target_category: Type.Union([
        Type.Literal("projects"),
        Type.Literal("areas"),
        Type.Literal("resources"),
        Type.Literal("archives"),
      ]),
    }),
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const rawDir = join(cwd, config.raw_dir);
      const wikiDir = join(cwd, config.wiki_dir);

      const { oldPath, newPath } = moveSource(rawDir, params.source_path, params.target_category as any);
      const heatChanges = recalculateAllHeat(wikiDir);
      appendToLog(wikiDir, "lifecycle", `${oldPath} → ${newPath}`);

      let summary = `Moved ${oldPath} → ${newPath}`;
      if (heatChanges.length > 0) {
        summary += `\n\nHeat changes:\n${heatChanges.map((c) => `  ${c.path}: ${c.oldHeat} → ${c.newHeat}`).join("\n")}`;
      }

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    },
  });
}
