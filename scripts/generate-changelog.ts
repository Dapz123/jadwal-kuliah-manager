import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'yaml'

interface ChangelogEntry {
  section: 'Added' | 'Fixed' | 'Changed' | 'Removed' | 'Deprecated' | 'Security'
  title: string
  pr?: string
  author?: string
}

interface ChangesBySection {
  [key: string]: string[]
}

const SECTION_NAMES_EN = {
  Added: 'Added',
  Fixed: 'Fixed',
  Changed: 'Changed',
  Removed: 'Removed',
  Deprecated: 'Deprecated',
  Security: 'Security'
}

const SECTION_NAMES_ID = {
  Added: 'Ditambahkan',
  Fixed: 'Diperbaiki',
  Changed: 'Diubah',
  Removed: 'Dihapus',
  Deprecated: 'Disarankan Tidak Digunakan',
  Security: 'Keamanan'
}

// Normalize version (strip 'v' prefix if present)
function normalizeVersion(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version
}

// Find the previous version tag
function getPreviousTag(): string | null {
  try {
    const tags = execSync('git tag --sort=-version:refname', {
      encoding: 'utf-8'
    })
      .trim()
      .split('\n')
      .filter((tag) => tag)

    if (tags.length === 0) return null
    return tags[0] // Most recent tag
  } catch {
    return null
  }
}

// Extract commits since a given tag using Conventional Commits format
function extractCommits(since: string | null): ChangesBySection {
  try {
    const range = since ? `${since}..HEAD` : 'HEAD'
    const logs = execSync(`git log ${range} --oneline --pretty=format:"%s"`, {
      encoding: 'utf-8'
    })
      .trim()
      .split('\n')
      .filter((line) => line)

    const changes: ChangesBySection = {
      Added: [],
      Fixed: [],
      Changed: [],
      Removed: [],
      Deprecated: [],
      Security: []
    }

    const conventionalPattern =
      /^(feat|fix|refactor|perf|docs|style|test|chore)(\(.+\))?!?:\s*(.+)$/

    for (const log of logs) {
      const match = log.match(conventionalPattern)
      if (!match) continue

      const type = match[1]
      const message = match[3]

      let section: keyof typeof changes = 'Changed'

      switch (type) {
        case 'feat':
          section = 'Added'
          break
        case 'fix':
          section = 'Fixed'
          break
        case 'refactor':
        case 'perf':
          section = 'Changed'
          break
        case 'docs':
        case 'style':
        case 'test':
        case 'chore':
          continue // Skip non-meaningful commits
      }

      // Deduplicate
      if (!changes[section].includes(message)) {
        changes[section].push(message)
      }
    }

    return changes
  } catch (error) {
    console.error('Failed to extract commits:', error)
    throw new Error('Unable to extract commits from git log')
  }
}

// Load manual changelog entries from .changelog-entries/
function loadManualEntries(): ChangelogEntry[] {
  const entriesDir = '.changelog-entries'

  if (!fs.existsSync(entriesDir)) {
    return []
  }

  const entries: ChangelogEntry[] = []

  const files = fs
    .readdirSync(entriesDir)
    .filter((file) => file.endsWith('.yaml') && file !== 'README.md')

  for (const file of files) {
    const filePath = path.join(entriesDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')

    try {
      const entry = yaml.parse(content) as ChangelogEntry

      if (!entry.section || !entry.title) {
        console.error(`Invalid entry in ${file}: missing 'section' or 'title'`)
        process.exit(1)
      }

      entries.push(entry)
    } catch (error) {
      console.error(`Failed to parse ${file}:`, error)
      process.exit(1)
    }
  }

  return entries
}

// Merge commits and manual entries
function mergeChanges(
  commitsChanges: ChangesBySection,
  manualEntries: ChangelogEntry[]
): ChangesBySection {
  const merged: ChangesBySection = { ...commitsChanges }

  for (const section in SECTION_NAMES_EN) {
    if (!merged[section]) {
      merged[section] = []
    }
  }

  for (const entry of manualEntries) {
    const message =
      entry.author && entry.pr
        ? `${entry.title} ([#${entry.pr}](https://github.com/user/repo/pull/${entry.pr})) — @${entry.author}`
        : entry.title

    if (!merged[entry.section].includes(message)) {
      merged[entry.section].push(message)
    }
  }

  return merged
}

// Generate changelog in Indonesian
function generateChangelog(version: string, changes: ChangesBySection, date: string): string {
  let content = `# Changelog

Semua perubahan penting dari proyek ini akan didokumentasikan dalam file ini.

Format didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [${version}] - ${date}

`

  let hasContent = false

  for (const section of Object.keys(SECTION_NAMES_EN)) {
    const items = changes[section as keyof typeof changes] || []

    if (items.length === 0) continue

    hasContent = true
    const sectionNameId = SECTION_NAMES_ID[section as keyof typeof SECTION_NAMES_ID]

    content += `### ${sectionNameId}\n\n`

    for (const item of items) {
      content += `- ${item}\n`
    }

    content += '\n'
  }

  if (!hasContent) {
    console.warn('⚠️  Warning: No changes found. Changelog will be minimal.')
    content += '### Ditambahkan\n\n- (Tidak ada perubahan signifikan)\n\n'
  }

  return content
}

// Delete processed changelog entries
function deleteProcessedEntries(): void {
  const entriesDir = '.changelog-entries'

  if (!fs.existsSync(entriesDir)) {
    return
  }

  const files = fs.readdirSync(entriesDir).filter((file) => file.endsWith('.yaml'))

  for (const file of files) {
    const filePath = path.join(entriesDir, file)
    fs.unlinkSync(filePath)
    console.log(`Deleted: ${filePath}`)
  }
}

// Main function
async function main(): Promise<void> {
  const version = process.argv[2]

  if (!version) {
    console.error('❌ Error: Version argument required')
    console.error('Usage: npm run generate-changelog -- <version>')
    process.exit(1)
  }

  const normalizedVersion = normalizeVersion(version)

  console.log(`📝 Generating changelog for v${normalizedVersion}...`)

  // Check if changelog already exists
  const changelogPath = path.join('docs', 'changelog', `changelog-v${normalizedVersion}.md`)

  if (fs.existsSync(changelogPath)) {
    console.warn(`⚠️  Warning: ${changelogPath} already exists. It will be overwritten.`)
  }

  // Get previous tag
  const previousTag = getPreviousTag()
  console.log(`📍 Previous tag: ${previousTag || '(none - first release)'}`)

  // Extract commits
  console.log(`🔍 Extracting commits since ${previousTag || 'beginning'}...`)
  const commitChanges = extractCommits(previousTag)

  // Load manual entries
  console.log(`📂 Loading manual entries from .changelog-entries/...`)
  const manualEntries = loadManualEntries()
  console.log(`   Found ${manualEntries.length} manual entries.`)

  // Merge changes
  const allChanges = mergeChanges(commitChanges, manualEntries)

  // Generate changelog content
  const today = new Date().toISOString().split('T')[0]
  const changelogContent = generateChangelog(normalizedVersion, allChanges, today)

  // Ensure directory exists
  const changelogDir = path.dirname(changelogPath)
  if (!fs.existsSync(changelogDir)) {
    fs.mkdirSync(changelogDir, { recursive: true })
  }

  // Write changelog
  fs.writeFileSync(changelogPath, changelogContent, 'utf-8')
  console.log(`✅ Changelog written to: ${changelogPath}`)

  // Delete processed entries
  console.log(`🗑️  Cleaning up processed entries...`)
  deleteProcessedEntries()

  console.log(`\n✨ Done! Changelog for v${normalizedVersion} is ready.`)
  console.log(`Review and push the changes when ready.`)
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
