---
name: "new-version"
description: "Creates a new version release by updating package.json version and changelog.md. Invoke when user wants to release a new version, bump version, or update changelog."
---

# New Version

This skill handles creating a new version release for the project. It performs the following steps:

1. **Determine version and changelog** (ask user or generate from git log)
2. **Update `package.json`** — change the `version` field
3. **Update `changelog.md`** — add changelog entry at the top
4. **Create git tag** — tag the commit with the new version

## Trigger Conditions

Invoke this skill when:
- User asks to create a new version / release a new version
- User asks to bump the version number
- User asks to update the changelog for a new release
- User mentions "new version", "release", "bump version", "新建版本", "发布版本", "更新版本号"

## Important: Scope Limitation

**This skill ONLY updates version numbers, changelogs, and creates git tags.** It does NOT modify any source code, configuration, or algorithms — even if the changelog description mentions code changes. The changelog content describes what was changed elsewhere; it is not an instruction to make those changes.

## Step 1: Collect Information

### 1.1 Collect Changelog

- If the user has provided changelog content, use it directly.
- If the user has NOT provided changelog content, **use git log to generate changelog entries**:
  1. Run `git describe --tags --abbrev=0` to find the latest version tag.
  2. Run `git log <latest_tag>..HEAD --oneline` to get all commits since the last tag.
  3. Summarize these commits into concise changelog entries in Chinese, following the existing style in `changelog.md`.
  4. **Only include plugin-related changes** (features, bug fixes, UI changes, performance improvements, etc.). Exclude non-plugin changes such as SKILL.md modifications, README updates, CI/config changes, or development tooling adjustments.

### 1.2 Determine Version Number

- If the user has specified the version number, use it directly.
- If the user has NOT specified the version number, **auto-determine based on the changelog content** using Semantic Versioning rules:

  Read the current version from `package.json` (format: `MAJOR.MINOR.PATCH`, e.g., `1.6.3`), then decide the bump type:

  | Bump Type | Condition | Example (`1.6.3` →) |
  |---|---|---|
  | **PATCH** (修订号) | Bug fixes, minor optimizations, small improvements that are fully backward compatible | `1.6.4` |
  | **MINOR** (次版本号) | New features, new functionality, significant enhancements that are backward compatible | `1.7.0` |
  | **MAJOR** (主版本号) | Breaking changes, major architecture refactoring, incompatible API changes | `2.0.0` |

  **Decision logic** (evaluate in order):
  1. If the changelog contains breaking changes or major architectural refactoring → bump **MAJOR**.
  2. If the changelog contains new features or significant new functionality → bump **MINOR**.
  3. Otherwise (bug fixes, minor optimizations, small improvements) → bump **PATCH**.

  After determining the new version number, inform the user of the auto-determined version and the reason before proceeding.

## Step 2: Update package.json

- Read `package.json` and update the `version` field to the new version number.
- Only change the `version` field, nothing else.

## Step 3: Update changelog.md

The changelog file is `changelog.md` at the project root. It contains changelog entries in Chinese.

Insert a new entry **at the top** (after the `### 更新日志` heading line), before existing entries.

Format:
```
#### {version}
{changelog content}
```

### Important Notes

- New entries must be inserted at the TOP of the changelog (most recent version first).
- Maintain the existing formatting style of the changelog entries (e.g., use `**bold**` for feature names, use `-` for bullet points).
- Changelog content is in Chinese only.

## Step 4: Create Git Tag

After updating `package.json` and `changelog.md`, create a git tag for the new version:

1. Run `git add package.json changelog.md` to stage the changes.
2. Run `git commit -m "chore: release v{version}"` to commit.
3. Run `git tag v{version}` to create the version tag (e.g., `v1.7.0`).

Do NOT push the commit or tag — leave that to the user.

## Verification

After making all changes, display a summary to the user:
- Old version → New version
- Changelog entry added to `changelog.md`
- Git tag `v{version}` created
