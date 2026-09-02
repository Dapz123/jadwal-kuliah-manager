# Release Process

This document describes the complete workflow for releasing a new version of **Jadwal Kuliah Manager**.

## Release Workflow Overview

```
Commit Changes → Tag Release → Generate Changelog → Build Artifacts → Publish Release
```

### Step 1: Prepare Changes & Commit

Create manual changelog entries **before** the release:

```bash
# Create entry files in .changelog-entries/
# Examples provided in .changelog-entries/README.md

# Example: feature-export-xlsx.yaml
section: Added
title: "Dukungan ekspor ke format XLSX untuk laporan beban dosen"
pr: "42"
author: "bangdapz"
```

**Guidelines:**

- Use Conventional Commits for meaningful commits (`feat:`, `fix:`, `refactor:`, etc.)
- Non-meaningful commits (docs, chore, style) are auto-filtered
- Manual entries add context and highlight important changes

### Step 2: Create a Git Tag

Once all changes are committed and pushed to `main`:

```bash
# Create annotated tag (recommended)
git tag -a v1.0.1 -m "Release version 1.0.1"

# Or lightweight tag
git tag v1.0.1

# Push tag to remote
git push origin v1.0.1
```

**Versioning:** Follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` (e.g., `1.0.1`, `2.3.0`)

### Step 3: Generate Changelog

Trigger the GitHub Actions workflow manually:

1. Go to **Actions** → **Generate Changelog**
2. Click **Run workflow**
3. Input version: `1.0.1` (or `v1.0.1`, format is flexible)
4. Workflow will:
   - Extract commits since the previous tag
   - Load manual entries from `.changelog-entries/`
   - Generate `/docs/changelog/changelog-v1.0.1.md` in Indonesian
   - Commit the changelog to a new branch: `changelog/v1.0.1`
   - **Auto-delete** processed `.changelog-entries/` files

**Alternative (Local):**

```bash
npm run generate-changelog -- 1.0.1
```

### Step 4: Review & Merge Changelog

The workflow creates a branch `changelog/v1.0.1`. You can:

1. **Review** the generated changelog at `/docs/changelog/changelog-v1.0.1.md`
2. **Push** the branch if not auto-pushed:
   ```bash
   git push origin changelog/v1.0.1
   ```
3. **Create a pull request** for peer review
4. **Merge** after approval

Or skip the PR and merge directly:

```bash
git checkout changelog/v1.0.1
git push origin changelog/v1.0.1
git checkout main
git pull origin changelog/v1.0.1
```

### Step 5: Build Artifacts (Windows/Linux)

Once changelog is merged to `main`:

```bash
# Build portable executables
npm run build
npm run dist
```

Outputs:

- `dist/Jadwal Kuliah Manager Setup 1.0.1.exe` (Windows)
- `dist/Jadwal-Kuliah-Manager-1.0.1.AppImage` (Linux) [when CI is configured]

### Step 6: Create GitHub Release

Create a release manually on GitHub:

1. Go to **Releases** → **Draft a new release**
2. **Tag:** Select the tag you created (e.g., `v1.0.1`)
3. **Title:** Release title (e.g., `Version 1.0.1`)
4. **Description:** Copy content from `/docs/changelog/changelog-v1.0.1.md`
5. **Attach Artifacts:**
   - Upload built `.exe` and `.AppImage` files
6. **Publish Release**

---

## Workflow Files Reference

| File                                       | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `.github/workflows/generate-changelog.yml` | GitHub Actions workflow for automated changelog generation  |
| `scripts/generate-changelog.ts`            | Node.js script that generates changelog (can run locally)   |
| `.changelog-entries/`                      | Directory for manual changelog entry files (`.yaml` format) |
| `docs/changelog/`                          | Output directory for generated changelogs (versioned files) |
| `.changelog-entries/README.md`             | Guide for writing manual changelog entries                  |

---

## Troubleshooting

### Changelog Already Exists

If `changelog-v1.0.1.md` already exists:

- The workflow will **overwrite** it
- Ensure version number is unique for new releases

### No Changes Found

If the workflow detects no commits since last tag:

- Add manual entries to `.changelog-entries/` before running
- Workflow will still create a changelog (minimal, but valid)

### Commits Not Extracted

Ensure commits follow **Conventional Commits** format:

- `feat: description` → Added
- `fix: description` → Fixed
- `refactor: description` → Changed
- Other types (`docs`, `chore`, `style`) are skipped

### Workflow Failed

Check workflow logs in GitHub Actions:

1. **Actions** tab → **Generate Changelog**
2. Click failed run → **View logs**
3. Look for error messages (parse errors, file conflicts, etc.)

---

## Best Practices

✅ **Do:**

- Create manual entries for user-facing changes
- Use Conventional Commits for all commits
- Review generated changelog before merge
- Tag releases after all changes are merged
- Include PR numbers in manual entries for traceability

❌ **Don't:**

- Push tags before changelog is generated
- Create duplicate version numbers
- Edit `.changelog-entries/` files during workflow execution
- Skip the changelog review step

---

## Example Release Checklist

- [ ] All changes merged to `main`
- [ ] Manual changelog entries created in `.changelog-entries/`
- [ ] Git tag created and pushed (`v1.0.1`)
- [ ] Changelog generated via GitHub Actions
- [ ] Changelog reviewed and merged
- [ ] Build artifacts generated (`npm run dist`)
- [ ] GitHub Release created with artifacts
- [ ] Release published
- [ ] Announcement sent to users

---

## Release Frequency

Releases can be made at any cadence. Common patterns:

- **Semantic Versioning**: Release on feature completion, bug fixes, or milestones
- **Calendar-based**: Monthly or quarterly releases
- **Continuous**: Release whenever `main` is stable (daily/weekly)

See [Semantic Versioning](https://semver.org/) for version numbering guidelines.
