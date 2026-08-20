import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  Bentrok,
  BentrokSemesterKe,
  Dosen,
  Jadwal,
  JadwalSnapshot,
  JenisKelas,
  Kelas,
  Kurikulum,
  ProgramStudi,
  Semester,
  WaktuSks
} from '../../../shared/api'
import { isApiError } from '../../../shared/api-error'
import { jamSelesaiDariMulai } from '../../../shared/waktu-sks'
import {
  Banner,
  CatalogList,
  Dialog,
  PageShell,
  PageTabs,
  actionDangerBtn,
  dangerBtn,
  primaryBtn,
  saveBtn,
  secondaryBtn
} from '../chrome'
import { dosenNamaLengkap, filterByVisibleText } from '../master-data/catalog'
import {
  filterDosen,
  formatJam,
  groupKelasSections,
  hariLabel,
  jadwalDaftarTitle,
  jadwalSubmitEnabled,
  jamMulaiDefault,
  jamMulaiOutsideJenisWindow,
  joinBentrok,
  joinBentrokSemesterKe,
  kelasSaveAction,
  kelengkapan,
  countBentrokJadwal,
  parseJam,
  parseJadwalDeepLink
} from './jadwal'
import LembarPanel from './LembarPanel'

const SEMESTERS: Semester[] = ['Ganjil', 'Genap']
const JENIS_KELAS: JenisKelas[] = ['Reguler Pagi', 'Reguler Sore']
const HARI_VALUES = [1, 2, 3, 4, 5, 6, 7] as const
const JADWAL_TABS = [
  { id: 'daftar' as const, label: 'Daftar' },
  { id: 'kelas' as const, label: 'Kelas' },
  { id: 'lembar' as const, label: 'Lembar' }
]

type JadwalTab = (typeof JADWAL_TABS)[number]['id']

type KelasFields = {
  dosenId: number | null
  hari: number | null
  jamMulai: number | null
}

function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan'
}

function loadJadwal(
  prodiRows: ProgramStudi[],
  setJadwal: (rows: Jadwal[]) => void,
  setKurikulum: (rows: Kurikulum[]) => void,
  setError: (message: string | null) => void
): void {
  void Promise.all([
    Promise.all(prodiRows.map((row) => window.api.listJadwal(row.id))),
    Promise.all(prodiRows.map((row) => window.api.listKurikulum(row.id)))
  ]).then(
    ([jadwalLists, kurikulumLists]) => {
      setJadwal(jadwalLists.flat())
      setKurikulum(kurikulumLists.flat())
      setError(null)
    },
    (cause: unknown) => setError(errorMessage(cause))
  )
}

export default function JadwalPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<JadwalTab>('daftar')
  const [prodi, setProdi] = useState<ProgramStudi[] | null>(null)
  const [programStudiId, setProgramStudiId] = useState<number | null>(null)
  const [jadwal, setJadwal] = useState<Jadwal[]>([])
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focusSnapshotId, setFocusSnapshotId] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<Jadwal | null>(null)
  const [bentrokJadwalCount, setBentrokJadwalCount] = useState<Record<number, number>>({})

  function refreshJadwal(): void {
    if (prodi == null) {
      return
    }
    loadJadwal(prodi, setJadwal, setKurikulum, setError)
  }

  useEffect(() => {
    void window.api.listProgramStudi().then(
      (rows) => {
        setProdi(rows)
        setError(null)
        loadJadwal(rows, setJadwal, setKurikulum, setError)
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [])

  useEffect(() => {
    const link = parseJadwalDeepLink(searchParams)
    if (link == null) {
      return
    }
    const row = jadwal.find((item) => item.id === link.jadwalId)
    if (row == null) {
      return
    }
    setSelectedId(row.id)
    setFocusSnapshotId(link.snapshotMkId)
    setTab('kelas')
    setSearchParams(
      (current) => {
        if (!current.has('jadwalId') && !current.has('snapshotMkId')) {
          return current
        }
        const next = new URLSearchParams(current)
        next.delete('jadwalId')
        next.delete('snapshotMkId')
        return next
      },
      { replace: true }
    )
  }, [jadwal, searchParams, setSearchParams])

  useEffect(() => {
    if (tab !== 'daftar' || jadwal.length === 0) {
      if (jadwal.length === 0) {
        setBentrokJadwalCount({})
      }
      return
    }
    let cancelled = false
    void Promise.all(
      jadwal.map((row) =>
        window.api.listBentrok(row.id).then(
          (entries) => [row.id, countBentrokJadwal(entries)] as const,
          () => [row.id, 0] as const
        )
      )
    ).then((pairs) => {
      if (!cancelled) {
        setBentrokJadwalCount(Object.fromEntries(pairs))
      }
    })
    return () => {
      cancelled = true
    }
  }, [tab, jadwal])

  if (prodi == null) {
    return (
      <PageShell
        title="Jadwal"
        description="Satu Prodi × tahun akademik × semester × jenis kelas."
      >
        {error ? <Banner message={error} /> : <></>}
      </PageShell>
    )
  }

  if (prodi.length === 0 && !error) {
    return (
      <PageShell
        title="Jadwal"
        description="Satu Prodi × tahun akademik × semester × jenis kelas."
      >
        <p className="text-slate-600">Buat Program Studi dulu</p>
      </PageShell>
    )
  }

  const prodiById = new Map(prodi.map((row) => [row.id, row]))
  const kurikulumNama = new Map(kurikulum.map((row) => [row.id, row.nama]))
  const jadwalForView =
    programStudiId == null
      ? jadwal
      : jadwal.filter((row) => row.programStudiId === programStudiId)
  const selected = selectedId == null ? null : (jadwal.find((row) => row.id === selectedId) ?? null)
  const daftarTitle = (row: Jadwal): string => {
    const kode = prodiById.get(row.programStudiId)?.kode ?? ''
    return jadwalDaftarTitle({
      kode,
      tahunAkademik: row.tahunAkademik,
      semester: row.semester,
      jenisKelas: row.jenisKelas
    })
  }
  const visible = filterByVisibleText(jadwalForView, filter, (row) => [
    daftarTitle(row),
    kurikulumNama.get(row.kurikulumId) ?? ''
  ])

  function selectJadwal(row: Jadwal): void {
    setSelectedId(row.id)
    setFocusSnapshotId(null)
    setTab('kelas')
  }

  function openKelasAt(snapshotMkId: number): void {
    setFocusSnapshotId(snapshotMkId)
    setTab('kelas')
  }

  return (
    <PageShell
      title="Jadwal"
      description="Satu Prodi × tahun akademik × semester × jenis kelas."
      action={
        tab === 'daftar' ? (
          <button type="button" className={primaryBtn} onClick={() => setCreating(true)}>
            Buat
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <PageTabs tabs={JADWAL_TABS} value={tab} onChange={setTab} />
        {error ? <Banner message={error} /> : null}
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="space-y-3"
        >
          {tab === 'daftar' ? (
            <div className="space-y-3">
              <label className="block max-w-md text-sm">
                <span className="text-slate-700">Program Studi</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5 text-sm"
                  aria-label="Program Studi"
                  value={programStudiId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setProgramStudiId(value === '' ? null : Number(value))
                    setSelectedId(null)
                  }}
                >
                  <option value="">Semua Program Studi</option>
                  {prodi.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.kode} — {row.nama}
                    </option>
                  ))}
                </select>
              </label>
              <CatalogList
                entity="Jadwal"
                filter={filter}
                onFilter={setFilter}
                onAdd={() => setCreating(true)}
                addLabel="Buat"
                listError={null}
                catalogEmpty={jadwalForView.length === 0 && !error}
                rows={visible}
                title={daftarTitle}
                sublabel={(row) => kurikulumNama.get(row.kurikulumId) ?? ''}
                meta={(row) => {
                  const count = bentrokJadwalCount[row.id] ?? 0
                  if (count === 0) {
                    return null
                  }
                  return (
                    <span
                      className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      title={`${count} Jadwal bentrok dosen`}
                    >
                      Bentrok {count}
                    </span>
                  )
                }}
                onDelete={setPending}
                selectedId={selectedId}
                onSelect={selectJadwal}
              />
            </div>
          ) : selected == null ? (
            <p className="text-slate-600">Pilih Jadwal dulu</p>
          ) : (
            <div className="space-y-4">
              <p className="font-medium text-slate-900">{daftarTitle(selected)}</p>
              {tab === 'lembar' ? (
                <LembarPanel
                  key={selected.id}
                  jadwal={selected}
                  programStudi={prodiById.get(selected.programStudiId)}
                  onOpenSnapshot={openKelasAt}
                />
              ) : (
                <MappingTable
                  key={selected.id}
                  jadwalId={selected.id}
                  jenisKelas={selected.jenisKelas}
                  focusSnapshotId={focusSnapshotId}
                  onFocusConsumed={() => setFocusSnapshotId(null)}
                />
              )}
            </div>
          )}
        </div>
        {creating ? (
          <JadwalForm
            programStudi={prodi}
            programStudiId={programStudiId}
            kurikulum={kurikulum}
            onClose={() => setCreating(false)}
            onSaved={refreshJadwal}
          />
        ) : null}
        {pending ? (
          <Dialog
            title="Hapus Jadwal"
            footer={
              <>
                <button type="button" className={secondaryBtn} onClick={() => setPending(null)}>
                  Batal
                </button>
                <button
                  type="button"
                  className={dangerBtn}
                  onClick={() => {
                    const row = pending
                    setPending(null)
                    void window.api.deleteJadwal(row.id).then(
                      () => {
                        if (selectedId === row.id) {
                          setSelectedId(null)
                          setTab('daftar')
                        }
                        refreshJadwal()
                      },
                      (cause: unknown) => setError(errorMessage(cause))
                    )
                  }}
                >
                  Hapus
                </button>
              </>
            }
          >
            <p className="text-sm text-slate-700">
              Hapus Jadwal {pending.tahunAkademik} {pending.semester} {pending.jenisKelas}?
            </p>
          </Dialog>
        ) : null}
      </div>
    </PageShell>
  )
}

function JadwalForm({
  programStudi,
  programStudiId,
  kurikulum,
  onClose,
  onSaved
}: {
  programStudi: ProgramStudi[]
  programStudiId: number | null
  kurikulum: Kurikulum[]
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [prodiId, setProdiId] = useState(programStudiId == null ? '' : String(programStudiId))
  const [kurikulumId, setKurikulumId] = useState('')
  const [tahunAkademik, setTahunAkademik] = useState('')
  const [semester, setSemester] = useState('')
  const [jenisKelas, setJenisKelas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const kurikulumForProdi =
    prodiId === '' ? [] : kurikulum.filter((row) => row.programStudiId === Number(prodiId))
  const canSubmit =
    prodiId !== '' &&
    jadwalSubmitEnabled({ kurikulumId, tahunAkademik, semester, jenisKelas })

  async function save(): Promise<void> {
    if (prodiId === '') {
      return
    }
    setError(null)
    try {
      await window.api.createJadwal({
        programStudiId: Number(prodiId),
        kurikulumId: Number(kurikulumId),
        tahunAkademik: tahunAkademik.trim(),
        semester: semester as Semester,
        jenisKelas: jenisKelas as JenisKelas
      })
      onSaved()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog
      title="Buat Jadwal"
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={saveBtn}
            disabled={!canSubmit}
            onClick={() => void save()}
          >
            Simpan
          </button>
        </>
      }
    >
      {error ? <Banner message={error} /> : null}
      <label className="block text-sm">
        <span className="text-slate-700">Program Studi</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5"
          aria-label="Program Studi"
          value={prodiId}
          onChange={(event) => {
            setProdiId(event.target.value)
            setKurikulumId('')
          }}
        >
          <option value="">Pilih Program Studi</option>
          {programStudi.map((row) => (
            <option key={row.id} value={row.id}>
              {row.kode} — {row.nama}
            </option>
          ))}
        </select>
      </label>
      {prodiId !== '' && kurikulumForProdi.length === 0 ? (
        <p className="text-sm text-slate-600">Buat Kurikulum dulu</p>
      ) : (
        <label className="block text-sm">
          <span className="text-slate-700">Kurikulum</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5"
            value={kurikulumId}
            onChange={(event) => setKurikulumId(event.target.value)}
          >
            <option value="">Pilih Kurikulum</option>
            {kurikulumForProdi.map((row) => (
              <option key={row.id} value={row.id}>
                {row.nama}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm">
        <span className="text-slate-700">Tahun Akademik</span>
        <input
          type="text"
          placeholder="2026/2027"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
          value={tahunAkademik}
          onChange={(event) => setTahunAkademik(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Semester</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5"
          value={semester}
          onChange={(event) => setSemester(event.target.value)}
        >
          <option value="">Pilih Semester</option>
          {SEMESTERS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Jenis Kelas</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5"
          value={jenisKelas}
          onChange={(event) => setJenisKelas(event.target.value)}
        >
          <option value="">Pilih Jenis Kelas</option>
          {JENIS_KELAS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </Dialog>
  )
}

function kelengkapanMark(value: ReturnType<typeof kelengkapan>): string {
  if (value === 'missing') {
    return 'Belum ada Kelas'
  }
  if (value === 'incomplete') {
    return 'Belum lengkap'
  }
  return 'Lengkap'
}

function MappingTable({
  jadwalId,
  jenisKelas,
  focusSnapshotId,
  onFocusConsumed
}: {
  jadwalId: number
  jenisKelas: JenisKelas
  focusSnapshotId: number | null
  onFocusConsumed: () => void
}): JSX.Element {
  const [snapshots, setSnapshots] = useState<JadwalSnapshot[] | null>(null)
  const [kelas, setKelas] = useState<Kelas[]>([])
  const [dosen, setDosen] = useState<Dosen[]>([])
  const [waktuSks, setWaktuSks] = useState<WaktuSks | null>(null)
  const [bentrok, setBentrok] = useState<Bentrok[] | null>(null)
  const [bentrokSemesterKe, setBentrokSemesterKe] = useState<BentrokSemesterKe[] | null>(null)
  const [edits, setEdits] = useState<Record<number, KelasFields>>({})
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<JadwalSnapshot | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const kelasRef = useRef(kelas)
  const saveChain = useRef<Record<number, Promise<void>>>({})
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())

  useEffect(() => {
    kelasRef.current = kelas
  }, [kelas])

  useEffect(() => {
    if (focusSnapshotId == null || snapshots == null) {
      return
    }
    const node = rowRefs.current.get(focusSnapshotId)
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    setHighlightId(focusSnapshotId)
    const target = focusSnapshotId
    const timer = window.setTimeout(() => {
      setHighlightId((current) => (current === target ? null : current))
      onFocusConsumed()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [focusSnapshotId, snapshots])

  const refreshBentrok = useCallback((): void => {
    void window.api.listBentrok(jadwalId).then(
      (rows) => setBentrok(rows),
      (cause: unknown) => setError(errorMessage(cause))
    )
    void window.api.listBentrokSemesterKe(jadwalId).then(
      (rows) => setBentrokSemesterKe(rows),
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [jadwalId])

  useEffect(() => {
    void Promise.all([
      window.api.listJadwalSnapshots(jadwalId),
      window.api.listKelas(jadwalId),
      window.api.listDosen(),
      window.api.getWaktuSks()
    ]).then(
      ([snapshotRows, kelasRows, dosenRows, waktu]) => {
        setSnapshots(snapshotRows)
        setKelas(kelasRows)
        setDosen(dosenRows)
        setWaktuSks(waktu)
        setError(null)
        refreshBentrok()
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [jadwalId, refreshBentrok])

  const kelasBySnapshot = new Map(kelas.map((row) => [row.snapshotMkId, row]))

  function fieldsFor(snapshotId: number): KelasFields {
    const edit = edits[snapshotId]
    if (edit) {
      return edit
    }
    const row = kelasBySnapshot.get(snapshotId)
    return {
      dosenId: row?.dosenId ?? null,
      hari: row?.hari ?? null,
      jamMulai: row?.jamMulai ?? null
    }
  }

  async function persist(snapshot: JadwalSnapshot, next: KelasFields): Promise<void> {
    const existing = kelasRef.current.find((row) => row.snapshotMkId === snapshot.id)
    const action = kelasSaveAction(existing != null, next)
    if (action == null) {
      return
    }
    const input = { jadwalId, snapshotMkId: snapshot.id, ...next }
    try {
      if (action === 'create') {
        const created = await window.api.createKelas(input)
        kelasRef.current = [
          ...kelasRef.current.filter((row) => row.snapshotMkId !== snapshot.id),
          created
        ]
      } else if (existing != null && action === 'update') {
        const updated = await window.api.updateKelas(existing.id, input)
        kelasRef.current = kelasRef.current.map((row) => (row.id === updated.id ? updated : row))
      } else if (existing != null) {
        await window.api.deleteKelas(existing.id)
        kelasRef.current = kelasRef.current.filter((row) => row.id !== existing.id)
      }
      setKelas(kelasRef.current)
      setEdits((current) => {
        if (current[snapshot.id] !== next) {
          return current
        }
        const rest = { ...current }
        delete rest[snapshot.id]
        return rest
      })
      setError(null)
      refreshBentrok()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  function save(snapshot: JadwalSnapshot, next: KelasFields): void {
    setEdits((current) => ({ ...current, [snapshot.id]: next }))
    const previous = saveChain.current[snapshot.id] ?? Promise.resolve()
    saveChain.current[snapshot.id] = previous.then(
      () => persist(snapshot, next),
      () => persist(snapshot, next)
    )
  }

  if (snapshots == null) {
    return error ? <Banner message={error} /> : <></>
  }

  const joinedBentrok = joinBentrok(kelas, bentrok ?? [])
  const joinedBentrokSemesterKe = joinBentrokSemesterKe(kelas, bentrokSemesterKe ?? [])
  const sections = groupKelasSections(snapshots, query)

  return (
    <div className="space-y-3">
      {error ? <Banner message={error} /> : null}
      <input
        className="w-full max-w-md rounded border border-slate-300 px-3 py-1.5 text-sm"
        placeholder="Pencarian"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Pencarian Kelas"
      />
      {sections.length === 0 ? (
        <p className="text-slate-600">Tidak ada MK yang cocok</p>
      ) : (
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 text-center font-medium">Kode</th>
              <th className="px-2 py-2 text-center font-medium">Nama</th>
              <th className="px-2 py-2 text-center font-medium">SKS</th>
              <th className="px-2 py-2 text-center font-medium">Dosen</th>
              <th className="px-2 py-2 text-center font-medium">Hari</th>
              <th className="px-2 py-2 text-center font-medium">Jam mulai</th>
              <th className="px-2 py-2 text-center font-medium">Jam selesai</th>
              <th className="px-2 py-2 text-center font-medium">Kelengkapan</th>
              <th className="w-px whitespace-nowrap px-2 py-2 text-center font-medium">
                Hapus Kelas
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.flatMap((section) => [
              <tr
                key={`ke-${section.semesterKe ?? 'none'}`}
                className="border-b border-slate-200 bg-slate-50"
              >
                <td
                  colSpan={9}
                  className="px-2 py-2 text-left text-sm font-semibold text-slate-700"
                >
                  {section.label} ({section.rows.length})
                </td>
              </tr>,
              ...section.rows.map((snapshot) => {
                const existing = kelasBySnapshot.get(snapshot.id)
                const fields = fieldsFor(snapshot.id)
                const mark = kelengkapan(existing ?? null)
                const jamSelesaiMenit =
                  fields.jamMulai == null
                    ? null
                    : existing?.jamSelesai != null && edits[snapshot.id] == null
                      ? existing.jamSelesai
                      : waktuSks != null
                        ? jamSelesaiDariMulai({
                            jamMulai: fields.jamMulai,
                            sks: snapshot.sks,
                            menit: waktuSks.menit,
                            potonganSoreAktif: waktuSks.potonganSoreAktif,
                            jenisKelas
                          })
                        : (existing?.jamSelesai ?? null)
                const bentrokMarks = joinedBentrok.bySnapshotMkId.get(snapshot.id) ?? []
                const bentrokSemesterKeMarks =
                  joinedBentrokSemesterKe.bySnapshotMkId.get(snapshot.id) ?? []
                const jamDiLuarJenis = jamMulaiOutsideJenisWindow(jenisKelas, fields.jamMulai)
                return (
                  <tr
                    key={snapshot.id}
                    ref={(node) => {
                      if (node) {
                        rowRefs.current.set(snapshot.id, node)
                      } else {
                        rowRefs.current.delete(snapshot.id)
                      }
                    }}
                    className={[
                      'border-b border-slate-100',
                      highlightId === snapshot.id ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''
                    ].join(' ')}
                  >
                    <td className="px-2 py-2">{snapshot.kode}</td>
                    <td className="px-2 py-2">{snapshot.nama}</td>
                    <td className="px-2 py-2">{snapshot.sks}</td>
                    <td className="px-2 py-2">
                      <DosenPicker
                        dosen={dosen}
                        value={fields.dosenId}
                        onChange={(dosenId) => save(snapshot, { ...fields, dosenId })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="rounded border border-slate-300 pl-3 pr-9 py-1.5"
                        aria-label="Hari"
                        value={fields.hari ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          save(snapshot, {
                            ...fields,
                            hari: value === '' ? null : Number(value)
                          })
                        }}
                      >
                        <option value=""></option>
                        {HARI_VALUES.map((hari) => (
                          <option key={hari} value={hari}>
                            {hariLabel(hari)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="time"
                        className={[
                          'rounded border px-3 py-1.5',
                          jamDiLuarJenis ? 'border-red-500' : 'border-slate-300'
                        ].join(' ')}
                        aria-label="Jam mulai"
                        aria-invalid={jamDiLuarJenis}
                        value={fields.jamMulai == null ? '' : formatJam(fields.jamMulai)}
                        onChange={(event) =>
                          save(snapshot, { ...fields, jamMulai: parseJam(event.target.value) })
                        }
                        onFocus={() => {
                          if (fields.jamMulai == null) {
                            save(snapshot, {
                              ...fields,
                              jamMulai: jamMulaiDefault(jenisKelas)
                            })
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {jamSelesaiMenit == null ? '' : formatJam(jamSelesaiMenit)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <span>{kelengkapanMark(mark)}</span>
                        {bentrokMarks.map((label) => (
                          <span
                            key={`dosen:${label}`}
                            className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            title={label}
                          >
                            Bentrok: {label}
                          </span>
                        ))}
                        {bentrokSemesterKeMarks.map((label) => (
                          <span
                            key={`semester-ke:${label}`}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                            title={label}
                          >
                            Bentrok Semester ke: {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="w-px whitespace-nowrap px-2 py-2">
                      {existing ? (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            className={actionDangerBtn}
                            onClick={() => setPending(snapshot)}
                          >
                            Hapus
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            ])}
          </tbody>
        </table>
      )}
      {pending ? (
        <Dialog
          title="Hapus Kelas"
          footer={
            <>
              <button type="button" className={secondaryBtn} onClick={() => setPending(null)}>
                Batal
              </button>
              <button
                type="button"
                className={dangerBtn}
                onClick={() => {
                  const snapshot = pending
                  setPending(null)
                  const previous = saveChain.current[snapshot.id] ?? Promise.resolve()
                  saveChain.current[snapshot.id] = previous.then(async () => {
                    const row = kelasRef.current.find((item) => item.snapshotMkId === snapshot.id)
                    if (row == null) {
                      return
                    }
                    try {
                      await window.api.deleteKelas(row.id)
                      kelasRef.current = kelasRef.current.filter((item) => item.id !== row.id)
                      setKelas(kelasRef.current)
                      setEdits((current) => {
                        const rest = { ...current }
                        delete rest[snapshot.id]
                        return rest
                      })
                      setError(null)
                      refreshBentrok()
                    } catch (cause) {
                      setError(errorMessage(cause))
                    }
                  })
                }}
              >
                Hapus
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            Hapus Kelas {pending.kode} — {pending.nama}?
          </p>
        </Dialog>
      ) : null}
    </div>
  )
}

function DosenPicker({
  dosen,
  value,
  onChange
}: {
  dosen: Dosen[]
  value: number | null
  onChange: (id: number | null) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = dosen.find((row) => row.id === value)
  const visible = filterDosen(dosen, query)
  return (
    <div className="relative min-w-40">
      <input
        className="w-full rounded border border-slate-300 px-3 py-1.5"
        aria-label="Dosen"
        placeholder="Filter Dosen"
        value={open ? query : selected ? dosenNamaLengkap(selected) : ''}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(event) => {
          setOpen(true)
          setQuery(event.target.value)
        }}
        onBlur={() => setOpen(false)}
      />
      {open ? (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded border border-slate-200 bg-white shadow">
          <li>
            <button
              type="button"
              className="w-full px-2 py-1 text-left hover:bg-slate-100"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              Kosong
            </button>
          </li>
          {visible.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full px-2 py-1 text-left hover:bg-slate-100"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(row.id)
                  setOpen(false)
                }}
              >
                {dosenNamaLengkap(row)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
