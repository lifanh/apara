import { execSync } from "child_process";

export function isGitRepo(dir: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd: dir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function gitAdd(repoRoot: string, files: string[]): void {
  for (const file of files) {
    execSync(`git add "${file}"`, { cwd: repoRoot, stdio: "pipe" });
  }
}

export function gitCommit(repoRoot: string, message: string): void {
  execSync(`git commit -m "${message}"`, { cwd: repoRoot, stdio: "pipe" });
}

export function gitStatus(repoRoot: string): string {
  return execSync("git status --porcelain", { cwd: repoRoot, encoding: "utf-8" });
}
