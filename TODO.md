# Terminal MCP (HeLa Nucleus) — Optimization & Hardening Tracker

## Status: COMPLETED (All Phases 1–5 Verified)

- [x] **Phase 1: Keandalan Eksekusi & Pembersihan Linting**
  - [x] Perbaiki ESLint error (`prefer-const` pada `src/executor.ts:330`).
  - [x] Bersihkan variabel & import tidak terpakai (`execSync` di `index.ts`, `sessionKey`, `output` di `executor.ts`).
  - [x] Pasang `maxBuffer: this.config.maxOutputSize` pada `child_process.exec()` di `executeLocally`.
  - [x] Sinkronkan metadata server (`name: "terminal-mcp-server"`, `version: "1.2.0"`) di `src/index.ts` dan `src/envelope.ts`.

- [x] **Phase 2: Keamanan & Penyempurnaan Path**
  - [x] Perbaiki regex `DANGEROUS_PATTERNS` untuk `rm`, `chmod`, `chown` agar tidak salah sasaran memblokir path absolut aman (seperti `/tmp/`).
  - [x] Sempurnakan validasi path traversal pada `transferFile` dan `copyFileLocal` (deteksi segmen path `..`, bukan sekadar substring).

- [x] **Phase 3: Persistensi Direktori Sesi & Utilitas Shell**
  - [x] Tambahkan penanganan perintah `cd` dan `pwd` pada sesi lokal untuk memperbarui `sessionData.workingDirectory`.
  - [x] Kembalikan `workingDirectory` aktual dari sesi ke dalam respon JSON perkakas di `src/index.ts`.
  - [x] Tambahkan pemisah opsi `--` pada perintah `terminal_grep` dan `terminal_ls` agar pola yang diawali `-` tidak memicu galat.
  - [x] Tambahkan validasi path pada `terminal_cat` untuk mencegah hang stdin jika path kosong.

- [x] **Phase 4: Optimalisasi RTK & Ketahanan SSH**
  - [x] Simpan `cachedRtkBinary = null` saat binary RTK tidak ditemukan untuk mencegah spawn gagal berulang.
  - [x] Tambahkan fallback pencarian kunci SSH (`id_ed25519`, `id_rsa`, `id_ecdsa`) pada `src/executor.ts`.

- [x] **Phase 5: Pengujian Otomatis & Verifikasi Menyeluruh**
  - [x] Buat unit test komprehensif di `test/executor.test.mjs` (eksekusi lokal, batas buffer, persistensi sesi `cd`, validasi keamanan, dan utilitas shell).
  - [x] Jalankan `npm run lint` (0 error) dan `npm test` (22/22 passed) di `terminal-mcp`.
  - [x] Verifikasi ekosistem di `hela-mcp-ecosystem`: `npm test`, `npm run test:matrix`, `./setup.sh doctor`.
