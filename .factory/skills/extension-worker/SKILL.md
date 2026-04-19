---
name: extension-worker
description: Modifies Pi Agent extension code — modules, templates, tests
---

# Extension Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

For features involving the APARA Pi Agent extension: TypeScript modules in `extension/src/`, templates in `extension/templates/`, and tests in `extension/test/`.

## Required Skills

None.

## Work Procedure

### 1. Understand the Feature

Read the feature description, preconditions, and expectedBehavior. Read `AGENTS.md` for constraints. Check existing extension code patterns in `extension/src/` and `extension/test/`.

### 2. Write Tests First (TDD)

- Create or update test files in `extension/test/<module>.test.ts`
- Follow existing patterns: `describe`/`it`, temp dirs with `mkdtempSync`, cleanup in `afterEach`
- Use `import` with `.js` extension for local modules
- Run tests to confirm they fail: `cd /Users/lifan/dev/ai/apara/extension && npx vitest run`

### 3. Implement

**Conventions:**
- ESM with `.js` extension in imports
- Plain named exports (no classes)
- `const` over `let`, no `var`
- No comments unless genuinely complex
- Error handling: throw `Error` with descriptive messages

**Templates:**
- Place in `extension/templates/`
- Content should be self-contained markdown

**Module changes:**
- Modify existing modules in `extension/src/`
- Keep changes minimal and focused

### 4. Run Validators

```bash
cd /Users/lifan/dev/ai/apara/extension && npx vitest run
```

Fix all failures.

### 5. Verify Manually

For template files, verify:
- File exists at expected path
- Content includes all required sections
- `initRepo()` behavior is correct by running the relevant test

## Example Handoff

```json
{
  "salientSummary": "Created AGENTS.md template at extension/templates/AGENTS.md with all 6 required sections. Updated initRepo() in repo.ts to copy template to repo root (skips if exists). Added 3 new test cases in repo.test.ts, all passing.",
  "whatWasImplemented": "extension/templates/AGENTS.md — wiki conventions template with Directory Structure, Page Format, Naming Conventions, Cross-Referencing Rules, Ingest Workflow, Handling Contradictions sections. Modified extension/src/repo.ts initRepo() to copy template to repoRoot/AGENTS.md if not present. Added readFileSync import for template reading.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd /Users/lifan/dev/ai/apara/extension && npx vitest run", "exitCode": 0, "observation": "5 test files, all tests passed including 3 new AGENTS.md tests" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "extension/test/repo.test.ts",
        "cases": [
          { "name": "initRepo creates AGENTS.md from template", "verifies": "AGENTS.md created with template content" },
          { "name": "initRepo does not overwrite existing AGENTS.md", "verifies": "Custom content preserved" },
          { "name": "template includes all required sections", "verifies": "All 6 section headings present" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Extension module dependencies are missing or incompatible
- Test infrastructure is broken
- Changes would break the Pi Agent extension registration
