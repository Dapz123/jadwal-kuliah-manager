# Manual Changelog Entries

This directory contains manual changelog entries for the next release. Each entry is a YAML file that will be merged into the generated changelog.

## Format

Each entry is a `.yaml` file with the following structure:

```yaml
section: Added # or: Fixed, Changed, Removed, Deprecated, Security
title: 'Deskripsi singkat fitur atau perbaikan dalam bahasa Indonesia'
pr: '123' # (optional) GitHub PR number
author: 'username' # (optional) GitHub username
```

## Sections

- **Added** (Ditambahkan): Fitur atau kemampuan baru
- **Fixed** (Diperbaiki): Bug fixes atau perbaikan masalah
- **Changed** (Diubah): Perubahan pada fitur yang ada
- **Removed** (Dihapus): Fitur atau fungsionalitas yang dihapus
- **Deprecated** (Disarankan Tidak Digunakan): Fitur yang akan dihapus di masa depan
- **Security** (Keamanan): Perbaikan keamanan atau kerentanan

## Example

```yaml
# .changelog-entries/feature-export-xlsx.yaml
section: Added
title: 'Dukungan ekspor ke format XLSX untuk laporan beban dosen'
pr: '42'
author: 'bangdapz'
```

## Workflow

1. Create a new `.yaml` file in this directory before release
2. Run `npm run generate-changelog -- <version>` to generate the changelog
3. The script will:
   - Extract commits since the last tag
   - Merge in entries from this directory
   - Generate `/docs/changelog/changelog-v<version>.md`
   - **Delete processed entries automatically**

## Guidelines

- Write in **Indonesian** (Bahasa Indonesia)
- Keep titles concise (1-2 sentences)
- Include PR number and author for traceability
- One entry per file
- Filename pattern: `<section>-<short-description>.yaml`

Example filenames:

- `added-sqlite-export.yaml`
- `fixed-bentrok-semester.yaml`
- `changed-ui-layout.yaml`
- `security-sql-injection-fix.yaml`

## Tips

- For commits with Conventional Commits format (`feat:`, `fix:`, etc.), those are extracted automatically
- Manual entries are useful for context, highlighting impact, or grouping related changes
- After changelog generation, these files are deleted—re-create them for the next release
