# APARA Wiki Conventions

## Directory Structure

Keep source material under `raw/` and generated knowledge pages under `wiki/`.

```
raw/
  topics/
    source-file.md
wiki/
  index.md
  log.md
  entities/
  concepts/
  summaries/
  synthesis/
```

## Page Format

Every wiki page uses YAML frontmatter followed by markdown body content.

```yaml
---
title: "Page Title"
type: entity | concept | summary | synthesis
sources:
  - path/relative/to/raw.md
created: YYYY-MM-DD
updated: YYYY-MM-DD
links:
  - concepts/related-page.md
---
```

Required frontmatter fields:

- `title`: Human-readable page title.
- `type`: One of `entity`, `concept`, `summary`, `synthesis`.
- `sources`: Paths relative to `raw/`.
- `created`: Creation date in `YYYY-MM-DD`.
- `updated`: Last updated date in `YYYY-MM-DD`.
- `links`: Relative paths to related wiki pages.

## Naming Conventions

- Use lowercase kebab-case file names (for example: `type-safety.md`).
- Keep one concept (or one entity) per page.
- Place pages in the matching subdirectory (`entities/`, `concepts/`, `summaries/`, `synthesis/`).

## Cross-Referencing Rules

- Add links for related concepts, entities, and summaries whenever a relationship is explicit.
- Store links in frontmatter `links` using relative wiki paths.
- Use `[[wiki-links]]` syntax in body text for human-readable cross references.
- Avoid orphan pages; each page should connect to at least one other page when possible.

## Ingest Workflow

1. Place new source files in `raw/`.
2. Create or update a summary page in `wiki/summaries/`.
3. Extract entities and update pages in `wiki/entities/`.
4. Extract concepts and update pages in `wiki/concepts/`.
5. Add or update synthesis pages in `wiki/synthesis/` for cross-source themes.
6. Update `wiki/index.md` and append an action entry to `wiki/log.md`.

## Handling Contradictions

When sources disagree, do not delete either claim. Record both claims, cite each source path, and note uncertainty explicitly so future updates can reconcile the contradiction.
