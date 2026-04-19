import { relative, resolve } from "path";

export function safePath(base: string, requested: string): string | null {
  const fullPath = resolve(base, requested);
  const rel = relative(base, fullPath);
  if (rel.startsWith("..") || rel === "") {
    if (rel === "") {
      return fullPath;
    }
    return null;
  }
  return fullPath;
}
