# Guestbook BNI WondrX 2025

Aplikasi guestbook interaktif dengan filter sensor otomatis (censorship) dan dashboard manajemen admin untuk event BNI WondrX 2025.

## Fitur

- **Form Guestbook**: Formulir pengisian nama, komentar, dan pemilihan karakter avatar.
- **Sensor Otomatis (Smart Censorship)**: Menyaring kata-kata kotor, isu SARA, serta nama kompetitor secara otomatis dengan tanda bintang (`***`) menggunakan regex pencocokan karakter leet-speak & variasi penulisan.
- **Dashboard Admin**: Mengelola pesan pengunjung, mengedit komentar, menghapus komentar, dan mengosongkan seluruh data.
- **Export Excel**: Rekap data pengunjung langsung ke format `.xlsx` (Excel).

## Cara Menjalankan

1. Instal library pendukung:
   ```bash
   npm install
   ```

2. Konfigurasi file `.env` di root project dengan Firebase credentials Anda.

3. Jalankan server lokal:
   ```bash
   npm start
   ```

4. Akses melalui browser:
   - Form Guestbook: `http://localhost:3003`
   - Dashboard Admin: `http://localhost:3003/dashboard`
