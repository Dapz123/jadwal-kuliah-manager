# Breaking Changes Policy

**Status**: Enforced | **Last Updated**: 2026-08-30

This policy governs how breaking changes—especially database schema modifications that affect existing user data—are handled in this project. **AI agents must follow these rules; humans can override with explicit acknowledgment.**

---

## 📋 What Counts as a Breaking Change

A breaking change is any modification that causes:
- **Data loss or corruption** for existing users upgrading to a new version
- **Incompatibility** with existing databases, eliminating the upgrade path
- **Loss of functionality** that users depend on without migration support

### Common Examples in This Project

1. **Dropping a column** from the `dosen` (instructor) table
   - ❌ Bad: `ALTER TABLE dosen DROP COLUMN years_of_experience;` (silently loses data)
   - ✅ Good: Deprecate for 3 releases; provide migration to archive data

2. **Renaming a table** without migration
   - ❌ Bad: `ALTER TABLE jadwal RENAME TO schedule;` (existing apps can't find the table)
   - ✅ Good: Create new table, copy data, deprecate old one, migrate in stages

3. **Changing an enum value** that users' records reference
   - ❌ Bad: Removing `semester_ke = 5` from an enum if existing schedules use it
   - ✅ Good: Provide migration to map old values to new ones; warn users

4. **Modifying a foreign key constraint** without migration
   - ❌ Bad: Changing `ON DELETE CASCADE` to `ON DELETE RESTRICT` without updating existing data
   - ✅ Good: Add a deprecation notice; migrate data in advance; then enforce new constraint

---

## 🛡️ Core Rules

### Rule 1: No Silent Data Deletion
**AI agents MUST refuse** any change that deletes user data without providing:
- A migration script that preserves/transforms the data
- A clear deprecation path (3 release cycle minimum)

### Rule 2: Always Provide a Migration
When a breaking change is unavoidable:
- Write the **migration first**
- Test it on existing data
- Document the upgrade path in `docs/migrations/`
- Include a rollback strategy

### Rule 3: Deprecation Timeline
| Phase | Duration | Action |
|-------|----------|--------|
| **Release N** | 1 release cycle | Deprecation warning in logs/UI; new code uses new schema |
| **Release N+1** | 1 release cycle | Stronger warning; migration encouraged |
| **Release N+2** | 1 release cycle | Final warning; migration strongly enforced |
| **Release N+3** | On upgrade | Old schema no longer supported; migration mandatory |

### Rule 4: AI Detection & Warning
When an AI agent detects a schema change (in SQL files, migrations, or database type definitions), it **MUST**:

1. **Identify the change** (e.g., "column drop detected")
2. **Check for risk** (e.g., "does this lose user data?")
3. **Propose a safe migration** or refuse with explanation
4. **Warn the user** before proceeding

**Example AI response:**
```
⚠️  Breaking Change Detected: Column 'years_of_experience' drop proposed on 'dosen' table.

🚫 Risk: This will lose instructor experience data for existing users.

✅ Suggestion: Instead, deprecate the column for 3 releases:
   1. Keep column; add new column if needed
   2. Write migration to archive data to 'dosen_history'
   3. Update UI to read from history
   4. Remove after 3 releases

Do you want to:
A) Use the suggested migration path
B) Override (requires explicit acknowledgment)
C) Cancel this change
```

---

## 🏗️ Detection Layers (Defense in Depth)

### Layer 1: Rule List (Obvious Mistakes)
AI agents check for:
- `DROP COLUMN`, `DROP TABLE` without migration
- Type changes in critical columns (e.g., `INTEGER` → `TEXT`)
- Removal of `NOT NULL` constraints
- Removal of foreign key references

### Layer 2: AI Reasoning (Subtle Cases)
AI agents reason about:
- Whether old data is still valid in the new schema
- Whether existing app code can still work
- Whether users have time to upgrade

### Layer 3: CI/CD Tests (Safeguard)
- Migration runs on a copy of production schema
- Verify data integrity post-migration
- Test rollback scenarios

---

## 🔧 CI Enforcement: The BREAKING_CHANGE_ACKNOWLEDGED Flag

All database schema changes go through CI checks:

```yaml
# In your migration commit message or PR:
BREAKING_CHANGE_ACKNOWLEDGED: yes
DEPRECATION_TIMELINE: Release 1.5 → 1.8 (3 cycles)
MIGRATION_PATH: [link to migration docs]
ROLLBACK_STRATEGY: [how to undo this if needed]
REVIEWED_BY: [any developer name]
```

**CI will:**
1. ✅ Allow migrations with `BREAKING_CHANGE_ACKNOWLEDGED` + migration docs
2. ❌ Block migrations that drop columns/tables **without** this flag + docs
3. ✅ Allow migrations with zero risk (adding columns, adding tables, etc.)

---

## 👥 Who Can Acknowledge Breaking Changes

**Any developer** can acknowledge a breaking change (this enforces intentionality, not gatekeeping). However:
- The change **must be documented** (migration path + timeline)
- The change **must be reviewed** in code review
- AI agents must **warn first** and suggest the migration

---

## 📝 Migration File Template

When proposing a migration, include in `docs/migrations/`:

```markdown
# Migration: [Version] - [Description]

## What's changing
- Dropping column `X` from table `Y`

## Why
- [Business reason]

## Impact
- Existing users' data in column `X` will be archived
- App version N+3 will require the new schema

## Migration steps
1. Create `dosen_history` table
2. Copy data: `INSERT INTO dosen_history SELECT * FROM dosen WHERE years_of_experience IS NOT NULL`
3. Drop `years_of_experience` column (N+3 release)

## Rollback
- Restore the column from backup
- Restore from `dosen_history` table
```

---

## 🤖 AI Agent Checklist

When touching database schema, AI agents must:

- [ ] Is this a breaking change? (Run against the rule list above)
- [ ] If yes: Can I propose a migration?
- [ ] If yes: Is deprecation timeline >= 3 releases?
- [ ] If no: Refuse and explain why
- [ ] Have I documented the migration in `docs/migrations/`?
- [ ] Have I updated the migration file with rollback strategy?

---

## References

- `docs/migrations/` — Migration history
- `docs/adr/` — Architecture decision records
- `.github/copilot-instructions.md` — AI agent instructions (invokes this policy)
