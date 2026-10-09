# Unduh GIF slideshow BOOTHPOP

1. Pilih layout dengan minimal 2 foto, ambil atau upload jepretan, lalu review.
2. Lanjut ke **Hias dan unduh** dan sesuaikan warna, filter, dekorasi, serta stiker.
3. Di bawah preview, pilih interval **0,5 detik**, **1 detik**, atau **2 detik**. Default 0,5 detik.
4. Pilih format **GIF** pada bilah bawah layar. Preview berubah menjadi satu area foto yang menampilkan jepretan secara bergantian.
5. Klik **Unduh GIF**.

Contoh: layout 3 foto menghasilkan GIF satu area foto dengan urutan foto 1 → foto 2 → foto 3 → kembali ke foto 1. Dengan interval 0,5 detik, satu putaran memerlukan 1,5 detik.

GIF menggunakan layout satu foto yang sama untuk semua pilihan strip/grid, tanpa template bingkai PNG. Warna, filter, dekorasi, dan stiker tetap digunakan. PNG tetap memakai layout, urutan foto, dan template yang dipilih.

GIF memiliki sisi panjang maksimal 800 px dan palet hingga 256 warna per frame. PNG tetap menggunakan resolusi penuh layout. GIF tidak merekam gerakan kamera atau audio dan bukan format Apple Live Photo.

Layout 1 foto hanya menyediakan PNG karena tidak ada pergantian foto untuk slideshow. Jika file tidak tersimpan otomatis pada ponsel, buka hasil gambar kemudian tekan lama untuk menyimpannya.

## Hosting dan QR

Ekspor PNG/GIF berjalan di browser dan bisa digunakan pada website statis yang dihosting di Vercel. Publikasikan hasil build terbaru untuk memakai perubahan ini.

Fitur QR transfer antarperangkat sudah dihapus sesuai permintaan. Hosting Vercel dapat menyediakan URL publik dan HTTPS, tetapi tidak otomatis mengatasi keterbatasan koneksi langsung WebRTC seperti NAT/firewall. Jika transfer QR ingin ditambahkan kembali, fitur tersebut memerlukan rancangan transfer dan pengujian dua perangkat; jangan mengandalkan hosting saja untuk menjamin transfer berhasil.

## Pemeriksaan

Jalankan `npm.cmd run build` dan `npm.cmd test`. Tes slideshow memeriksa jumlah frame, urutan warna jepretan, layout satu foto, interval 0,5/1/2 detik, loop GIF, serta penolakan sesi yang tidak lengkap. Tes PNG/layout tetap dijalankan.
