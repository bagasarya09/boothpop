# Menyiapkan database template BOOTHPOP di Supabase

Panduan ini menyiapkan database dan Storage. Website sudah mendukung katalog Supabase ketika konfigurasi environment diisi (langkah 8). Tanpa konfigurasi, website memakai `public/frames/templates.json`. Setelah tahap ini selesai, pasang halaman admin mengikuti [PANDUAN-ADMIN.md](PANDUAN-ADMIN.md).

## 1. Buat project Supabase

1. Buka https://supabase.com/dashboard dan masuk/daftar akun.
2. Pilih **New project**, lalu pilih/buat organization pada paket Free jika ingin memulai dari layanan gratis.
3. Isi nama project, misalnya `boothpop`.
4. Buat password database yang kuat dan simpan sendiri. Password ini tidak perlu dikirim ke chat atau dimasukkan ke kode frontend.
5. Pilih region yang dekat dengan pengguna di Indonesia dari pilihan yang tersedia.
6. Klik **Create new project** dan tunggu sampai project siap.

Gunakan project baru untuk mengikuti panduan ini. Jika ingin menggunakan project yang sudah berisi tabel dengan nama yang sama, periksa struktur yang ada terlebih dahulu.

## 2. Buat tabel dan aturan akses

1. Di project yang benar, buka **SQL Editor → New query**.
2. Buka file `supabase/01_schema.sql` di proyek lokal.
3. Salin seluruh isinya ke SQL Editor, lalu klik **Run**.
4. Hasil tanpa error, misalnya `Success. No rows returned`, menandakan perintah selesai.

Tabel yang dibuat:

| Tabel | Isi |
| --- | --- |
| `photo_layouts` | ID layout, nama ID/EN, jumlah foto, lebar dan tinggi kanvas |
| `frame_templates` | ID/nama template, layout terkait, nama file gambar, urutan, status aktif, tanggal penambahan |

`image_path` menyimpan nama file seperti `Maroon_Cute_Strip4.webp`, bukan isi gambar dan bukan URL lengkap. Relasi `layout_id` menghubungkan template ke ukuran layout yang sesuai. Dimensi yang dicatat adalah dimensi kanvas, bukan ukuran lubang foto.

RLS diaktifkan: pengunjung hanya bisa membaca layout dan template aktif. Tidak ada izin tambah/ubah/hapus untuk pengunjung atau akun yang sekadar login. Pada tahap awal Anda mengelola data dari Dashboard Supabase. Hak tulis khusus admin ditambahkan melalui `04_admin_access.sql` sesuai panduan admin, sesudah setup database ini selesai.

## 3. Masukkan layout dan template yang sudah ada

1. Buat query baru.
2. Salin dan jalankan seluruh isi `supabase/02_seed_templates.sql`.
3. Buka **Table Editor**. Pada kondisi awal proyek ini, `photo_layouts` berisi **16 baris** dan `frame_templates` berisi **7 baris**.

Data seed disiapkan dari `src/layout.mjs` dan `public/frames/templates.json` saat panduan dibuat. Menjalankan ulang seed tidak menimpa baris dengan ID yang sudah ada. Jika Anda menambahkan template lokal setelah itu, baris baru perlu ditambahkan juga ke database.

Template seed sengaja berstatus `is_active = false` sampai file gambar selesai diunggah. Dashboard tetap dapat menampilkan baris tersebut; pengunjung tidak.

## 4. Buat tempat penyimpanan gambar

1. Buka **Storage → New bucket**.
2. Isi nama bucket persis **`frames`**.
3. Aktifkan **Public bucket** karena template bingkai memang digunakan semua pengunjung. Public berarti gambar dapat dibaca melalui URL publik; bukan berarti semua orang boleh upload.
4. Pada pengaturan batas upload bucket, gunakan maksimal **10 MB** dan MIME types `image/webp`, `image/png`. Jika pengaturan ini tidak ditampilkan saat membuat bucket, buka konfigurasi bucket sesudah dibuat.
5. Simpan.

Pada tahap ini jangan menambahkan policy yang mengizinkan siapa saja upload, mengubah, atau menghapus file. Upload dari Dashboard dilakukan oleh Anda sebagai pengelola project; nantinya halaman admin memerlukan aturan akses tersendiri.

Jangan gunakan bucket publik ini untuk foto pribadi pengguna. Menonaktifkan baris template menyembunyikannya dari daftar publik, tetapi tidak membuat file di bucket publik menjadi privat.

## 5. Upload 7 gambar WebP

Buka bucket `frames`, lalu upload file berikut dari folder lokal `public/frames/` langsung ke akar bucket (tanpa membuat subfolder `frames` lagi):

- `Spider_Strip.webp`
- `Maroon_Cute_Strip4.webp`
- `Blue_Cute_Strip4.webp`
- `Sticker_Strip4.webp`
- `RandomCute_Strip4.webp`
- `Maroon_Cute_Grid4.webp`
- `Strip4-1_Maroon_Cute.webp`

Jangan upload `templates.json` atau folder backup `assets/originals`. Huruf besar/kecil nama file harus sama dengan `frame_templates.image_path`.

Pilih salah satu gambar di Storage dan gunakan **Get URL/Copy URL** (nama tombol dapat berbeda). Buka URL publik tersebut di tab baru untuk memastikan gambar dapat dibaca. Pola alamatnya:

```text
https://PROJECT-REF.supabase.co/storage/v1/object/public/frames/Maroon_Cute_Strip4.webp
```

Ganti `PROJECT-REF` dengan project Anda; alamat di atas hanya contoh.

## 6. Periksa data dan aktifkan template

Jalankan `supabase/03_verify.sql` di SQL Editor. Query menampilkan jumlah data, ukuran layout, dan apakah file Storage yang sesuai sudah ada.

Jika kolom `file_uploaded` semuanya `true`, jalankan query berikut sebagai aktivasi pertama kali:

```sql
update public.frame_templates as frame
set is_active = true
where exists (
  select 1 from storage.objects as object
  where object.bucket_id = 'frames'
    and object.name = frame.image_path
);
```

Ulangi `03_verify.sql`; ketujuh baris sekarang memiliki `is_active = true` dan `file_uploaded = true`. Pemeriksaan ini memastikan keberadaan file, bukan memvalidasi isi, dimensi, atau transparansi PNG/WebP yang diupload. File lokal sudah diperiksa dengan `npm.cmd run check:frames`; jangan menggantinya dengan file berbeda saat upload.

Query aktivasi di atas digunakan untuk penyiapan awal, bukan rutin dijalankan setelah Anda mulai sengaja menonaktifkan template tertentu.

## 7. Simpan informasi project untuk integrasi berikutnya

Catat **Project URL** dan **Publishable key** dari dialog **Connect** atau pengaturan **API Keys** project. Pada project lama, kunci frontend dapat bernama **anon key**. Keduanya digunakan nanti ketika website dihubungkan ke Supabase dengan aturan RLS yang sudah disiapkan.

Jangan menyalin database password, secret key, atau `service_role` key ke kode frontend atau variabel `VITE_`. Key publishable tidak memberikan hak admin dengan sendirinya.

## 8. Hubungkan website

Pada folder proyek, buat `.env.local` dengan format berikut, memakai nilai project Anda sendiri:

```dotenv
VITE_SUPABASE_URL=https://PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_CONTOH
```

`.env.local` sudah diabaikan oleh Git. `.env.example` hanya berisi nama variabel kosong. Gunakan publishable key; validator frontend menolak secret key. Restart `npm.cmd run dev` setelah mengubah environment.

Buka Pilih layout atau Hias dan unduh. Template aktif dibaca dari database, diurutkan berdasarkan `sort_order` dan `id`, lalu gambar dimuat dari bucket `frames`. Pilih bingkai dan unduh PNG untuk memeriksa bahwa gambar lintas domain bisa diekspor. Bila katalog gagal dimuat, aplikasi menyediakan tombol Coba lagi tanpa mengaktifkan kembali template lokal yang mungkin sudah dinonaktifkan di database.

Perubahan katalog terlihat setelah halaman dimuat ulang, tanpa build ulang. Gambar baru tetap harus memiliki ukuran/transparansi yang sesuai. Foto pengguna tidak dikirim ke database atau Storage.

Jalankan `npm.cmd run check:supabase` untuk menguji koneksi baca, gambar publik, CORS, dimensi, dan pusat lubang transparan. Perintah ini membutuhkan akses internet dan `.env.local`. Jika katalog terbaca tetapi gambar mengembalikan `Bucket not found`, periksa **Storage → frames → Edit bucket → Public bucket**. Bucket privat tidak menyediakan URL gambar publik; mengaktifkan status template di database tidak mengubah visibilitas bucket.

Untuk Vercel, isi dua nama variabel yang sama di pengaturan Environment Variables project, pilih lingkungan deployment yang digunakan, lalu deploy ulang. Perubahan konfigurasi environment memerlukan restart/deploy ulang; perubahan isi tabel template tidak.

## Hasil tahap ini

- Database berisi 16 layout dan 7 metadata template.
- Bucket `frames` berisi 7 gambar WebP publik.
- Template aktif bisa dibaca melalui Data API dengan publishable key; hak tulis pengunjung ditutup.
- Website memakai Supabase saat environment dikonfigurasi, dan katalog lokal jika keduanya kosong.

Saya menyiapkan file SQL di proyek, tetapi belum menjalankannya pada akun Supabase Anda. Keberhasilan tahap cloud ditentukan oleh hasil Run dan pemeriksaan di Dashboard Anda.

Referensi resmi:

- [Membuat tabel](https://supabase.com/docs/guides/database/tables)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Membuat bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Kontrol akses Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
