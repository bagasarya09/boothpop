# Menambahkan template bingkai BOOTHPOP

Template bawaan disimpan sebagai file PNG di `public/frames/` dan didaftarkan di `public/frames/templates.json`. Tidak membutuhkan database atau server upload. Semua pengunjung bisa memilihnya setelah versi website terbaru dipublikasikan.

Tombol **Upload bingkai** di website hanya memakai gambar untuk sesi pengguna tersebut. Tombol itu tidak menambahkan template publik secara permanen.

## 1. Pilih layout yang sesuai

Setiap desain terhubung ke satu `layoutId`. Jumlah lubang, ukuran kanvas, dan posisi foto harus sesuai dengan layout tersebut. Kesamaan ukuran kanvas saja belum cukup: beberapa layout berbeda memiliki dimensi yang sama.

| layoutId | Nama di aplikasi | Jumlah foto | Lebar × tinggi PNG (px) |
| --- | --- | --- | --- |
| strip4 | Strip 4 foto | 4 | 720 × 2140 |
| strip3 | Strip 3 foto | 3 | 787 × 1800 |
| duo | Duo 2 foto | 2 | 1122 × 1800 |
| grid4 | Grid 4 foto | 4 | 1800 × 1513 |
| grid6 | Grid 6 foto | 6 | 1500 × 1800 |
| mini75 | Mini 3 | 3 | 713 × 2140 |
| strip9 | Strip 2 | 2 | 713 × 2140 |
| strip15 | Strip 3 persegi | 3 | 713 × 2140 |
| wide15 | Strip 3 landscape | 3 | 856 × 2140 |
| wide17 | Strip 4 landscape | 4 | 755 × 2140 |
| tall185 | Strip 3 portrait | 3 | 578 × 2140 |
| pol75 | Polaroid mini | 1 | 1427 × 2140 |
| pol9 | Polaroid portrait | 1 | 1427 × 2140 |
| pol10 | Polaroid 10 | 1 | 1498 × 2140 |
| pol8 | Polaroid 8 | 1 | 1873 × 2140 |
| pol11 | Polaroid landscape | 1 | 2140 × 1751 |

Ukuran aktual di aplikasi menjadi acuan jika geometri layout diperbarui. Spider Strip yang sudah ada memakai `pol11`, bukan `strip15`.

## 2. Siapkan gambar desain

1. Jalankan `npm run dev` dan buka alamat lokal yang muncul.
2. Pilih layout tujuan, kemudian ambil foto atau upload foto sesuai jumlah slot.
3. Lanjut ke **Hias dan unduh → Bingkai**.
4. Buka bagian **Bingkai buatan Anda**, lalu klik **Unduh template bingkai** dan **Unduh panduan posisi foto**.
5. Buka PNG template di editor gambar yang mendukung transparansi. Gunakan panduan posisi sebagai layer referensi.
6. Tambahkan desain pada area bingkai. Pertahankan ukuran kanvas, posisi lubang, dan transparansi area foto. Area transparan bukan warna putih.
7. Sembunyikan/hapus layer panduan sebelum ekspor. Simpan sebagai **PNG transparan**, maksimal 10 MB.
8. Uji gambar lewat tombol **Upload bingkai** di aplikasi dan periksa semua foto. Pemeriksaan otomatis hanya memeriksa pusat setiap lubang; bagian lain bisa tetap tertutup jika desain tidak sesuai.

Untuk desain yang sudah dibuat, cocokkan dengan template unduhan sebelum mendaftarkannya. Jangan sekadar mengganti ukurannya jika posisi lubang berbeda.

## 3. Salin PNG ke proyek

Simpan gambar ke folder `public/frames/`, misalnya:

```text
public/frames/bunga-pink.png
```

Gunakan nama file dengan huruf, angka, tanda minus atau underscore, tanpa spasi. Akhiri dengan `.png`. Huruf besar/kecil nama file dan konfigurasi harus sama.

## 4. Daftarkan template

Buka `public/frames/templates.json`. Tambahkan satu object di dalam daftar. Contoh berikut mempertahankan Spider Strip dan menambahkan desain **contoh** Bunga Pink untuk Strip 4 foto:

```json
[
  {
    "id": "Spider_Strip",
    "name": "Spider Strip",
    "layoutId": "pol11",
    "src": "/frames/Spider_Strip.png"
  },
  {
    "id": "bunga-pink",
    "name": "Bunga Pink",
    "layoutId": "strip4",
    "src": "/frames/bunga-pink.png"
  }
]
```

**Bunga Pink hanya contoh konfigurasi; file gambarnya belum disediakan.** Tambahkan entri tersebut hanya setelah Anda menyiapkan PNG yang sesuai.

- `id`: kode unik template; jangan sama dengan template lain.
- `name`: nama yang dilihat pengguna.
- `layoutId`: salin dari tabel di atas sesuai desain Anda.
- `src`: lokasi gambar dari `/frames/`, tanpa awalan `public`.

Gunakan tanda kutip ganda. Pisahkan object dengan koma, tetapi jangan tambahkan koma setelah object terakhir. Urutan entri menjadi urutan kartu di aplikasi. Anda bisa menambahkan banyak desain untuk layout yang sama.

## 5. Periksa dan coba

Jalankan dari terminal pada folder proyek:

```sh
npm run check:frames
npm run build
npm test
```

Jika PowerShell menolak `npm.ps1`, gunakan `npm.cmd` sebagai pengganti `npm` pada setiap perintah.

Pemeriksaan menampilkan nama desain dan layout jika berhasil. Build otomatis menjalankan pemeriksaan template dan berhenti jika ada template yang tidak valid.

Kemudian buka website lokal, pilih layout terkait, dan lanjutkan ke **Hias dan unduh → Bingkai**. Klik kartu desain, periksa preview, lalu unduh PNG untuk memastikan desain ikut tersimpan. Pilih **Bingkai polos** untuk melepas desain.

## 6. Publikasikan agar tersedia untuk semua pengunjung

Perubahan lokal belum muncul pada website publik. Sertakan file PNG baru, `templates.json`, dan perubahan proyek ini dalam versi yang dipublikasikan.

- Jika hosting Anda terhubung ke repository: commit dan push perubahan ke branch deployment, lalu tunggu build/deployment berhasil.
- Jika Anda mengunggah hasil build secara manual: jalankan `npm run build`, lalu unggah isi `dist` ke hosting yang Anda gunakan.

Sesudah deployment, buka alamat website publik dan ulangi pengujian pada layout terkait. Refresh halaman yang sebelumnya sudah terbuka agar memakai daftar terbaru.

## Mengubah atau menghapus template

- Mengubah nama: edit `name` di JSON.
- Mengganti desain: simpan PNG dengan nama baru dan ubah `src` agar gambar terbaru tidak tertahan cache browser.
- Menghapus: hapus object template dari JSON; file PNG boleh dihapus jika tidak dipakai entri lain.

Jalankan pemeriksaan dan publikasikan ulang setiap kali melakukan perubahan.
