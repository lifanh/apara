import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

export interface AparaConfig {
  name: string;
  model?: string;
  wiki_dir: string;
  raw_dir: string;
  auto_commit: boolean;
  remote?: string;
}

const DEFAULT_CONFIG: AparaConfig = {
  name: "My Brain",
  wiki_dir: "wiki",
  raw_dir: "raw",
  auto_commit: true,
};

const AGENTS_TEMPLATE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "AGENTS.md",
);

export function loadConfig(repoRoot: string): AparaConfig {
  const configPath = join(repoRoot, ".apara.yaml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseYaml(raw);
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function initRepo(repoRoot: string): void {
  const config = loadConfig(repoRoot);
  const rawDir = join(repoRoot, config.raw_dir);
  const wikiDir = join(repoRoot, config.wiki_dir);

  const dirs = [
    rawDir,
    join(wikiDir, "entities"),
    join(wikiDir, "concepts"),
    join(wikiDir, "summaries"),
    join(wikiDir, "synthesis"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  const indexPath = join(wikiDir, "index.md");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `# ${config.name} — Wiki Index\n\n_No pages yet._\n`);
  }

  const logPath = join(wikiDir, "log.md");
  if (!existsSync(logPath)) {
    writeFileSync(logPath, `# ${config.name} — Activity Log\n`);
  }

  const agentsPath = join(repoRoot, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    const agentsTemplate = readFileSync(AGENTS_TEMPLATE_PATH, "utf-8");
    writeFileSync(agentsPath, agentsTemplate);
  }
}

export function validateRepo(repoRoot: string): string[] {
  const config = loadConfig(repoRoot);
  const errors: string[] = [];
  const rawDir = join(repoRoot, config.raw_dir);
  const wikiDir = join(repoRoot, config.wiki_dir);

  if (!existsSync(rawDir)) errors.push(`Missing raw directory: ${rawDir}`);
  if (!existsSync(wikiDir)) errors.push(`Missing wiki directory: ${wikiDir}`);
  if (!existsSync(join(wikiDir, "index.md"))) errors.push("Missing wiki/index.md");
  if (!existsSync(join(wikiDir, "log.md"))) errors.push("Missing wiki/log.md");

  return errors;
}
