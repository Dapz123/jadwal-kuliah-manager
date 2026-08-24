# Jadwal Kuliah Manager

Aplikasi desktop (Electron) untuk **Staff Fakultas** membangun jadwal perkuliahan secara **offline**, lalu mengekspor XLSX/PDF siap sebar ke mahasiswa.

Dibuat sesederhana mungkin karena waktu pengerjaan terbatas.

## Apa yang dibangun (MVP)

1. Master data — Program Studi, Mata Kuliah, Dosen, Kurikulum, Waktu SKS
2. Jadwal + Kelas — satu Jadwal = Prodi × Tahun Akademik × Semester × Jenis Kelas (`Reguler Pagi` \| `Reguler Sore`)
3. Export — satu dokumen per Jadwal

Deteksi **Bentrok** dosen (peringatan) dan MK yang belum lengkap (missing / incomplete Kelas).

## Platform

- Target utama: **Windows** (portable `.exe`)
- Dev lokal: **Linux**
- UI: sidebar — Master Data, Jadwal, Export

## Menjalankan

```bash
npm install
npm run dev
```

Paket Windows portable (mungkin memerlukan lingkungan Windows atau cross-build):

```bash
npm run dist
```

CI: **Actions → Build Windows portable → Run workflow**. Artifact `windows-portable-<sha>` (unsigned `.exe`, simpan 14 hari).

## Dokumentasi

| Dokumen                                    | Isi                              |
| ------------------------------------------ | -------------------------------- |
| [CONTEXT.md](CONTEXT.md)                   | Bahasa domain (glossary)         |
| [docs/concept/APP.md](docs/concept/APP.md) | Konsep sistem, flow, aturan MVP  |
| [docs/adr/](docs/adr/)                     | Keputusan arsitektur / trade-off |
