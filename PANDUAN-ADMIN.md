# Halaman admin BOOTHPOP

Alamat halaman admin adalah `/#admin`, misalnya `http://localhost:5173/#admin` atau `https://alamat-website-anda.vercel.app/#admin`. URL dengan hash ini bekerja pada hosting statis tanpa menambahkan rewrite routing. Halaman admin memakai konfigurasi URL Supabase dan publishable key yang sama dengan katalog website.

## 1. Pasang aturan akses admin

1. Buka project BOOTHPOP di Supabase, lalu **SQL Editor → New query**.
2. Salin seluruh isi `supabase/04_admin_access.sql`, lalu klik **Run**.
3. Hasil sukses tanpa baris adalah normal. Script membuat daftar admin di schema privat, fungsi pemeriksa admin, serta policy database dan Storage. Tidak ada akun yang otomatis menjadi admin.

Script ini dijalankan setelah schema awal `01_schema.sql`. Jangan menjalankan ulang `01_schema.sql` sesudahnya karena script awal mencabut kembali hak tulis authenticated. Jika terlanjur, jalankan ulang `04_admin_access.sql`.

Aturan ini memberi hak tambah, ubah, dan hapus template hanya jika UUID akun ada dalam `boothpop_private.admins`. Login saja tidak cukup. Pengunjung masih hanya membaca template aktif. Gambar bucket `frames` tetap publik karena dipakai pengunjung.

Policy PostgreSQL bersifat tambahan. Jika Anda pernah membuat policy lain yang mengizinkan semua pengguna upload ke bucket `frames`, hapus/perbaiki policy longgar itu melalui Dashboard. Script ini tidak menghapus policy milik fitur lain.

## 2. Buat akun login admin

1. Buka **Authentication → Users → Add user → Create new user** (nama tombol dapat sedikit berbeda).
2. Isi email milik Anda dan buat password baru khusus akun login admin. Ini berbeda dari password database.
3. Jika tersedia, aktifkan **Auto confirm user** untuk akun yang Anda buat sendiri melalui Dashboard. Jika tidak, pastikan akun telah dikonfirmasi sebelum login.
4. Simpan akun dan salin nilai **User UID/ID** berupa UUID, misalnya `12345678-1234-4234-8234-123456789abc`.

Tidak ada formulir pendaftaran di website. Untuk project khusus admin ini, Anda juga dapat mematikan pendaftaran pengguna baru melalui konfigurasi Supabase Auth. Meski pendaftaran di Supabase masih aktif, akun baru tidak mendapatkan hak admin.

## 3. Tetapkan akun menjadi admin

1. Buka `supabase/05_add_admin.sql`.
2. Ganti `GANTI-DENGAN-UUID-USER-ANDA` dengan UUID akun dari Authentication.
3. Jalankan hasil SQL tersebut melalui SQL Editor sebagai pemilik project.
4. Hasil query terakhir menampilkan email akun yang kini menjadi admin.

Jangan memakai contoh UUID dari panduan, ID template, publishable key, atau password untuk kolom UUID ini. Akun Auth harus dibuat terlebih dahulu.

Untuk mencabut hak admin, jalankan melalui SQL Editor:

```sql
delete from boothpop_private.admins
where user_id = 'UUID-ADMIN-YANG-INGIN-DICABUT'::uuid;
```

Pemeriksaan hak dilakukan pada setiap operasi di database/Storage. Mencabut keanggotaan menghentikan hak tulis meskipun akun masih memiliki sesi login.

## 4. Buka halaman admin

1. Jalankan `npm.cmd run dev` dan buka alamat Vite diakhiri `/#admin`.
2. Login memakai email dan password akun Authentication tadi.
3. Jika muncul pesan akses admin diperlukan, pastikan langkah SQL 04 dan 05 sudah dijalankan untuk project yang sama dengan `.env.local`, lalu klik **Periksa lagi**.

Login menggunakan Supabase Auth; tidak membutuhkan secret key di frontend. Session disimpan lokal pada browser admin agar login tetap tersedia setelah refresh. Klik **Keluar** setelah selesai pada perangkat bersama.

## 5. Tambahkan template

Buka **Ketersediaan template per layout** di atas formulir. Pilih kategori **Belum ada** untuk melihat layout yang belum punya desain, **Sudah ada** untuk layout yang sudah punya desain, atau **Semua**. Setiap kartu memperlihatkan bentuk layout, ukuran, jumlah desain tersimpan, dan jumlah yang aktif. Desain nonaktif tetap dihitung sebagai sudah ada.

Klik **Tambah template** pada layout kosong, atau **+ Tambah desain** untuk menambahkan variasi pada layout yang sudah terisi. Aplikasi memilih layout pada formulir secara otomatis. **Lihat desain** menyaring daftar template di sebelah formulir sesuai layout tersebut. Satu layout bisa memiliki banyak desain.

Jika belum punya gambar desain, klik **Pola bingkai** dan **Panduan posisi** pada formulir. Keduanya dapat diunduh langsung dari admin tanpa sesi kamera. Edit pola di editor gambar, pertahankan dimensi dan lubang transparannya, lalu ekspor PNG/WebP untuk diupload.

1. Isi nama template.
2. Pilih layout. Ukuran kanvas wajib ditampilkan di formulir.
3. Tentukan urutan tampil; angka lebih kecil ditampilkan lebih dahulu.
4. Pilih PNG atau WebP transparan, maksimal 10 MB.
5. Tunggu pemeriksaan ukuran dan pusat lubang foto. Periksa seluruh area foto melalui preview; pemeriksaan pusat tidak menjamin seluruh lubang bebas dari desain.
6. Centang **Tampilkan untuk pengunjung** jika template langsung ingin dipublikasikan. Jika tidak dicentang, template disimpan sebagai nonaktif.
7. Klik **Simpan template**.

Upload baru otomatis disiapkan sebagai WebP sebelum dikirim. Target ukuran sekitar 500 KB dengan kualitas bertahap dari 92% sampai 74%; dimensi kanvas tidak diperkecil. WebP yang sudah di bawah target tidak dikompres ulang. Target bukan batas mutlak: jika hasil belum mencapai 500 KB pada batas kualitas tersebut, ukuran akhir ditampilkan agar Anda bisa menilainya dari preview. Hasil di atas batas 10 MB ditolak. Ukuran asli, ukuran akhir, dan penghematan tampil sebelum disimpan; transparansi hasil konversi diperiksa per piksel.

Jika browser tidak mendukung ekspor WebP, konversi PNG ditolak dengan pesan yang jelas; gunakan file WebP yang sudah disiapkan atau browser lain. Nama file upload dibuat unik oleh aplikasi. Gambar disimpan di bucket `frames`, metadata di `frame_templates`. Metadata yang gagal disimpan memicu pembersihan file baru; bila pembersihan gagal, pesan menjelaskan file yang perlu diperiksa di Dashboard.

## 6. Edit, aktifkan, dan hapus

- **Edit:** mengubah nama, urutan, dan status publikasi.
- **Aktifkan/Nonaktifkan:** mengatur kemunculan di katalog pengunjung. Nonaktif bukan membuat gambar privat; URL file di bucket publik tetap dapat dibuka.
- **Hapus:** meminta konfirmasi, menghapus metadata lalu file gambar. Jika file belum berhasil dihapus, pesan menyebutkan nama file untuk dibersihkan melalui Dashboard.
- Mengganti gambar/layout dilakukan dengan menambahkan template baru. Cara ini menjaga kecocokan ukuran dan menghindari gambar lama dari cache.

Muat ulang halaman photobooth untuk mengambil katalog terbaru. Tidak perlu deploy ulang hanya untuk perubahan template. Versi kode halaman admin pertama kali tetap perlu dideploy. Environment Vercel harus memuat dua variabel publik yang sama dengan konfigurasi lokal.

## Data pengunjung

Upload foto, stiker, dan bingkai oleh pengunjung tetap hanya diproses di browser. Alur itu tidak memanggil API penyimpanan admin. Foto hasil sesi pengguna tidak disimpan di database atau Storage.

## Pengujian dan batas verifikasi

Jalankan `npm.cmd run build` dan `npm.cmd test`. Tes PostgreSQL lokal menjalankan SQL 01/04 pada schema Auth/Storage simulasi: pengunjung dan non-admin ditolak, admin bisa mengelola data, akun tidak bisa mengangkat dirinya sendiri, file terpakai tidak dapat dihapus, dan pencabutan admin menghentikan akses. Tes API memeriksa penolakan non-admin serta pembersihan upload gagal.

SQL 04/05 belum dijalankan pada project cloud Anda oleh kode ini. Sesudah memasangnya, uji login dan satu template percobaan sebelum mengelola desain utama. Tes lokal tidak menggantikan pengujian Auth dan Storage pada project Supabase nyata.

Referensi: [Password Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
