import { execSync } from "child_process";

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  remote: string | null;
}

export interface GitCommandResult {
  ok: boolean;
  output: string;
}

export function getGitStatus(repoPath: string): GitStatus {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: repoPath,
    encoding: "utf-8",
  }).trim();

  let remote: string | null = null;
  let ahead = 0;
  let behind = 0;

  try {
    remote = execSync("git rev-parse --abbrev-ref --symbolic-full-name @{upstream}", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();

    const counts = execSync("git rev-list --left-right --count HEAD...@{upstream}", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();
    const [aheadCount, behindCount] = counts.split(/\s+/).map(Number);
    ahead = Number.isFinite(aheadCount) ? aheadCount : 0;
    behind = Number.isFinite(behindCount) ? behindCount : 0;
  } catch {
    remote = null;
    ahead = 0;
    behind = 0;
  }

  return { branch, ahead, behind, remote };
}

export function runGitPull(repoPath: string): GitCommandResult {
  return runGitCommand("git pull", repoPath);
}

export function runGitPush(repoPath: string): GitCommandResult {
  return runGitCommand("git push", repoPath);
}

function runGitCommand(command: string, repoPath: string): GitCommandResult {
  try {
    const output = execSync(command, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return {
      ok: true,
      output: output.length > 0 ? output : "ok",
    };
  } catch (err) {
    return {
      ok: false,
      output: normalizeCommandError(err),
    };
  }
}

function normalizeCommandError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Unknown git error";
  }

  const execError = err as Error & { stderr?: string | Buffer; stdout?: string | Buffer };
  const stderr = normalizeErrorChunk(execError.stderr);
  if (stderr) {
    return stderr;
  }

  const stdout = normalizeErrorChunk(execError.stdout);
  if (stdout) {
    return stdout;
  }

  return err.message;
}

function normalizeErrorChunk(chunk: string | Buffer | undefined): string {
  if (!chunk) {
    return "";
  }
  return chunk.toString().trim();
}
