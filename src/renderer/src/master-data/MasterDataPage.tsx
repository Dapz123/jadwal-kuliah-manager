import { useEffect, useRef, useState, type JSX, type Ref } from 'react'
import type {
  Dosen,
  Jadwal,
  Kurikulum,
  KurikulumMapping,
  MataKuliah,
  ProgramStudi,
  Semester
} from '../../../shared/api'
import { semesterKeChoices, semesterKeParityOk, semesterKeRoman } from '../../../shared/semester-ke'
import { isApiError } from '../../../shared/api-error'
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
import {
  dosenNamaLengkap,
  dosenSubmitEnabled,
  filterByVisibleText,
  kurikulumSubmitEnabled,
  mappingSubmitEnabled,
  mataKuliahSubmitEnabled,
  programStudiSubmitEnabled,
  groupKurikulumMappings,
  kurikulumMkTotals,
  sortKurikulumMappings,
  unmappedMataKuliah
} from './catalog'

function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan'
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function loadRows<T>(
  loader: () => Promise<T[]>,
  setRows: (rows: T[]) => void,
  setError: (message: string | null) => void
): void {
  void loader().then(
    (value) => {
      setRows(value)
      setError(null)
    },
    (error: unknown) => {
      setError(errorMessage(error))
    }
  )
}

function Field({
  label,
  value,
  onChange,
  inputRef,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  type?: string
}): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        ref={inputRef}
        type={type}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ConfirmDelete({
  title,
  description,
  onCancel,
  onConfirm
}: {
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element {
  return (
    <Dialog
      title={title}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onCancel}>
            Batal
          </button>
          <button type="button" className={dangerBtn} onClick={onConfirm}>
            Hapus
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">{description}</p>
    </Dialog>
  )
}

function ProgramStudiTab(): JSX.Element {
  const [rows, setRows] = useState<ProgramStudi[]>([])
  const [filter, setFilter] = useState('')
  const [listError, setListError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProgramStudi | null | 'create'>(null)
  const [pending, setPending] = useState<ProgramStudi | null>(null)

  function refresh(): void {
    loadRows(() => window.api.listProgramStudi(), setRows, setListError)
  }

  useEffect(() => {
    loadRows(() => window.api.listProgramStudi(), setRows, setListError)
  }, [])

  const visible = filterByVisibleText(rows, filter, (row) => [row.kode, row.nama])

  return (
    <PageShell
      title="Program Studi"
      description="Identitas prodi. Memiliki Kurikulum dan Jadwal."
      action={
        <button type="button" className={primaryBtn} onClick={() => setEditing('create')}>
          Tambah
        </button>
      }
    >
      <CatalogList
        entity="Program Studi"
        filter={filter}
        onFilter={setFilter}
        onAdd={() => setEditing('create')}
        listError={listError}
        catalogEmpty={rows.length === 0 && !listError}
        rows={visible}
        title={(row) => row.kode}
        sublabel={(row) => row.nama}
        onEdit={setEditing}
        onDelete={setPending}
      />
      {editing !== null ? (
        <ProgramStudiForm
          initial={editing === 'create' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      {pending ? (
        <ConfirmDelete
          title="Hapus Program Studi"
          description={`Hapus Program Studi ${pending.kode} — ${pending.nama}?`}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const row = pending
            setPending(null)
            void window.api.deleteProgramStudi(row.id).then(refresh, (error) => {
              setListError(errorMessage(error))
            })
          }}
        />
      ) : null}
    </PageShell>
  )
}

function ProgramStudiForm({
  initial,
  onClose,
  onSaved
}: {
  initial: ProgramStudi | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const firstField = useRef<HTMLInputElement>(null)
  const [kode, setKode] = useState(initial?.kode ?? '')
  const [nama, setNama] = useState(initial?.nama ?? '')
  const [error, setError] = useState<string | null>(null)
  const canSubmit = programStudiSubmitEnabled({ kode, nama })

  async function save(stayOpen: boolean): Promise<void> {
    setError(null)
    const input = { kode: kode.trim(), nama: nama.trim() }
    try {
      if (initial) {
        await window.api.updateProgramStudi(initial.id, input)
      } else {
        await window.api.createProgramStudi(input)
      }
      onSaved()
      if (stayOpen) {
        setKode('')
        setNama('')
        firstField.current?.focus()
      } else {
        onClose()
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog
      title={initial ? 'Ubah Program Studi' : 'Tambah Program Studi'}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          {!initial ? (
            <button
              type="button"
              className={saveBtn}
              disabled={!canSubmit}
              onClick={() => void save(true)}
            >
              Simpan dan tambah lagi
            </button>
          ) : null}
          <button
            type="button"
            className={saveBtn}
            disabled={!canSubmit}
            onClick={() => void save(false)}
          >
            Simpan
          </button>
        </>
      }
    >
      {error ? <Banner message={error} /> : null}
      <Field label="Kode" value={kode} onChange={setKode} inputRef={firstField} />
      <Field label="Nama" value={nama} onChange={setNama} />
    </Dialog>
  )
}

function MataKuliahTab(): JSX.Element {
  const [rows, setRows] = useState<MataKuliah[]>([])
  const [filter, setFilter] = useState('')
  const [listError, setListError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MataKuliah | null | 'create'>(null)
  const [pending, setPending] = useState<MataKuliah | null>(null)

  function refresh(): void {
    loadRows(() => window.api.listMataKuliah(), setRows, setListError)
  }

  useEffect(() => {
    loadRows(() => window.api.listMataKuliah(), setRows, setListError)
  }, [])

  const visible = filterByVisibleText(rows, filter, (row) => [row.kode, row.nama, row.sks])

  return (
    <PageShell
      title="Mata Kuliah"
      description="Katalog fakultas. Kode unik di seluruh install."
      action={
        <button type="button" className={primaryBtn} onClick={() => setEditing('create')}>
          Tambah
        </button>
      }
    >
      <CatalogList
        entity="Mata Kuliah"
        filter={filter}
        onFilter={setFilter}
        onAdd={() => setEditing('create')}
        listError={listError}
        catalogEmpty={rows.length === 0 && !listError}
        rows={visible}
        title={(row) => row.kode}
        sublabel={(row) => row.nama}
        meta={(row) => (
          <p className="text-sm text-slate-500">{row.sks} SKS</p>
        )}
        onEdit={setEditing}
        onDelete={setPending}
      />
      {editing !== null ? (
        <MataKuliahForm
          initial={editing === 'create' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      {pending ? (
        <ConfirmDelete
          title="Hapus Mata Kuliah"
          description={`Hapus Mata Kuliah ${pending.kode} — ${pending.nama}?`}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const row = pending
            setPending(null)
            void window.api.deleteMataKuliah(row.id).then(refresh, (error) => {
              setListError(errorMessage(error))
            })
          }}
        />
      ) : null}
    </PageShell>
  )
}

function MataKuliahForm({
  initial,
  onClose,
  onSaved
}: {
  initial: MataKuliah | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const firstField = useRef<HTMLInputElement>(null)
  const [kode, setKode] = useState(initial?.kode ?? '')
  const [nama, setNama] = useState(initial?.nama ?? '')
  const [sks, setSks] = useState(initial ? String(initial.sks) : '')
  const [error, setError] = useState<string | null>(null)
  const canSubmit = mataKuliahSubmitEnabled({ kode, nama, sks })

  async function save(stayOpen: boolean): Promise<void> {
    setError(null)
    const input = { kode: kode.trim(), nama: nama.trim(), sks: Number(sks) }
    try {
      if (initial) {
        await window.api.updateMataKuliah(initial.id, input)
      } else {
        await window.api.createMataKuliah(input)
      }
      onSaved()
      if (stayOpen) {
        setKode('')
        setNama('')
        setSks('')
        firstField.current?.focus()
      } else {
        onClose()
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog
      title={initial ? 'Ubah Mata Kuliah' : 'Tambah Mata Kuliah'}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          {!initial ? (
            <button
              type="button"
              className={saveBtn}
              disabled={!canSubmit}
              onClick={() => void save(true)}
            >
              Simpan dan tambah lagi
            </button>
          ) : null}
          <button
            type="button"
            className={saveBtn}
            disabled={!canSubmit}
            onClick={() => void save(false)}
          >
            Simpan
          </button>
        </>
      }
    >
      {error ? <Banner message={error} /> : null}
      <Field label="Kode" value={kode} onChange={setKode} inputRef={firstField} />
      <Field label="Nama" value={nama} onChange={setNama} />
      <Field label="SKS" value={sks} onChange={setSks} type="number" />
    </Dialog>
  )
}

function DosenTab(): JSX.Element {
  const [rows, setRows] = useState<Dosen[]>([])
  const [filter, setFilter] = useState('')
  const [listError, setListError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Dosen | null | 'create'>(null)
  const [pending, setPending] = useState<Dosen | null>(null)

  function refresh(): void {
    loadRows(() => window.api.listDosen(), setRows, setListError)
  }

  useEffect(() => {
    loadRows(() => window.api.listDosen(), setRows, setListError)
  }, [])

  const visible = filterByVisibleText(rows, filter, (row) => [
    dosenNamaLengkap(row),
    row.nidn,
    row.nuptk
  ])

  return (
    <PageShell
      title="Dosen"
      description="Nama lengkap plus NIDN dan/atau NUPTK."
      action={
        <button type="button" className={primaryBtn} onClick={() => setEditing('create')}>
          Tambah
        </button>
      }
    >
      <CatalogList
        entity="Dosen"
        filter={filter}
        onFilter={setFilter}
        onAdd={() => setEditing('create')}
        listError={listError}
        catalogEmpty={rows.length === 0 && !listError}
        rows={visible}
        title={dosenNamaLengkap}
        sublabel={(row) => [row.nidn, row.nuptk].filter(Boolean).join(' · ')}
        onEdit={setEditing}
        onDelete={setPending}
      />
      {editing !== null ? (
        <DosenForm
          initial={editing === 'create' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      {pending ? (
        <ConfirmDelete
          title="Hapus Dosen"
          description={`Hapus Dosen ${dosenNamaLengkap(pending)}?`}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const row = pending
            setPending(null)
            void window.api.deleteDosen(row.id).then(refresh, (error) => {
              setListError(errorMessage(error))
            })
          }}
        />
      ) : null}
    </PageShell>
  )
}

function DosenForm({
  initial,
  onClose,
  onSaved
}: {
  initial: Dosen | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const firstField = useRef<HTMLInputElement>(null)
  const [nama, setNama] = useState(initial?.nama ?? '')
  const [gelarDepan, setGelarDepan] = useState(initial?.gelarDepan ?? '')
  const [gelarBelakang, setGelarBelakang] = useState(initial?.gelarBelakang ?? '')
  const [nidn, setNidn] = useState(initial?.nidn ?? '')
  const [nuptk, setNuptk] = useState(initial?.nuptk ?? '')
  const [error, setError] = useState<string | null>(null)
  const canSubmit = dosenSubmitEnabled({ nama, nidn, nuptk })

  async function save(stayOpen: boolean): Promise<void> {
    setError(null)
    const input = {
      nama: nama.trim(),
      gelarDepan: emptyToNull(gelarDepan),
      gelarBelakang: emptyToNull(gelarBelakang),
      nidn: emptyToNull(nidn),
      nuptk: emptyToNull(nuptk)
    }
    try {
      if (initial) {
        await window.api.updateDosen(initial.id, input)
      } else {
        await window.api.createDosen(input)
      }
      onSaved()
      if (stayOpen) {
        setNama('')
        setGelarDepan('')
        setGelarBelakang('')
        setNidn('')
        setNuptk('')
        firstField.current?.focus()
      } else {
        onClose()
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog
      title={initial ? 'Ubah Dosen' : 'Tambah Dosen'}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          {!initial ? (
            <button
              type="button"
              className={saveBtn}
              disabled={!canSubmit}
              onClick={() => void save(true)}
            >
              Simpan dan tambah lagi
            </button>
          ) : null}
          <button
            type="button"
            className={saveBtn}
            disabled={!canSubmit}
            onClick={() => void save(false)}
          >
            Simpan
          </button>
        </>
      }
    >
      {error ? <Banner message={error} /> : null}
      <Field label="Nama" value={nama} onChange={setNama} inputRef={firstField} />
      <Field label="Gelar depan" value={gelarDepan} onChange={setGelarDepan} />
      <Field label="Gelar belakang" value={gelarBelakang} onChange={setGelarBelakang} />
      <Field label="NIDN" value={nidn} onChange={setNidn} />
      <Field label="NUPTK" value={nuptk} onChange={setNuptk} />
    </Dialog>
  )
}

function WaktuSksTab(): JSX.Element {
  const [menit, setMenit] = useState('')
  const [potonganSoreAktif, setPotonganSoreAktif] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getWaktuSks().then(
      (value) => {
        setMenit(String(value.menit))
        setPotonganSoreAktif(value.potonganSoreAktif)
        setError(null)
      },
      (cause) => setError(errorMessage(cause))
    )
  }, [])

  async function save(): Promise<void> {
    try {
      await window.api.updateWaktuSks({
        menit: Number(menit),
        potonganSoreAktif
      })
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <PageShell
      title="Waktu SKS"
      description="Menit per 1 SKS, berlaku untuk seluruh install."
    >
      <div className="max-w-md space-y-3">
        {error ? <Banner message={error} /> : null}
        <Field label="Menit per SKS" value={menit} onChange={setMenit} type="number" />
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={potonganSoreAktif}
            onChange={(event) => setPotonganSoreAktif(event.target.checked)}
          />
          <span>
            Potongan Sore: potong 10 menit per SKS untuk Reguler Sore (default aktif).
          </span>
        </label>
        <p className="text-sm text-slate-600">
          Mengubah Waktu SKS atau Potongan Sore mengubah jam selesai Kelas yang terdampak.
        </p>
        <button type="button" className={saveBtn} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </PageShell>
  )
}

function KurikulumForm({
  initial,
  programStudi,
  programStudiId,
  onClose,
  onSaved
}: {
  initial: Kurikulum | null
  programStudi: ProgramStudi[]
  programStudiId: number | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const firstField = useRef<HTMLInputElement>(null)
  const [nama, setNama] = useState(initial?.nama ?? '')
  const [prodiId, setProdiId] = useState<number | ''>(
    initial?.programStudiId ?? programStudiId ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const canSubmit = kurikulumSubmitEnabled({ nama }) && prodiId !== ''

  async function save(stayOpen: boolean): Promise<void> {
    if (prodiId === '') {
      return
    }
    setError(null)
    const input = { programStudiId: prodiId, nama: nama.trim() }
    try {
      if (initial) {
        await window.api.updateKurikulum(initial.id, input)
      } else {
        await window.api.createKurikulum(input)
      }
      onSaved()
      if (stayOpen) {
        setNama('')
        firstField.current?.focus()
      } else {
        onClose()
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog
      title={initial ? 'Ubah Kurikulum' : 'Tambah Kurikulum'}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          {!initial ? (
            <button
              type="button"
              className={saveBtn}
              disabled={!canSubmit}
              onClick={() => void save(true)}
            >
              Simpan dan tambah lagi
            </button>
          ) : null}
          <button
            type="button"
            className={saveBtn}
            disabled={!canSubmit}
            onClick={() => void save(false)}
          >
            Simpan
          </button>
        </>
      }
    >
      {error ? <Banner message={error} /> : null}
      {initial ? null : (
        <label className="block text-sm">
          <span className="text-slate-700">Program Studi</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5"
            aria-label="Program Studi"
            value={prodiId}
            onChange={(event) => {
              const value = event.target.value
              setProdiId(value === '' ? '' : Number(value))
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
      )}
      <Field label="Nama" value={nama} onChange={setNama} inputRef={firstField} />
    </Dialog>
  )
}

function MappingForm({
  kurikulumId,
  catalog,
  mappings,
  mapping,
  mappingLabel,
  onClose,
  onSaved
}: {
  kurikulumId: number
  catalog: MataKuliah[]
  mappings: KurikulumMapping[]
  mapping: KurikulumMapping | null
  mappingLabel: string
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [pickerFilter, setPickerFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    mapping == null ? [] : [mapping.mataKuliahId]
  )
  const [semester, setSemester] = useState<'' | Semester>(mapping?.semester ?? '')
  const [semesterKe, setSemesterKe] = useState<number | null>(mapping?.semesterKe ?? null)
  const [error, setError] = useState<string | null>(null)
  const editing = mapping != null
  const pickerRows = unmappedMataKuliah(catalog, mappings, semester, semesterKe)
  const visible = filterByVisibleText(pickerRows, pickerFilter, (row) => [
    row.kode,
    row.nama,
    row.sks
  ])
  const canSubmit = mappingSubmitEnabled({
    selectedCount: selectedIds.length,
    semester
  })

  function toggleId(id: number): void {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  function dropUnavailable(nextSemester: Semester, nextKe: number | null): void {
    const allowed = new Set(
      unmappedMataKuliah(catalog, mappings, nextSemester, nextKe).map((row) => row.id)
    )
    setSelectedIds((current) => current.filter((id) => allowed.has(id)))
  }

  function changeSemester(next: Semester): void {
    const nextKe = semesterKe != null && !semesterKeParityOk(next, semesterKe) ? null : semesterKe
    setSemester(next)
    if (nextKe !== semesterKe) {
      setSemesterKe(null)
    }
    dropUnavailable(next, nextKe)
  }

  function changeSemesterKe(next: number | null): void {
    setSemesterKe(next)
    if (semester === 'Ganjil' || semester === 'Genap') {
      dropUnavailable(semester, next)
    }
  }

  async function save(): Promise<void> {
    if (semester === '') {
      return
    }
    setError(null)
    try {
      if (editing) {
        await window.api.updateKurikulumMapping(mapping.id, { semester, semesterKe })
      } else {
        await window.api.addKurikulumMappings(
          selectedIds.map((mataKuliahId) => ({
            kurikulumId,
            mataKuliahId,
            semester,
            semesterKe
          }))
        )
      }
      onSaved()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const keChoices = semester === '' ? [] : semesterKeChoices(semester)

  return (
    <Dialog
      title={editing ? 'Ubah Pemetaan' : 'Tambah Mata Kuliah'}
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
      {editing ? (
        <p className="text-sm text-slate-800">{mappingLabel}</p>
      ) : (
        <div className="space-y-2">
          <input
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Pencarian Mata Kuliah"
            value={pickerFilter}
            onChange={(event) => setPickerFilter(event.target.value)}
            aria-label="Pencarian Mata Kuliah"
          />
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
            {visible.map((row) => {
              const checked = selectedIds.includes(row.id)
              return (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-center gap-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(row.id)}
                    />
                    <span className="min-w-0 flex-1 text-slate-800">
                      {row.kode} — {row.nama}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">{row.sks} SKS</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <label className="block text-sm">
        <span className="text-slate-700">Semester</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5 text-sm"
          aria-label="Semester"
          value={semester}
          onChange={(event) => {
            const value = event.target.value
            if (value === 'Ganjil' || value === 'Genap') {
              changeSemester(value)
            }
          }}
        >
          <option value="">Pilih Semester</option>
          <option value="Ganjil">Ganjil</option>
          <option value="Genap">Genap</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Semester ke</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5 text-sm"
          aria-label="Semester ke"
          value={semesterKe ?? ''}
          disabled={semester === ''}
          onChange={(event) => {
            const value = event.target.value
            changeSemesterKe(value === '' ? null : Number(value))
          }}
        >
          <option value="">—</option>
          {keChoices.map((value) => (
            <option key={value} value={value}>
              {semesterKeRoman(value)}
            </option>
          ))}
        </select>
      </label>
    </Dialog>
  )
}

function MkTotalCard({
  label,
  mk,
  sks
}: {
  label: string
  mk: number
  sks: number
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {mk}
        <span className="ml-1 text-sm font-normal text-slate-500">MK</span>
      </p>
      <p className="text-sm tabular-nums text-slate-600">
        {sks}
        <span className="ml-1">SKS</span>
      </p>
    </div>
  )
}

function MappingColumn({
  title,
  total,
  keTotals,
  tanpaKe,
  mappings,
  label,
  sks,
  onEdit,
  onRemove
}: {
  title: string
  total: { mk: number; sks: number }
  keTotals: { ke: number; mk: number; sks: number }[]
  tanpaKe: { mk: number; sks: number }
  mappings: KurikulumMapping[]
  label: (mapping: KurikulumMapping) => string
  sks: (mapping: KurikulumMapping) => number
  onEdit: (mapping: KurikulumMapping) => void
  onRemove: (mapping: KurikulumMapping) => void
}): JSX.Element {
  return (
    <section
      className={[
        'overflow-hidden rounded-lg border border-slate-200 border-l-4',
        title === 'Ganjil' ? 'border-l-accent' : 'border-l-slate-400'
      ].join(' ')}
    >
      <header className="flex items-baseline justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
        <p className="tabular-nums text-slate-600">
          <span className="text-xl font-semibold text-slate-900">{total.mk}</span>
          <span className="ml-1 text-sm">MK</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="text-xl font-semibold text-slate-900">{total.sks}</span>
          <span className="ml-1 text-sm">SKS</span>
        </p>
      </header>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {keTotals.map((row) => (
            <MkTotalCard key={row.ke} label={semesterKeRoman(row.ke)} mk={row.mk} sks={row.sks} />
          ))}
          {tanpaKe.mk > 0 ? <MkTotalCard label="—" mk={tanpaKe.mk} sks={tanpaKe.sks} /> : null}
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="w-14 px-2 py-1.5 text-left font-medium">Ke</th>
              <th className="px-2 py-1.5 text-left font-medium">Mata Kuliah</th>
              <th className="w-16 px-2 py-1.5 text-right font-medium">SKS</th>
              <th className="w-px whitespace-nowrap px-2 py-1.5 font-medium">
                <span className="sr-only">Hapus</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groupKurikulumMappings(mappings).flatMap((group) =>
              group.rows.map((mapping, index) => (
                <tr key={mapping.id} className="border-b border-slate-100">
                  {index === 0 ? (
                    <td
                      rowSpan={group.rows.length}
                      className="border-r border-slate-100 px-2 py-2 align-middle text-center text-sm font-semibold text-slate-700"
                    >
                      {semesterKeRoman(group.semesterKe) || '—'}
                    </td>
                  ) : null}
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="block w-full truncate text-left text-slate-800 hover:text-accent"
                      onClick={() => onEdit(mapping)}
                    >
                      {label(mapping)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                    {sks(mapping)}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className={actionDangerBtn}
                      onClick={() => onRemove(mapping)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const KURIKULUM_TABS = [
  { id: 'daftar' as const, label: 'Daftar' },
  { id: 'pemetaan' as const, label: 'Pemetaan' }
]

function KurikulumTab(): JSX.Element {
  const [tab, setTab] = useState<'daftar' | 'pemetaan'>('daftar')
  const [programStudiId, setProgramStudiId] = useState<number | null>(null)
  const [kurikulumId, setKurikulumId] = useState<number | null>(null)
  const [prodi, setProdi] = useState<ProgramStudi[] | null>(null)
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([])
  const [mataKuliah, setMataKuliah] = useState<MataKuliah[] | null>(null)
  const [mappings, setMappings] = useState<KurikulumMapping[]>([])
  const [jadwalForProdi, setJadwalForProdi] = useState<Jadwal[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Kurikulum | null | 'create'>(null)
  const [pending, setPending] = useState<Kurikulum | null>(null)
  const [mappingForm, setMappingForm] = useState<KurikulumMapping | 'create' | null>(null)

  function refreshKurikulum(): void {
    const rows = prodi ?? []
    void Promise.all(rows.map((row) => window.api.listKurikulum(row.id))).then(
      (lists) => {
        setKurikulum(lists.flat())
        setError(null)
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }

  function refreshMappings(): void {
    if (kurikulumId == null) {
      return
    }
    loadRows(() => window.api.listKurikulumMappings(kurikulumId), setMappings, setError)
  }

  useEffect(() => {
    void Promise.all([window.api.listProgramStudi(), window.api.listMataKuliah()]).then(
      ([prodiRows, mkRows]) => {
        setProdi(prodiRows)
        setMataKuliah(mkRows)
        setError(null)
        void Promise.all(prodiRows.map((row) => window.api.listKurikulum(row.id))).then(
          (lists) => setKurikulum(lists.flat()),
          (cause: unknown) => setError(errorMessage(cause))
        )
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [])

  useEffect(() => {
    if (kurikulumId == null) {
      return
    }
    loadRows(() => window.api.listKurikulumMappings(kurikulumId), setMappings, setError)
  }, [kurikulumId])

  useEffect(() => {
    if (kurikulumId == null) {
      setJadwalForProdi([])
      return
    }
    const row = kurikulum.find((item) => item.id === kurikulumId)
    if (row == null) {
      setJadwalForProdi([])
      return
    }
    loadRows(() => window.api.listJadwal(row.programStudiId), setJadwalForProdi, setError)
  }, [kurikulumId, kurikulum])

  if (prodi == null) {
    return (
      <PageShell
        title="Kurikulum"
        description="Template MK per semester untuk satu Prodi. Bukan Jadwal."
      >
        {error ? <Banner message={error} /> : <></>}
      </PageShell>
    )
  }
  if (!error && prodi.length === 0) {
    return (
      <PageShell
        title="Kurikulum"
        description="Template MK per semester untuk satu Prodi. Bukan Jadwal."
      >
        <p className="text-slate-600">Buat Program Studi dulu</p>
      </PageShell>
    )
  }

  const catalog = mataKuliah ?? []
  const prodiById = new Map(prodi.map((row) => [row.id, row]))
  const prodiLabel = (id: number): string => {
    const row = prodiById.get(id)
    return row ? `${row.kode} — ${row.nama}` : ''
  }
  const kurikulumForView =
    programStudiId == null
      ? kurikulum
      : kurikulum.filter((row) => row.programStudiId === programStudiId)
  const selected = kurikulumId == null ? null : (kurikulum.find((row) => row.id === kurikulumId) ?? null)
  const mappingsForKurikulum =
    kurikulumId == null ? [] : mappings.filter((row) => row.kurikulumId === kurikulumId)
  const visible = filterByVisibleText(kurikulumForView, filter, (row) => [
    row.nama,
    prodiLabel(row.programStudiId)
  ])
  const unmapped = unmappedMataKuliah(catalog, mappingsForKurikulum)
  const mataKuliahById = new Map(catalog.map((row) => [row.id, row]))
  const mappingLabel = (mapping: KurikulumMapping): string => {
    const mk = mataKuliahById.get(mapping.mataKuliahId)
    return mk ? `${mk.kode} — ${mk.nama}` : String(mapping.mataKuliahId)
  }
  const kodeOf = (mataKuliahId: number): string => mataKuliahById.get(mataKuliahId)?.kode ?? ''
  const mappingSks = (mapping: KurikulumMapping): number =>
    mataKuliahById.get(mapping.mataKuliahId)?.sks ?? 0
  const mkTotals = kurikulumMkTotals(
    mappingsForKurikulum.map((row) => ({
      semester: row.semester,
      semesterKe: row.semesterKe,
      sks: mataKuliahById.get(row.mataKuliahId)?.sks ?? 0
    }))
  )

  function selectKurikulum(row: Kurikulum): void {
    setKurikulumId(row.id)
    setTab('pemetaan')
  }

  function removeMapping(mapping: KurikulumMapping): void {
    void window.api
      .removeKurikulumMapping(mapping.id)
      .then(refreshMappings, (cause: unknown) => setError(errorMessage(cause)))
  }

  return (
    <PageShell
      title="Kurikulum"
      description="Template MK per semester untuk satu Prodi. Bukan Jadwal."
      action={
        tab === 'daftar' ? (
          <button type="button" className={primaryBtn} onClick={() => setEditing('create')}>
            Tambah
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <PageTabs tabs={KURIKULUM_TABS} value={tab} onChange={setTab} />
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
                  setKurikulumId(null)
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
              entity="Kurikulum"
              filter={filter}
              onFilter={setFilter}
              onAdd={() => setEditing('create')}
              listError={null}
              catalogEmpty={kurikulumForView.length === 0 && !error}
              rows={visible}
              title={(row) => row.nama}
              sublabel={(row) => prodiLabel(row.programStudiId)}
              onEdit={setEditing}
              onDelete={setPending}
              selectedId={kurikulumId}
              onSelect={selectKurikulum}
            />
          </div>
        ) : selected == null ? (
          <p className="text-slate-600">Pilih Kurikulum dulu</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-slate-900">{selected.nama}</p>
              <p className="text-sm text-slate-500">{prodiLabel(selected.programStudiId)}</p>
            </div>
            {jadwalForProdi.some((row) => row.kurikulumId === selected.id) ? (
              <p className="text-sm text-slate-600">
                Jadwal yang sudah memakai Kurikulum ini tidak ikut berubah. MK baru hanya masuk jika
                Jadwal itu dihapus lalu dibuat ulang (Kelas ikut terhapus).
              </p>
            ) : null}
            {mataKuliah !== null && mataKuliah.length === 0 ? (
              <p className="text-slate-600">Buat Mata Kuliah dulu</p>
            ) : (
              <button
                type="button"
                className={primaryBtn}
                disabled={unmapped.length === 0}
                onClick={() => setMappingForm('create')}
              >
                Tambah
              </button>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <MappingColumn
                title="Ganjil"
                total={mkTotals.ganjil}
                keTotals={semesterKeChoices('Ganjil').map((ke) => ({
                  ke,
                  ...(mkTotals.ke[ke - 1] ?? { mk: 0, sks: 0 })
                }))}
                tanpaKe={mkTotals.tanpaKeGanjil}
                mappings={sortKurikulumMappings(
                  mappingsForKurikulum.filter((mapping) => mapping.semester === 'Ganjil'),
                  kodeOf
                )}
                label={mappingLabel}
                sks={mappingSks}
                onEdit={setMappingForm}
                onRemove={removeMapping}
              />
              <MappingColumn
                title="Genap"
                total={mkTotals.genap}
                keTotals={semesterKeChoices('Genap').map((ke) => ({
                  ke,
                  ...(mkTotals.ke[ke - 1] ?? { mk: 0, sks: 0 })
                }))}
                tanpaKe={mkTotals.tanpaKeGenap}
                mappings={sortKurikulumMappings(
                  mappingsForKurikulum.filter((mapping) => mapping.semester === 'Genap'),
                  kodeOf
                )}
                label={mappingLabel}
                sks={mappingSks}
                onEdit={setMappingForm}
                onRemove={removeMapping}
              />
            </div>
          </div>
        )}
        </div>
        {editing !== null ? (
          <KurikulumForm
            initial={editing === 'create' ? null : editing}
            programStudi={prodi}
            programStudiId={programStudiId}
            onClose={() => setEditing(null)}
            onSaved={refreshKurikulum}
          />
        ) : null}
        {mappingForm !== null && kurikulumId != null ? (
          <MappingForm
            kurikulumId={kurikulumId}
            catalog={catalog}
            mappings={mappingsForKurikulum}
            mapping={mappingForm === 'create' ? null : mappingForm}
            mappingLabel={mappingForm === 'create' ? '' : mappingLabel(mappingForm)}
            onClose={() => setMappingForm(null)}
            onSaved={refreshMappings}
          />
        ) : null}
        {pending ? (
          <ConfirmDelete
            title="Hapus Kurikulum"
            description={`Hapus Kurikulum ${pending.nama}?`}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              const row = pending
              setPending(null)
              void window.api.deleteKurikulum(row.id).then(
                () => {
                  if (kurikulumId === row.id) {
                    setKurikulumId(null)
                    setTab('daftar')
                  }
                  refreshKurikulum()
                },
                (cause: unknown) => setError(errorMessage(cause))
              )
            }}
          />
        ) : null}
      </div>
    </PageShell>
  )
}

export function ProgramStudiPage(): JSX.Element {
  return <ProgramStudiTab />
}

export function MataKuliahPage(): JSX.Element {
  return <MataKuliahTab />
}

export function DosenPage(): JSX.Element {
  return <DosenTab />
}

export function KurikulumPage(): JSX.Element {
  return <KurikulumTab />
}

export function WaktuSksPage(): JSX.Element {
  return <WaktuSksTab />
}
