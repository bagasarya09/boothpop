# BOOTHPOP
Photobooth React + Vite + TypeScript + Tailwind CSS, dengan token NeoTo dari referensi pengguna.
## Menjalankan
Gunakan Node.js 20.19+ atau 22.12+.
1. Jalankan npm install
2. Jalankan npm run dev
3. Buka alamat localhost yang ditampilkan.
Kamera memerlukan localhost atau HTTPS. Membuka IP HTTP dari ponsel tidak cukup untuk akses kamera; gunakan deployment HTTPS Vercel.
## Build dan tes
npm run check:frames
npm run build
npm test
## Template bingkai publik
Template siap pakai muncul pada **Hias dan unduh → Bingkai**, sesuai layout foto yang dipilih. Daftarnya ada di `public/frames/templates.json` dan PNG disimpan di `public/frames/`. Tidak membutuhkan database. Spider Strip tersedia untuk Polaroid landscape (`pol11`).

Lihat [panduan menambahkan bingkai](PANDUAN-BINGKAI.md) untuk langkah desain, penambahan file, konfigurasi, pemeriksaan, dan publikasi. Tombol upload di aplikasi hanya berlaku untuk sesi pengguna, bukan untuk menambahkan template publik.

Build otomatis memeriksa konfigurasi dan PNG template sebelum membuat hasil produksi.
## Deploy ke Vercel
Upload source ke repository Git pribadi Anda, import ke Vercel, pilih preset Vite.
Build command: npm run build. Output directory: dist.
Tidak membutuhkan environment variable, backend, database, atau layanan penghubung antarperangkat. PNG dan GIF dibuat serta diunduh langsung dari browser.
Gunakan Vercel Hobby hanya sesuai ketentuan penggunaan personal/nonkomersial dan batas kuotanya.
Proyek belum dideploy; langkah ini dilakukan pada akun Vercel Anda.
## Fitur
Pilihan layout dikelompokkan berdasarkan jumlah foto (1, 2, 3, 4, dan 6). Mengganti kelompok hanya mengubah daftar yang ditampilkan; layout sesi berubah setelah pengguna memilih kartu layout.
ID/EN; 16 layout; timer 3/5/10 detik; kamera mirror; upload galeri; review; retake individual/semua; warna bingkai; filter original/B&W/sepia; dekorasi bintang/hati; upload stiker dengan posisi, skala, dan rotasi; upload PNG bingkai; template dan panduan; ekspor PNG dan GIF satu foto bergantian dengan interval 0,5/1/2 detik.
Foto hanya ada di memori sesi. Refresh/menutup tab menghapus sesi.
Upload galeri: tepat sesuai jumlah slot, JPG/PNG/WebP, 10 MB tiap file.
Stiker: PNG/WebP 5 MB; maksimal 10; disarankan transparan minimal 256 px.
Bingkai: PNG 10 MB, dimensi persis template; pusat slot transparan. Pemeriksaan pusat tidak menjamin semua area transparan, sehingga preview tetap wajib.
Resolusi decode maksimal 24 megapiksel. Template bingkai memiliki area foto transparan.
## Layout export
Filter yang tersedia: Original, Natural, Bright, B&W, Sepia, Vintage, Warm, Cool, Pastel, dan Film. Intensitas filter bisa diatur 0–100% (default 100%). Film FX menyediakan kontrol grain, vignette, dan bocoran cahaya hangat masing-masing 0–100%, termasuk pada Original. Efek diterapkan pada foto dalam preview, PNG, dan GIF; bingkai dan stiker mempertahankan warna aslinya. Reset Film FX menghapus tambahan efek; filter Film sendiri tetap memiliki grain/vignette halus sebagai bagian preset.

strip4: 720 × 2140
strip3: 787 × 1800
duo: 1122 × 1800
grid4: 1800 × 1513
grid6: 1500 × 1800
Dimensi aktual ditampilkan aplikasi; lihat src/layout.mjs sebagai sumber resmi geometri.
## Catatan
Nama font persis tidak terbaca dari referensi, sehingga Arial dipakai sebagai fallback sistem.
Akun, moderasi, galeri cloud, dan transfer QR tidak tersedia. GIF berupa slideshow foto, bukan rekaman video atau format Apple Live Photo.
## GIF slideshow
Di **Hias dan unduh**, pilih interval 0,5/1/2 detik di bawah preview; default 0,5 detik. Pilih format GIF pada bilah bawah untuk melihat preview bergerak, lalu klik Unduh GIF. Hasilnya satu area foto yang menampilkan semua jepretan secara berurutan, dengan sisi panjang maksimal 800 px. Minimal 2 foto diperlukan.

Warna, filter, dekorasi, dan stiker ikut digunakan. Template PNG untuk strip/grid tidak diterapkan ke GIF satu foto karena posisi lubangnya berbeda. PNG tetap menggunakan layout dan template yang dipilih.

Lihat [panduan GIF](PANDUAN-GIF.md) untuk langkah lengkap dan catatan hosting.
Stiker bawaan adalah bentuk geometris yang digambar oleh aplikasi, bukan aset karakter pihak ketiga.
Token utama: yellow #F6CE46, pink #F97CC4, mint #ABE890, blue #99C2FF, ink #111111, paper #FAF8F3.
Ukuran, spacing, border, dan shadow memakai CSS variables. Tailwind diintegrasikan melalui plugin Vite.
Lakukan pengujian kamera dan penyimpanan file pada Safari iOS dan Chrome Android nyata sebelum rilis publik.

## Update BOOTHPOP
Nama tampilan, file hasil, dan metadata sudah menggunakan BOOTHPOP.
Sebelas layout cetak ditambahkan dari referensi: 7,5 × 2,5; 9 × 3; 15 × 5; 15 × 6; 17 × 6; 18,5 × 5; 7,5 × 5; 9 × 6; 10 × 7; 8 × 7; 11 × 9 cm.
Ukuran pertama menunjukkan tinggi untuk layout portrait; 11 × 9 menunjukkan lebar × tinggi untuk landscape.
PNG mengikuti rasio cetak dengan sisi panjang 2140 px. Saat mencetak, atur dimensi cm di aplikasi cetak; file tidak menetapkan ukuran kertas atau DPI cetak otomatis.
Tata letak lubang foto merupakan adaptasi visual karena gambar referensi tidak memberikan ukuran lubang dan margin.
Layout photobooth bawah pada referensi tidak mencantumkan ukuran cm; tidak ada ukuran cetak yang dikarang untuk layout tersebut.
Layout asli tetap tersedia.
## Donasi
Letakkan link donasi pada src/settings.ts dengan mengganti configuredDonationUrl.
Contoh: isi URL HTTPS halaman profil donasi milik Anda, bukan URL contoh.
Tombol Dukung BOOTHPOP muncul di footer dan membuka platform eksternal di tab baru.
Tanpa URL, tombol tidak ditampilkan. Tidak membutuhkan database, API pembayaran, atau penyimpanan transaksi.
