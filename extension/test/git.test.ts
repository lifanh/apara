import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { gitCommit, gitAdd, isGitRepo } from "../src/git.js";

describe("git", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-git-test-"));
    execSync("git init", { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects a git repo", () => {
    expect(isGitRepo(tempDir)).toBe(true);
  });

  it("detects a non-git directory", () => {
    const nonGit = mkdtempSync(join(tmpdir(), "apara-nogit-"));
    expect(isGitRepo(nonGit)).toBe(false);
    rmSync(nonGit, { recursive: true, force: true });
  });

  it("stages and commits files", () => {
    const file = join(tempDir, "test.md");
    writeFileSync(file, "hello");
    gitAdd(tempDir, ["test.md"]);
    gitCommit(tempDir, "test commit");
    const log = execSync("git log --oneline", { cwd: tempDir, encoding: "utf-8" });
    expect(log).toContain("test commit");
  });
});
