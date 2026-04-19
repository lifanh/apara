import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { safePath } from "./path-utils.js";

const TEXT_SOURCE_PATTERN = /\.(md|txt|yaml|yml|json|csv|tsv)$/i;
const TEXT_PREVIEW_LIMIT = 1_000_000;

export interface SourceListItem {
  name: string;
  size: number;
  isDirectory: boolean;
}

export interface BinarySourcePreview {
  name: string;
  size: number;
  type: "binary";
}

export function listSources(rawPath: string): SourceListItem[] {
  if (!existsSync(rawPath)) {
    return [];
  }

  const files = readdirSync(rawPath, { recursive: true }) as string[];
  return files
    .map((name) => normalizeRelativePath(name))
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const fileStat = statSync(join(rawPath, name));
      return {
        name,
        size: fileStat.size,
        isDirectory: fileStat.isDirectory(),
      };
    });
}

export function getSourcePreview(
  fullPath: string,
  requestedPath: string,
): string | BinarySourcePreview {
  const fileStat = statSync(fullPath);
  if (fileStat.size < TEXT_PREVIEW_LIMIT && TEXT_SOURCE_PATTERN.test(requestedPath)) {
    return readFileSync(fullPath, "utf-8");
  }

  return {
    name: requestedPath,
    size: fileStat.size,
    type: "binary",
  };
}

export function writeUploadedSource(
  rawPath: string,
  targetDirectory: string,
  fileName: string,
  content: Uint8Array,
): string {
  const normalizedTarget = normalizeDirectory(targetDirectory);
  const directoryPath = safePath(rawPath, normalizedTarget);
  if (!directoryPath) {
    throw new Error("Forbidden");
  }

  const safeName = basename(fileName).trim();
  if (!safeName || safeName === "." || safeName === "..") {
    throw new Error("Invalid file name");
  }

  mkdirSync(directoryPath, { recursive: true });

  const relativePath = normalizedTarget ? `${normalizedTarget}/${safeName}` : safeName;
  const destinationPath = safePath(rawPath, relativePath);
  if (!destinationPath) {
    throw new Error("Forbidden");
  }

  writeFileSync(destinationPath, content);
  return relativePath;
}

function normalizeDirectory(path: string): string {
  return normalizeRelativePath(path).replace(/\/+$/, "");
}

function normalizeRelativePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}
