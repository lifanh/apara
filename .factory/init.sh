#!/bin/bash
set -e

cd /Users/lifan/dev/ai/apara

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install
fi

if [ ! -d "app/node_modules" ]; then
  cd app && npm install && cd ..
fi

if [ ! -d "extension/node_modules" ]; then
  cd extension && npm install && cd ..
fi

# Create test knowledge repo if TEST_REPO_PATH not set
if [ -z "$TEST_REPO_PATH" ]; then
  export TEST_REPO_PATH=$(mktemp -d /tmp/apara-test-repo-XXXXXX)
  echo "Created test repo at $TEST_REPO_PATH"
fi

# Initialize test repo structure
mkdir -p "$TEST_REPO_PATH/raw/books"
mkdir -p "$TEST_REPO_PATH/raw/articles"
mkdir -p "$TEST_REPO_PATH/wiki/entities"
mkdir -p "$TEST_REPO_PATH/wiki/concepts"
mkdir -p "$TEST_REPO_PATH/wiki/summaries"
mkdir -p "$TEST_REPO_PATH/wiki/synthesis"

# Create .apara.yaml if missing
if [ ! -f "$TEST_REPO_PATH/.apara.yaml" ]; then
  cat > "$TEST_REPO_PATH/.apara.yaml" << 'EOF'
name: "Test Brain"
wiki_dir: wiki
raw_dir: raw
auto_commit: true
EOF
fi

# Create sample raw sources if empty
if [ ! -f "$TEST_REPO_PATH/raw/books/sample-book.md" ]; then
  echo "# Sample Book\n\nThis is a sample source document about TypeScript." > "$TEST_REPO_PATH/raw/books/sample-book.md"
fi

if [ ! -f "$TEST_REPO_PATH/raw/articles/ai-safety.md" ]; then
  echo "# AI Safety\n\nAn article about AI safety considerations." > "$TEST_REPO_PATH/raw/articles/ai-safety.md"
fi

if [ ! -f "$TEST_REPO_PATH/raw/rust-intro.md" ]; then
  echo "# Introduction to Rust\n\nRust is a systems programming language." > "$TEST_REPO_PATH/raw/rust-intro.md"
fi

# Create sample wiki pages
if [ ! -f "$TEST_REPO_PATH/wiki/entities/typescript.md" ]; then
  cat > "$TEST_REPO_PATH/wiki/entities/typescript.md" << 'EOF'
---
title: "TypeScript"
type: entity
sources:
  - books/sample-book.md
created: 2026-04-10
updated: 2026-04-12
links:
  - concepts/type-safety.md
---

TypeScript is a typed superset of JavaScript.
EOF
fi

if [ ! -f "$TEST_REPO_PATH/wiki/concepts/type-safety.md" ]; then
  cat > "$TEST_REPO_PATH/wiki/concepts/type-safety.md" << 'EOF'
---
title: "Type Safety"
type: concept
sources: []
created: 2026-04-11
updated: 2026-04-11
links:
  - entities/typescript.md
---

Type safety prevents type errors at compile time.
EOF
fi

# Create wiki index
if [ ! -f "$TEST_REPO_PATH/wiki/index.md" ]; then
  cat > "$TEST_REPO_PATH/wiki/index.md" << 'EOF'
# Test Brain — Wiki Index

- [TypeScript](entities/typescript.md) — _entity_
- [Type Safety](concepts/type-safety.md) — _concept_
EOF
fi

# Create wiki log with sample entries
if [ ! -f "$TEST_REPO_PATH/wiki/log.md" ]; then
  cat > "$TEST_REPO_PATH/wiki/log.md" << 'EOF'
# Test Brain — Activity Log

## [2026-04-12] ingest | books/sample-book.md

## [2026-04-11] lint | 0 structural issues, 2 uningested

## [2026-04-10] query | What is TypeScript?

## [2026-04-10] ingest | articles/old-article.md
EOF
fi

# Initialize git repo if not already
if [ ! -d "$TEST_REPO_PATH/.git" ]; then
  cd "$TEST_REPO_PATH"
  git init
  git config user.email "test@apara.dev"
  git config user.name "APARA Test"
  git add -A
  git commit -m "init: test knowledge repo"
  cd /Users/lifan/dev/ai/apara
fi

echo "Test repo ready at $TEST_REPO_PATH"
echo "TEST_REPO_PATH=$TEST_REPO_PATH"
