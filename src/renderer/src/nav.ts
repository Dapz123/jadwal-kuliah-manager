export const NAV_ITEMS = [
  {
    label: 'Data',
    children: [
      { path: '/mata-kuliah', label: 'Mata Kuliah' },
      { path: '/dosen', label: 'Dosen' },
      { path: '/kurikulum', label: 'Kurikulum' }
    ]
  },
  {
    label: 'Jadwal',
    children: [
      { path: '/jadwal', label: 'Jadwal' },
      { path: '/beban-dosen', label: 'Beban Dosen' },
      { path: '/export', label: 'Export' }
    ]
  },
  {
    label: 'Pengaturan',
    children: [
      { path: '/program-studi', label: 'Program Studi' },
      { path: '/waktu-sks', label: 'Waktu SKS' }
    ]
  }
] as const

export type NavLeaf = { readonly path: string; readonly label: string }

export function isNavGroup(
  item: (typeof NAV_ITEMS)[number]
): item is Extract<(typeof NAV_ITEMS)[number], { children: readonly unknown[] }> {
  return 'children' in item
}

export function navLeaves(): NavLeaf[] {
  return NAV_ITEMS.flatMap((item) => [...item.children])
}

export const DEFAULT_PATH = '/mata-kuliah'

export function navGroupOpen(
  toggled: boolean | undefined,
  childPaths: readonly string[],
  pathname: string
): boolean {
  if (toggled != null) {
    return toggled
  }
  return childPaths.includes(pathname)
}
