import { renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export type ParaCategory = "projects" | "areas" | "resources" | "archives";

export function getParaCategory(sourcePath: string): string {
  return sourcePath.split("/")[0];
}

export function moveSource(
  rawDir: string,
  sourcePath: string,
  targetCategory: ParaCategory
): { oldPath: string; newPath: string } {
  const parts = sourcePath.split("/");
  const itemPath = parts.slice(1).join("/");
  const oldFull = join(rawDir, sourcePath);
  const newRelative = `${targetCategory}/${itemPath}`;
  const newFull = join(rawDir, newRelative);

  if (!existsSync(oldFull)) {
    throw new Error(`Source not found: ${sourcePath}`);
  }

  mkdirSync(dirname(newFull), { recursive: true });
  renameSync(oldFull, newFull);

  return { oldPath: sourcePath, newPath: newRelative };
}
