import { join } from 'node:path'

export type DatabasePathEnv = {
  portableExecutableDir?: string
  /** Repo / project root used for electron-vite dev (unset PORTABLE_EXECUTABLE_DIR). */
  projectRoot: string
}

/** Packaged portable: beside the exe. Dev: repo-local `.data/jadwal.db`. */
export function resolveDatabasePath(env: DatabasePathEnv): string {
  const portable = env.portableExecutableDir?.trim()
  if (portable) {
    return join(portable, 'data', 'jadwal.db')
  }
  return join(env.projectRoot, '.data', 'jadwal.db')
}
