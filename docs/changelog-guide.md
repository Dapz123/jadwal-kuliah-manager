# Changelog Guide

This guide explains how to write clear, actionable changelog entries that help users understand what's new in each release.

## Quick Start

1. Create a `.yaml` file in `.changelog-entries/`
2. Fill in `section` (required) and `title` (required)
3. Optionally add `pr` and `author`
4. Run changelog generator before release
5. Files are auto-deleted after merge

**Example:**

```yaml
# .changelog-entries/feature-export-xlsx.yaml
section: Added
title: 'Dukungan ekspor jadwal ke format XLSX untuk laporan beban dosen'
pr: '42'
author: 'bangdapz'
```

---

## Sections

Choose the appropriate section for your change:

### Added (Ditambahkan)

New features or capabilities.

**When to use:**

- New UI feature or button
- New export format
- New API endpoint
- New validation rule

**Examples:**

- "Fitur pencarian lintas jadwal dengan filter semester"
- "Dukungan impor data dari file CSV"
- "Tombol 'Hapus Semua' di panel manajemen ruang"

---

### Fixed (Diperbaiki)

Bug fixes or corrections to existing behavior.

**When to use:**

- Crash or runtime error fixed
- Incorrect calculation corrected
- UI display issue resolved
- Logic bug patched

**Examples:**

- "Perbaikan deteksi bentrok jadwal lintas program studi"
- "Koreksi perhitungan beban dosen yang keliru pada semester ganjil"
- "Memperbaiki crash saat ekspor jadwal dengan karakter spesial"

---

### Changed (Diubah)

Updates to existing features or behavior modifications.

**When to use:**

- UI layout or design updated
- Algorithm improved
- Default behavior changed
- Performance optimized

**Examples:**

- "Perubahan antarmuka manajemen ruang kelas untuk clarity"
- "Pengoptimalan performa ekspor untuk file besar (>1000 entri)"
- "Perubahan default sorting jadwal ke nama dosen"

---

### Removed (Dihapus)

Features or functionality that have been deleted.

**When to use:**

- Old feature deprecated and removed
- Obsolete code removed
- Unused command/option deleted

**Examples:**

- "Penghapusan fitur legacy 'Quick Export' diganti dengan 'Smart Export'"
- "Penghapusan dukungan format ODS (gunakan XLSX sebagai alternatif)"

---

### Deprecated (Disarankan Tidak Digunakan)

Features that are planned for removal in a future release.

**When to use:**

- Feature still works but will be removed soon
- Old API still supported but better alternative exists
- Giving users time to migrate

**Examples:**

- "Fitur 'Manual Sync' disarankan tidak digunakan; gunakan 'Auto Sync' sebagai gantinya"
- "Format ekspor CSV akan dihapus di v2.0.0; migrasi ke XLSX"

---

### Security (Keamanan)

Security fixes, vulnerabilities, or privacy improvements.

**When to use:**

- Vulnerability patched
- Permission/access control tightened
- Data privacy improved
- Authentication/encryption fixed

**Examples:**

- "Perbaikan SQL injection vulnerability pada pencarian jadwal"
- "Enkripsi data sensibel di database lokal"
- "Pembatasan akses file jadwal hanya untuk pengguna admin"

---

## Writing Tips

### ✅ Good Titles

**Clear and specific:**

- "Dukungan ekspor jadwal ke format XLSX"
- "Perbaikan deteksi bentrok jadwal lintas prodi"
- "Pengoptimalan performa loading jadwal > 500 entri"

**Not vague:**

- ❌ "Perbaikan" (too generic)
- ❌ "Update sistem" (no detail)
- ❌ "Berbagai perbaikan" (too broad)

---

### ✅ Focus on User Impact

Write for **users and admins**, not developers.

**Good:**

- "Jadwal sekarang cek otomatis bentrok antar prodi"
- "Ekspor XLSX 3x lebih cepat untuk file besar"

**Not ideal:**

- "Refactor collision detection algorithm"
- "Optimize O(n²) to O(n log n) in scheduler"

---

### ✅ Use Action Verbs

Start with strong, clear verbs:

- **Fitur baru:** Tambahkan, Dukung, Buat, Sediakan
- **Perbaikan:** Perbaiki, Koreksi, Tangani, Tangani
- **Perubahan:** Perubahan, Optimalkan, Tingkatkan, Sederhanakan
- **Penghapusan:** Hapus, Buang, Tutup

---

### ✅ Keep it Concise

Titles should be **1-2 sentences**, not paragraphs.

**Good:**

- "Dukungan untuk ekspor jadwal ke format XLSX dengan warna otomatis"

**Too long:**

- "Kami menambahkan dukungan pengguna untuk mengekspor jadwal mereka ke format Microsoft Excel (XLSX) dengan pemetaan warna otomatis berdasarkan nama dosen, yang memudahkan pembacaan dan analisis visual data jadwal perkuliahan secara real-time di aplikasi desktop"

---

## When to Commit vs. Manual Entry

### Auto-Extracted from Git (Conventional Commits)

Commits with these prefixes are automatically extracted:

- `feat:` → Added
- `fix:` → Fixed
- `refactor:`, `perf:` → Changed

**Use when:**

- The commit message is clear and user-facing
- No additional context needed
- Change is straightforward

**Example commit:**

```
feat: add XLSX export for student schedules
```

Extracted as:

```
- Add XLSX export for student schedules
```

---

### Manual Entry (`.yaml`)

Create a manual entry when:

- You want to highlight importance (big feature, critical fix)
- Commit message is too technical
- You need to add PR link and author attribution
- You want to group related changes
- The change affects multiple commits

**Use when:**

- "Major: Jadwal export 3x lebih cepat"
- "Security: Fixed SQL injection in search"
- "Breaking: Changed API response format (see migration guide)"

**Example:**

```yaml
section: Added
title: 'Dukungan ekspor jadwal ke format XLSX dengan pemformatan otomatis'
pr: '42'
author: 'bangdapz'
```

---

## File Naming Convention

Use this pattern for entry filenames:

```
<section>-<short-description>.yaml
```

**Examples:**

- `added-xlsx-export.yaml`
- `fixed-bentrok-detection.yaml`
- `changed-ui-layout.yaml`
- `security-sql-injection-fix.yaml`
- `removed-legacy-sync.yaml`

---

## Complete Example

Here's a complete release with mixed auto-extracted and manual entries:

### Git commits (auto-extracted):

```
feat: add search filter for schedules
fix: correct SKS calculation for elective courses
refactor: optimize database query performance
docs: update README
```

→ Becomes:

- **Added:** Add search filter for schedules
- **Fixed:** Correct SKS calculation for elective courses
- **Changed:** Optimize database query performance

### Manual entries (`.yaml`):

**added-xlsx-export.yaml:**

```yaml
section: Added
title: 'Dukungan ekspor jadwal ke format XLSX dengan warna otomatis'
pr: '42'
author: 'bangdapz'
```

**security-validation-fix.yaml:**

```yaml
section: Security
title: 'Perbaikan validasi input pada form pencarian jadwal'
pr: '38'
author: 'user'
```

### Result in changelog:

```markdown
## [1.1.0] - 2026-09-02

### Ditambahkan

- Add search filter for schedules
- Dukungan ekspor jadwal ke format XLSX dengan warna otomatis (#42) — @bangdapz

### Diperbaiki

- Correct SKS calculation for elective courses

### Keamanan

- Perbaikan validasi input pada form pencarian jadwal (#38) — @user

### Diubah

- Optimize database query performance
```

---

## Translation Notes

Entries are written in **Indonesian** (Bahasa Indonesia). Sections are also translated:

| English    | Indonesian                 |
| ---------- | -------------------------- |
| Added      | Ditambahkan                |
| Fixed      | Diperbaiki                 |
| Changed    | Diubah                     |
| Removed    | Dihapus                    |
| Deprecated | Disarankan Tidak Digunakan |
| Security   | Keamanan                   |

**Tip:** Write titles in Indonesian, but you can mix English terms (e.g., "CSV", "XLSX", "API") where appropriate.

---

## Checklist Before Release

- [ ] All significant commits use Conventional Commits format
- [ ] Manual entries created for important changes
- [ ] Manual entry filenames follow pattern: `<section>-<description>.yaml`
- [ ] Section names are correct (Added, Fixed, Changed, Removed, Deprecated, Security)
- [ ] Titles are clear and user-facing
- [ ] PR numbers included for traceability (optional but recommended)
- [ ] Author names included (optional)
- [ ] Titles are in Indonesian
- [ ] No duplicate entries

---

## Resources

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — Format specification
- [Conventional Commits](https://www.conventionalcommits.org/) — Commit message standard
- [Semantic Versioning](https://semver.org/) — Version numbering guide
- [docs/RELEASE.md](./RELEASE.md) — Complete release workflow
