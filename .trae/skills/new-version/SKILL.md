---
name: "new-version"
description: "Creates a new version release by updating package.json version and README changelog (both Chinese and English). Invoke when user wants to release a new version, bump version, or update changelog."
---

# New Version

This skill handles creating a new version release for the project. It performs the following steps:

1. **Ask for version and changelog** (if not provided by the user)
2. **Update `package.json`** — change the `version` field
3. **Update `README.md`** — add changelog entry in both Chinese and English sections

## Trigger Conditions

Invoke this skill when:
- User asks to create a new version / release a new version
- User asks to bump the version number
- User asks to update the changelog for a new release
- User mentions "new version", "release", "bump version", "新建版本", "发布版本", "更新版本号"

## Step 1: Collect Information

If the user has NOT specified the version number and/or changelog content, ask them using the AskUserQuestion tool:

1. **Version number**: Ask what the new version number is (e.g., `1.5.0`). The current version can be read from `package.json`.
2. **Changelog**: Ask for the changelog content in the new version. The user should provide a brief description of changes.

## Step 2: Update package.json

- Read `package.json` and update the `version` field to the new version number.
- Only change the `version` field, nothing else.

## Step 3: Update README.md Changelog

The README.md contains two changelog sections that must be updated:

### Chinese Changelog Section

Located under the `### 更新日志` heading. Insert a new entry **at the top** (after the heading line), before existing entries.

Format:
```
#### {version}
{changelog content}
```

### English Changelog Section

Located under the `### Changelog` heading. Insert a new entry **at the top** (after the heading line), before existing entries.

Format:
```
#### {version}
{changelog content}
```

### Important Notes

- New entries must be inserted at the TOP of the changelog (most recent version first).
- The Chinese and English changelog entries should correspond to each other.
- If the user only provides changelog in one language, translate it to the other language.
- Maintain the existing formatting style of the changelog entries (e.g., use `**bold**` for feature names, use `-` for bullet points).
- If the user provides changelog in Chinese, use it for the Chinese section and translate to English for the English section.
- If the user provides changelog in English, use it for the English section and translate to Chinese for the Chinese section.

## Verification

After making all changes, display a summary to the user:
- Old version → New version
- Chinese changelog entry added
- English changelog entry added
