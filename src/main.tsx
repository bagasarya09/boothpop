import { donationUrl } from './settings';

import React, { useEffect, useRef, useState } from 'react';
import { slideshowGif, slideshowLayout } from './slideshow';
import { photoFilters, defaultFilmFx, type FilmFx } from './filters';

import { createRoot } from 'react-dom/client';

import { layouts, geometry, framePresets } from './layout.mjs';

import {
  renderStrip,
  frameTemplate,
  canvasBlob,
  downloadBlob,
  loadImage,
  type Layout,
  type Sticker,
} from './canvas';

import './style.css';
import './frame-presets.css';
import './export.css';

type FramePreset = { id: string; name: string; layoutId: string; src: string };

function App() {
  // Bahasa dan state aplikasi

  const [lang, setLang] = useState<'id' | 'en'>('id');

  const t = (id: string, en: string) => (lang === 'id' ? id : en);

  const [step, setStep] = useState(0);

  const [layout, setLayout] = useState<Layout>(layouts[0]);
  const [layoutGroup, setLayoutGroup] = useState(layouts[0].count);
  const layoutCounts = [...new Set(layouts.map((item) => item.count))].sort((a, b) => a - b);

  const [timer, setTimer] = useState(3);

  const [photos, setPhotos] = useState<string[]>([]);
  const [captureShots, setCaptureShots] = useState<string[]>([]);

  const [camera, setCamera] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );

  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);

  const [pose, setPose] = useState(0);

  const [retake, setRetake] = useState<number | null>(null);

  const [color, setColor] = useState('#FFFFFF');

  const [filter, setFilter] = useState('original');
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [filmFx, setFilmFx] = useState<FilmFx>({ ...defaultFilmFx });

  const [decoration, setDecoration] = useState('none');

  const [frame, setFrame] = useState<string | null>(null);

  const [stickers, setStickers] = useState<Sticker[]>([]);

  const [selected, setSelected] = useState('');

  const [tab, setTab] = useState('frame');

  const [preview, setPreview] = useState('');

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'gif'>('png');
  const [gifSeconds, setGifSeconds] = useState<0.5 | 1 | 2>(0.5);
  const [gifProgress, setGifProgress] = useState('');
  const [gifPreview, setGifPreview] = useState('');

  const [message, setMessage] = useState('');

  const [info, setInfo] = useState<string | null>(null);

  // Referensi kamera dan kontrol proses asynchronous

  const video = useRef<HTMLVideoElement>(null);

  const stream = useRef<MediaStream | null>(null);

  const generation = useRef(0);

  const cameraGeneration = useRef(0);

  const previewGeneration = useRef(0);

  const captureBusy = useRef(false);

  const g = geometry(layout);
  const availableFrames = framePresets.filter(
    (preset) => preset.layoutId === layout.id,
  );
  const layoutsWithFrames = layouts.filter((candidate) =>
    framePresets.some((preset) => preset.layoutId === candidate.id),
  );
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const frameRequest = useRef(0);
  useEffect(() => {
    frameRequest.current += 1;
    setLoadingPreset(null);
  }, [layout.id]);

  // Pengelolaan kamera

  function stopCamera() {
    cameraGeneration.current++;

    generation.current++;

    captureBusy.current = false;

    stream.current?.getTracks().forEach((track) => track.stop());

    stream.current = null;

    setBusy(false);

    setCountdown(null);

    setCamera('idle');
  }

  useEffect(
    () => () => {
      generation.current++;

      cameraGeneration.current++;

      stream.current?.getTracks().forEach((track) => track.stop());
    },

    [],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!message) return;

    const id = setTimeout(() => setMessage(''), 5000);

    return () => clearTimeout(id);
  }, [message]);

  async function openCamera() {
    setError('');

    setCamera('loading');

    const ticket = ++cameraGeneration.current;

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');

      stream.current?.getTracks().forEach((track) => track.stop());

      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },

        audio: false,
      });

      if (ticket !== cameraGeneration.current) {
        media.getTracks().forEach((track) => track.stop());

        return;
      }

      stream.current = media;

      if (video.current) {
        video.current.srcObject = media;

        await video.current.play();
      }

      setCamera('ready');
    } catch (e) {
      if (ticket !== cameraGeneration.current) return;

      setCamera('error');

      const name = (e as Error).name;

      setError(
        name === 'NotAllowedError'
          ? t(
              'Izin kamera ditolak. Buka pengaturan izin situs di browser, izinkan kamera, lalu coba lagi.',

              'Camera access denied. Allow camera access in your browser site settings, then retry.',
            )
          : name === 'NotFoundError'
            ? t(
                'Kamera tidak ditemukan. Sambungkan kamera atau gunakan upload foto.',

                'No camera found. Connect a camera or upload photos.',
              )
            : t(
                'Kamera belum bisa digunakan. Pastikan HTTPS aktif dan kamera tidak dipakai aplikasi lain.',

                'Camera unavailable. Use HTTPS and check that another app is not using the camera.',
              ),
      );
    }
  }

  function goCamera(index: number | null = null) {
    setRetake(index);
    setCaptureShots(index === null ? [] : photos.map((photo, slot) => slot === index ? '' : photo));

    setPose(index ?? 0);

    setStep(2);

    setError('');
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (step === 2) setCamera('idle');
    else stopCamera();
  }, [step]);

  // Pengambilan foto dan retake

  async function capture() {
    if (captureBusy.current || camera !== 'ready') return;

    captureBusy.current = true;

    setBusy(true);

    setError('');

    const ticket = ++generation.current;

    const result = retake !== null ? [...photos] : Array<string>(layout.count).fill('');
    setCaptureShots(retake !== null ? result.map((photo, slot) => slot === retake ? '' : photo) : []);

    try {
      const indices =
        retake !== null
          ? [retake]
          : Array.from({ length: layout.count }, (_, i) => i);

      for (const index of indices) {
        setPose(index);

        for (let n = timer; n > 0; n--) {
          if (ticket !== generation.current) return;

          setCountdown(n);

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (ticket !== generation.current) return;

        setCountdown(null);

        const v = video.current;

        if (!v || !v.videoWidth) throw new Error('Camera not ready');

        const c = document.createElement('canvas');

        c.width = Math.min(1280, v.videoWidth);

        c.height = Math.round((c.width * v.videoHeight) / v.videoWidth);

        const x = c.getContext('2d')!;

        x.translate(c.width, 0);

        x.scale(-1, 1);

        x.drawImage(v, 0, 0, c.width, c.height);

        result[index] = c.toDataURL('image/jpeg', 0.9);
        setCaptureShots([...result]);
      }

      if (ticket === generation.current) {
        setPhotos(result);

        setStep(3);
      }
    } catch {
      setError(
        t(
          'Foto gagal diambil. Foto sebelumnya tetap tersimpan; coba lagi.',

          'Capture failed. Previous photos are kept; please retry.',
        ),
      );
    } finally {
      if (ticket === generation.current) {
        captureBusy.current = false;

        setBusy(false);

        setCountdown(null);
      }
    }
  }

  // Validasi dan upload file

  async function readFile(file: File, max: number, types: string[]) {
    if (!types.includes(file.type))
      throw new Error(
        t('Format file tidak didukung.', 'Unsupported file format.'),
      );

    if (file.size > max * 1024 * 1024)
      throw new Error(
        t(
          'File melebihi batas ' + max + ' MB.',
          'File exceeds ' + max + ' MB.',
        ),
      );

    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });

    const img = await loadImage(src);

    if (img.width * img.height > 24000000)
      throw new Error(
        t(
          'Resolusi terlalu besar. Gunakan gambar di bawah 24 megapiksel.',

          'Resolution too large. Use an image below 24 megapixels.',
        ),
      );

    return { src, img };
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files) return;

    setError('');

    if (files.length !== layout.count) {
      setError(
        t(
          'Pilih tepat ' + layout.count + ' foto untuk layout ini.',

          'Select exactly ' + layout.count + ' photos for this layout.',
        ),
      );

      return;
    }

    setBusy(true);

    try {
      const result = [];

      for (const file of Array.from(files)) {
        const { img } = await readFile(file, 10, [
          'image/png',

          'image/jpeg',

          'image/webp',
        ]);

        const c = document.createElement('canvas');

        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));

        c.width = Math.round(img.width * scale);

        c.height = Math.round(img.height * scale);

        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);

        result.push(c.toDataURL('image/jpeg', 0.9));
      }

      setPhotos(result);

      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function validateFrame(img: HTMLImageElement) {
    if (img.width !== g.width || img.height !== g.height)
      throw new Error(
        t('Ukuran bingkai harus ', 'Frame size must be ') +
          g.width +
          ' × ' +
          g.height +
          ' px. ' +
          t('Ukuran gambar terbaca: ', 'Detected image size: ') +
          img.width + ' × ' + img.height + ' px.',
      );

    const c = document.createElement('canvas');

    c.width = img.width;

    c.height = img.height;

    const x = c.getContext('2d')!;

    x.drawImage(img, 0, 0);

    const blocked = g.slots.some(
      (s) =>
        x.getImageData(
          Math.round(s.x + s.w / 2),
          Math.round(s.y + s.h / 2),
          1,
          1,
        ).data[3] > 20,
    );

    if (blocked)
      throw new Error(
        t(
          'Bagian tengah area foto harus transparan. Gunakan template yang disediakan.',

          'Photo opening centers must be transparent. Use the provided template.',
        ),
      );
  }

  async function selectPreset(preset: FramePreset) {
    const request = ++frameRequest.current;
    setLoadingPreset(preset.id);
    setError('');
    setMessage('');
    try {
      // Reload a replacement PNG even when the same template URL was used earlier.
      const source = preset.src + (preset.src.includes('?') ? '&' : '?') + 'v=' + Date.now();
      const img = await loadImage(source);
      if (request !== frameRequest.current) return;
      validateFrame(img);
      setFrame(source);
      setMessage(
        t(
          'Bingkai diterapkan. Periksa area foto pada preview.',
          'Frame applied. Check photo openings in the preview.',
        ),
      );
    } catch (error) {
      if (request !== frameRequest.current) return;
      setError(
        (error as Error).message === 'Image decode failed'
          ? t(
              'Gambar bingkai gagal dimuat. Periksa file public' +
                preset.src +
                ' dan nama filenya.',
              'Could not load frame. Check public' +
                preset.src +
                ' and its filename.',
            )
          : (error as Error).message,
      );
    } finally {
      if (request === frameRequest.current) setLoadingPreset(null);
    }
  }

  async function uploadAsset(
    file: File | undefined,
    kind: 'frame' | 'sticker',
  ) {
    if (!file) return;
    const request = kind === 'frame' ? ++frameRequest.current : null;
    if (kind === 'frame') {
      setLoadingPreset(null);
    }

    setError('');

    try {
      const { src, img } = await readFile(
        file,

        kind === 'frame' ? 10 : 5,

        kind === 'frame' ? ['image/png'] : ['image/png', 'image/webp'],
      );

      if (kind === 'frame') {
        if (request !== frameRequest.current) return;
        validateFrame(img);

        setFrame(src);

        setMessage(
          t(
            'Bingkai diterapkan. Periksa seluruh area foto pada preview.',

            'Frame applied. Check all photo openings in the preview.',
          ),
        );
      } else {
        if (stickers.length >= 10)
          throw new Error(
            t(
              'Maksimal 10 stiker per sesi.',
              'Maximum 10 stickers per session.',
            ),
          );

        const id = crypto.randomUUID();

        setStickers((old) => [
          ...old,
          { id, src, x: 50, y: 85, size: 20, rotation: 0 },
        ]);

        setSelected(id);
      }
    } catch (e) {
      if (kind === 'frame' && request !== frameRequest.current) return;
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (step !== 4) return;

    let active = true;

    const ticket = ++previewGeneration.current;

    setError('');

    renderStrip(layout, photos, { color, filter, filterIntensity, filmFx, decoration, frame, stickers })
      .then((c) => {
        if (active && ticket === previewGeneration.current)
          setPreview(c.toDataURL('image/png'));
      })

      .catch(() => {
        if (active)
          setError(
            t(
              'Preview gagal dibuat. Coba hapus aset terakhir.',

              'Preview failed. Try removing the last asset.',
            ),
          );
      });

    return () => {
      active = false;
    };
  }, [step, layout, photos, color, filter, filterIntensity, filmFx, decoration, frame, stickers, lang]);

  // Ekspor hasil dan template bingkai
  useEffect(() => {
    if (step !== 4 || exportFormat !== 'gif' || photos.length < 2) return;
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;
    setGifPreview('');
    (async () => {
      const images: string[] = [];
      for (const photo of photos) {
        if (!active) return;
        const canvas = await renderStrip(slideshowLayout, [photo], { color, filter, filterIntensity, filmFx, decoration, frame: null, stickers }, 800);
        images.push(canvas.toDataURL('image/png'));
      }
      if (!active) return;
      let index = 0;
      setGifPreview(images[0]);
      interval = setInterval(() => {
        index = (index + 1) % images.length;
        setGifPreview(images[index]);
      }, gifSeconds * 1000);
    })().catch(() => {
      if (active) setError(t('Preview GIF gagal dibuat. Coba hapus aset terakhir.', 'GIF preview failed. Try removing the last asset.'));
    });
    return () => { active = false; clearInterval(interval); };
  }, [step, exportFormat, photos, color, filter, filterIntensity, filmFx, decoration, stickers, gifSeconds]);

  async function exportPhoto() {
    if (exporting) return;
    setExporting(true);

    setError('');

    try {
      const options = {
        color,

        filter,
        filterIntensity,
        filmFx,

        decoration,

        frame,

        stickers,
      };
      const blob = exportFormat === 'gif'
        ? await slideshowGif(layout, photos, options, gifSeconds, (done, total) => setGifProgress(`${done}/${total}`))
        : await canvasBlob(await renderStrip(layout, photos, options));
      downloadBlob(blob, 'boothpop-' + layout.id + '.' + exportFormat);

      setMessage(
        t(
          'File siap. Jika gambar terbuka di tab baru, tekan lama untuk menyimpannya.',

          'File ready. If the image opens in a new tab, long-press to save it.',
        ),
      );
    } catch {
      setError(
        t(
          'Unduhan gagal. Foto Anda tetap tersedia; silakan coba lagi.',

          'Download failed. Your photos are kept; please retry.',
        ),
      );
    } finally {
      setExporting(false);
      setGifProgress('');
    }
  }


  async function template(guide: boolean) {
    try {
      downloadBlob(
        await canvasBlob(frameTemplate(layout, guide)),

        guide ? 'boothpop-guide.png' : 'boothpop-frame-' + layout.id + '.png',
      );
    } catch {
      setError(t('Template gagal diunduh.', 'Template download failed.'));
    }
  }

  // Pengaturan sesi baru

  function startOver() {
    if (
      photos.length &&
      !confirm(
        t(
          'Mulai sesi baru? Foto sesi ini akan dihapus. Pastikan hasil sudah disimpan.',

          'Start a new session? Current photos will be removed. Save your result first.',
        ),
      )
    )
      return;

    stopCamera();

    frameRequest.current += 1;
    setLoadingPreset(null);

    setPhotos([]);
    setCaptureShots([]);

    setStickers([]);

    setFrame(null);

    setPreview('');
    setExportFormat('png');

    setFilter('original');
    setFilterIntensity(100);
    setFilmFx({ ...defaultFilmFx });

    setDecoration('none');

    setColor('#FFFFFF');

    setStep(1);

    setError('');
  }

  useEffect(() => {
    if (!info) return;

    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfo(null);

      if (e.key === 'Tab') {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.modal button'),
        );

        const first = buttons[0];

        const last = buttons[buttons.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();

          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();

          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;

      previous?.focus();
    };
  }, [info]);

  // Pengaturan stiker dan navigasi tahapan

  const activeSticker = stickers.find((s) => s.id === selected);
  useEffect(() => {
    if (photos.length < 2) setExportFormat('png');
  }, [photos.length]);

  function updateSticker(key: 'x' | 'y' | 'size' | 'rotation', value: number) {
    setStickers((old) =>
      old.map((s) => (s.id === selected ? { ...s, [key]: value } : s)),
    );
  }

  const stepNames = [
    t('Pilih layout', 'Choose layout'),

    t('Ambil foto', 'Take photos'),

    t('Review foto', 'Review photos'),

    t('Hias & unduh', 'Decorate & save'),
  ];

  // Tampilan aplikasi

  return (
    <div className={'app' + (step === 4 ? ' app-editing' : '')}>
      <header>
        <button
          className="wordmark"

          disabled={busy || exporting}

          onClick={() => {
            if (step === 0) return;

            if (!photos.length) {
              stopCamera();

              setStep(0);
            } else startOver();
          }}

          aria-label={t('Beranda BOOTHPOP', 'BOOTHPOP home')}
        >
          <span className="logo-icon">▣</span> BOOTHPOP
        </button>

        <div className="header-actions">
          <button className="small-btn" onClick={() => setInfo('help')}>
            {t('Cara pakai', 'How it works')}
          </button>

          <div className="language" aria-label={t('Bahasa', 'Language')}>
            <button aria-pressed={lang === 'id'} onClick={() => setLang('id')}>
              ID
            </button>

            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>
      </header>

      {step === 0 ? (
        <main className="landing">
          <section className="hero-copy">
            <h1>
              {t('Pose dulu.', 'Strike a pose.')}

              <br />

              <span className="yellow-highlight">
                {t('Simpan serunya.', 'Keep the joy.')}
              </span>
            </h1>

            <p className="hero-description">
              {t(
                'Photobooth untuk momen spontan Anda. Pilih layout, ambil foto, lalu buat strip yang terasa seperti Anda.',

                'A photobooth for your spontaneous moments. Choose a layout, take photos, and make a strip that feels like you.',
              )}
            </p>

            <button className="primary jumbo" onClick={() => setStep(1)}>
              {t('Mulai foto', 'Start snapping')} <span>↗</span>
            </button>

            <p className="privacy-line">
              ●{' '}
              {t(
                'Tanpa akun. Foto tetap di perangkat Anda.',

                'No account. Your photos stay on your device.',
              )}
            </p>
          </section>

          <section
            className="hero-art"

            aria-label={t(
              'Contoh ilustrasi photo strip',

              'Illustrated photo strip sample',
            )}
          >
            <div className="burst">
              say
              <br />
              cheese!
            </div>

            <div className="demo-strip">
              <div className="demo-photo mint">
                <span>☺</span>

                <i>✦</i>
              </div>

              <div className="demo-photo pink">
                <span>☻</span>

                <i>♡</i>
              </div>

              <div className="demo-photo yellow">
                <span>☺</span>

                <i>✧</i>
              </div>

              <strong>GOOD TIMES CLUB</strong>

              <small>boothpop / sample</small>
            </div>

            <span className="art-caption">
              {t(
                'Momen kecil. Layak disimpan.',
                'Little moments. Worth keeping.',
              )}
            </span>
          </section>

          <section className="feature-grid">
            {[
              [
                '01',

                t('Pilih gaya Anda', 'Pick your style'),

                t(
                  'Pilihan strip, polaroid, dan grid.',
                  'Strips, polaroids, and grids.',
                ),
              ],

              [
                '02',

                t('Bikin lebih personal', 'Make it yours'),

                t(
                  'Filter, bingkai, dan stiker sendiri.',

                  'Filters, frames, and your own stickers.',
                ),
              ],

              [
                '03',

                t('Simpan kenangannya', 'Keep the moment'),

                t(
                  'PNG berkualitas, langsung dari browser.',

                  'Quality PNG, straight from your browser.',
                ),
              ],
            ].map(([n, title, desc]) => (
              <article className="card feature" key={n}>
                <span className="feature-number">{n}</span>

                <h3>{title}</h3>

                <p>{desc}</p>
              </article>
            ))}
          </section>
        </main>
      ) : (
        <main className="studio">
          <nav
            className="progress"
            aria-label={t('Tahapan sesi', 'Session steps')}
          >
            {stepNames.map((name, i) => (
              <div
                key={name}

                className={
                  step === i + 1 ? 'current' : step > i + 1 ? 'completed' : ''
                }
              >
                <span>{step > i + 1 ? '✓' : i + 1}</span>

                <b>{name}</b>
              </div>
            ))}
          </nav>

          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t('STUDIO ANDA', 'YOUR STUDIO')} / 0{step}
              </span>

              <h1>
                {step === 1
                  ? t('Pilih gaya strip Anda.', 'Pick your strip style.')
                  : step === 2
                    ? t('Kamera siap. Anda siap?', 'Camera ready. You ready?')
                    : step === 3
                      ? t('Suka dengan hasilnya?', 'Love your shots?')
                      : t('Sentuhan terakhir Anda.', 'Your finishing touch.')}
              </h1>

              <p>
                {step === 1
                  ? t(
                      'Mulai dari layout. Sisanya, biarkan pose Anda bercerita.',

                      'Start with a layout. Let your poses tell the rest.',
                    )
                  : step === 2
                    ? t(
                        'Setiap foto punya hitung mundur. Preview dan hasil sama-sama mirror.',

                        'Each photo has a countdown. Both preview and saved photos are mirrored.',
                      )
                    : step === 3
                      ? t(
                          'Ulang satu pose tanpa kehilangan foto lainnya.',

                          'Retake one pose without losing your other photos.',
                        )
                      : t(
                          'Tambahkan sedikit warna, sedikit stiker, banyak karakter.',

                          'A little color, a few stickers, plenty of character.',
                        )}
              </p>
            </div>

            {step > 1 && (
              <button
                disabled={busy || exporting}

                onClick={() => {
                  setStep(step - 1);

                  setError('');
                }}
              >
                {t('← Kembali', '← Back')}
              </button>
            )}
          </div>

          {error && (
            <div className="notice pink" role="alert">
              {error}

              <button
                className="plain"

                onClick={() => setError('')}

                aria-label={t('Tutup pesan', 'Dismiss message')}
              >
                ×
              </button>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="layout-group-picker">
                <h3>{t('Jumlah foto', 'Number of photos')}</h3>
                <div className="segmented" role="group" aria-label={t('Kelompok layout berdasarkan jumlah foto', 'Layout groups by photo count')}>
                  {layoutCounts.map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={busy}
                      aria-pressed={layoutGroup === count}
                      className={layoutGroup === count ? 'active' : ''}
                      onClick={() => setLayoutGroup(count)}
                    >
                      {count} {t('foto', count === 1 ? 'photo' : 'photos')}
                    </button>
                  ))}
                </div>
                <p>{t('Layout terpilih: ', 'Selected layout: ')}<strong>{layout.label[lang === 'id' ? 0 : 1]}</strong> · {layout.count} {t('foto', 'photos')}</p>
              </div>
              <div className="layout-grid">
                {layouts.filter((candidate) => candidate.count === layoutGroup).map((l: Layout) => (
                  <button
                    className={
                      'layout-card ' + (layout.id === l.id ? 'chosen' : '')
                    }

                    key={l.id}

                    aria-pressed={layout.id === l.id}
                    disabled={busy}

                    onClick={() => {
                      if (
                        photos.length &&
                        layout.id !== l.id &&
                        !confirm(
                          t(
                            'Mengubah layout akan menghapus foto dan bingkai sesi ini. Lanjutkan?',

                            'Changing layout removes current photos and frame. Continue?',
                          ),
                        )
                      )
                        return;

                      if (layout.id !== l.id) {
                        setPhotos([]);

                        setFrame(null);

                        setStickers([]);
                      }

                      setLayout(l);

                      setError('');
                    }}
                  >
                    <div
                      className="mini-strip"

                      style={{
                        gridTemplateColumns: 'repeat(' + l.cols + ',1fr)',

                        ...(l.printSize
                          ? {
                              width:
                                Math.max(
                                  48,
                                  Math.round((148 * l.cmW!) / l.cmH!),
                                ) + 'px',

                              height: '148px',
                            }
                          : {}),
                      }}
                    >
                      {Array.from({ length: l.count }, (_, i) => (
                        <span key={i}>✦</span>
                      ))}
                    </div>

                    <strong>{l.label[lang === 'id' ? 0 : 1]}</strong>

                    <small>
                      {l.count} {t('pose', 'poses')} ·{' '}
                      {l.printSize ??
                        (l.cols === 1
                          ? t('Vertikal', 'Vertical')
                          : t('Dua kolom', 'Two columns'))}
                    </small>

                    {framePresets.some((preset) => preset.layoutId === l.id) && (
                      <small className="layout-template-badge">
                        {t('Ada template bingkai', 'Frame templates available')}
                      </small>
                    )}

                    <span className="check">
                      {layout.id === l.id ? '✓' : '+'}
                    </span>
                  </button>
                ))}
              </div>

              <section className="card session-config">
                <div>
                  <h3>{t('Waktu untuk bersiap', 'Time to get ready')}</h3>

                  <p>
                    {t(
                      'Hitung mundur sebelum setiap pose.',

                      'Countdown before every pose.',
                    )}
                  </p>
                </div>

                <div className="segmented">
                  {[3, 5, 10].map((n) => (
                    <button
                      key={n}

                      aria-pressed={timer === n}

                      className={timer === n ? 'active' : ''}

                      onClick={() => setTimer(n)}
                    >
                      {n}s
                    </button>
                  ))}
                </div>
              </section>

              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => goCamera()}
                >
                  {t('Lanjut ke kamera', 'Continue to camera')} ↗
                </button>

                <label className={'button ' + (busy ? 'disabled' : '')}>
                  {busy
                    ? t('Memproses…', 'Processing…')
                    : t('Upload foto dari galeri', 'Upload gallery photos')}

                  <input
                    disabled={busy}

                    type="file"

                    accept="image/jpeg,image/png,image/webp"

                    multiple

                    onChange={(e) => {
                      uploadPhotos(e.target.files);

                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <p className="helper">
                {t(
                  'Upload tepat ' +
                    layout.count +
                    ' foto. JPG, PNG, atau WebP • maksimal 10 MB per foto.',

                  'Upload exactly ' +
                    layout.count +
                    ' photos. JPG, PNG, or WebP • up to 10 MB each.',
                )}
              </p>
            </>
          )}

          {step === 2 && (
            <div className={'camera-workspace' + (layout.count === 1 ? ' camera-workspace-single' : '')}>
              {layout.count > 1 && (
                <aside className="capture-results capture-results-left" aria-label={t('Hasil foto sisi kiri', 'Captured photos on the left')}>
                  {Array.from({ length: layout.count }, (_, index) => index).filter((index) => index % 2 === 0).map((index) => (
                    <figure className={'capture-shot card' + (busy && pose === index ? ' capture-shot-current' : '')} key={index}>
                      {captureShots[index] ? <img src={captureShots[index]} alt={t('Hasil foto ' + (index + 1), 'Captured photo ' + (index + 1))} /> : <div className="capture-shot-placeholder" aria-hidden="true">{index + 1}</div>}
                      <figcaption>{t('Foto ', 'Photo ')}{index + 1}{captureShots[index] ? ' ✓' : ''}</figcaption>
                    </figure>
                  ))}
                </aside>
              )}
            <section className="camera-panel card">
              <div className="camera-top">
                <span className={'pill ' + (camera === 'ready' ? 'mint' : '')}>
                  {camera === 'ready'
                    ? t('● KAMERA AKTIF', '● CAMERA LIVE')
                    : t('KAMERA', 'CAMERA')}
                </span>

                <span>
                  {t('Pose', 'Pose')} {pose + 1} / {layout.count} · {timer}s
                </span>
              </div>

              <div className="viewfinder">
                <video
                  ref={video}

                  playsInline

                  muted

                  autoPlay

                  style={{ transform: 'scaleX(-1)' }}
                />

                {camera !== 'ready' && (
                  <div className="camera-placeholder">
                    <span>▣</span>

                    <h3>
                      {camera === 'loading'
                        ? t('Membuka kamera…', 'Opening camera…')
                        : t('Izinkan kamera Anda', 'Allow your camera')}
                    </h3>

                    <p>
                      {t(
                        'Kamera hanya digunakan untuk sesi foto ini.',

                        'Your camera is only used for this photo session.',
                      )}
                    </p>

                    <button
                      className="primary"

                      disabled={camera === 'loading'}

                      onClick={openCamera}
                    >
                      {camera === 'error'
                        ? t('Coba lagi', 'Try again')
                        : t('Aktifkan kamera', 'Enable camera')}
                    </button>
                  </div>
                )}

                {countdown !== null && (
                  <div className="countdown" aria-live="assertive">
                    {countdown}
                  </div>
                )}
              </div>

              <div className="camera-bottom">
                <p>
                  {retake !== null
                    ? t(
                        'Mengulang foto ' + (retake + 1),

                        'Retaking photo ' + (retake + 1),
                      )
                    : t(
                        layout.count + ' foto dalam satu sesi',

                        layout.count + ' photos in one session',
                      )}
                </p>

                <button
                  className="primary"

                  disabled={camera !== 'ready' || busy}

                  onClick={capture}
                >
                  {busy
                    ? t('Sedang mengambil foto…', 'Taking photos…')
                    : t('Ambil foto', 'Take photos')}{' '}
                  ●
                </button>

                {busy && (
                  <button
                    className="pink"

                    onClick={() => {
                      generation.current++;

                      captureBusy.current = false;

                      setBusy(false);

                      setCountdown(null);

                      setMessage(
                        t(
                          'Pengambilan dibatalkan. Foto sebelumnya tetap tersedia.',

                          'Capture cancelled. Previous photos are kept.',
                        ),
                      );
                    }}
                  >
                    {t('Batalkan', 'Cancel')}
                  </button>
                )}
              </div>
            </section>
              {layout.count > 1 && (
                <aside className="capture-results capture-results-right" aria-label={t('Hasil foto sisi kanan', 'Captured photos on the right')}>
                  {Array.from({ length: layout.count }, (_, index) => index).filter((index) => index % 2 === 1).map((index) => (
                    <figure className={'capture-shot card' + (busy && pose === index ? ' capture-shot-current' : '')} key={index}>
                      {captureShots[index] ? <img src={captureShots[index]} alt={t('Hasil foto ' + (index + 1), 'Captured photo ' + (index + 1))} /> : <div className="capture-shot-placeholder" aria-hidden="true">{index + 1}</div>}
                      <figcaption>{t('Foto ', 'Photo ')}{index + 1}{captureShots[index] ? ' ✓' : ''}</figcaption>
                    </figure>
                  ))}
                </aside>
              )}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="review-grid">
                {photos.map((src, i) => (
                  <article className="card review-photo" key={i}>
                    <img
                      src={src}
                      alt={t('Foto ' + (i + 1), 'Photo ' + (i + 1))}
                    />

                    <div>
                      <strong>0{i + 1}</strong>

                      <button onClick={() => goCamera(i)}>
                        {t('Ulang foto ini', 'Retake this photo')} ↻
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="actions">
                <button
                  className="primary"

                  disabled={photos.length !== layout.count}

                  onClick={() => setStep(4)}
                >
                  {t('Gunakan foto ini', 'Use these photos')} ↗
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        t(
                          'Ulang semua pose? Foto lama baru diganti setelah sesi berhasil.',

                          'Retake all poses? Old photos are replaced only after a successful session.',
                        ),
                      )
                    )
                      goCamera();
                  }}
                >
                  {t('Ulang semua', 'Retake all')}
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="editor">
              <section className="preview-panel card">
                <div className="preview-label">
                  <span className="pill mint">
                    {t('PREVIEW HASIL', 'YOUR PREVIEW')}
                  </span>

                  <span>
                    {exportFormat === 'gif' ? t('GIF · satu foto bergantian', 'GIF · one photo at a time') : <>{layout.printSize ? layout.printSize + ' · ' : ''}{g.width} × {g.height} px</>}
                  </span>
                </div>

                {(exportFormat === 'gif' ? gifPreview : preview) ? (
                  <div
                    className="preview-stage"
                  >
                  <img
                    className={'strip-preview' + (exportFormat === 'png' && g.height / g.width > 1.8 ? ' strip-preview-tall' : '')}

                    src={exportFormat === 'gif' ? gifPreview : preview}

                    alt={t(
                      'Preview hasil foto Anda',
                      'Your photo result preview',
                    )}
                  />
                  </div>
                ) : (
                  <p role="status">
                    {t('Membuat preview…', 'Preparing preview…')}
                  </p>
                )}
                <button
                  className="preview-detail-button"
                  disabled={!(exportFormat === 'gif' ? gifPreview : preview)}
                  onClick={() => setInfo('preview')}
                >
                  {t('Lihat detail foto', 'View photo details')} ↗
                </button>

                {layout.printSize && exportFormat === 'png' && (
                  <p className="helper">
                    {t('Ukuran cetak referensi: ', 'Reference print size: ')}
                    {layout.printSize}.{' '}
                    {t(
                      'Atur ukuran ini pada aplikasi cetak; PNG tidak mengatur ukuran kertas otomatis.',

                      'Set this size in your print app; the PNG does not automatically set paper dimensions.',
                    )}
                  </p>
                )}

                <p className="helper">
                  {t(
                    'Preview berubah mengikuti pengaturan Anda.',

                    'Preview updates with your settings.',
                  )}
                </p>
                <div className="gif-settings">
                  <h3>{t('Slideshow GIF', 'GIF slideshow')}</h3>
                  {photos.length >= 2 ? <>
                    <p>{t('Satu area foto menampilkan semua jepretan secara bergantian. Warna, filter, dekorasi, dan stiker ikut tersimpan. Template strip/grid hanya digunakan pada PNG.', 'One photo opening displays every shot in sequence. Color, filters, decorations, and stickers are included. Strip/grid templates apply only to PNG.')}</p>
                    <div className="segmented" role="group" aria-label={t('Interval slideshow GIF', 'GIF slideshow interval')}>
                      {([0.5, 1, 2] as const).map((seconds) => <button key={seconds} disabled={exporting} aria-pressed={gifSeconds === seconds} className={gifSeconds === seconds ? 'active' : ''} onClick={() => setGifSeconds(seconds)}>{lang === 'id' ? String(seconds).replace('.', ',') : seconds} {t('detik', 'seconds')}</button>)}
                    </div>
                  </> : <p>{t('GIF slideshow memerlukan minimal 2 foto. Layout ini tetap bisa diunduh sebagai PNG.', 'GIF slideshow needs at least 2 photos. This layout can still be downloaded as PNG.')}</p>}
                  <button className="plain" disabled={exporting} onClick={startOver}>{t('Mulai sesi baru', 'Start a new session')} ↻</button>
                </div>
              </section>

              <section className="controls card">
                <div className="tabs" role="tablist">
                  {[
                    ['frame', t('Bingkai', 'Frames')],

                    ['filter', t('Filter', 'Filters')],

                    ['sticker', t('Stiker', 'Stickers')],
                  ].map(([key, name]) => (
                    <button
                      key={key}

                      role="tab"

                      aria-selected={tab === key}

                      className={tab === key ? 'active' : ''}

                      onClick={() => setTab(key)}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {tab === 'frame' && (
                  <div className="control-body" role="tabpanel">
                    <h3>{t('Template bingkai', 'Frame templates')}</h3>
                    <p>
                      {t(
                        'Pilih desain siap pakai untuk layout Anda. Template langsung diterapkan ke preview dan hasil unduhan.',
                        'Choose a ready-made design for your layout. Templates apply to both the preview and download.',
                      )}
                    </p>
                    <div className="frame-preset-grid">
                      <button
                        type="button"
                        className={'frame-preset-card' + (!frame ? ' selected' : '')}
                        aria-pressed={!frame}
                        onClick={() => {
                          frameRequest.current += 1;
                          setLoadingPreset(null);
                          setFrame(null);
                        }}
                      >
                        <div className="frame-preset-plain" aria-hidden="true">
                          <span>▣</span>
                        </div>
                        <span>{t('Bingkai polos', 'Plain frame')}</span>
                        <small>{!frame ? t('✓ Dipilih', '✓ Selected') : t('Pilih bingkai', 'Select frame')}</small>
                      </button>
                      {availableFrames.map((preset: FramePreset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={'frame-preset-card' + (frame?.split('?')[0] === preset.src ? ' selected' : '')}
                          aria-pressed={frame?.split('?')[0] === preset.src}
                          disabled={loadingPreset !== null}
                          onClick={() => selectPreset(preset)}
                        >
                          <img src={preset.src} alt={preset.name} loading="lazy" />
                          <span>{preset.name}</span>
                          <small>
                            {loadingPreset === preset.id
                              ? t('Memuat…', 'Loading…')
                              : frame?.split('?')[0] === preset.src
                                ? t('✓ Dipilih', '✓ Selected')
                                : t('Pilih bingkai', 'Select frame')}
                          </small>
                        </button>
                      ))}
                    </div>
                    {availableFrames.length === 0 && (
                      <p className="frame-preset-empty">
                        {t('Belum ada template untuk layout ini.', 'No templates for this layout yet.')}
                        {layoutsWithFrames.length > 0 && (
                          <> {' '}{t('Template tersedia untuk: ', 'Templates available for: ')}
                            {layoutsWithFrames.map((candidate) => candidate.label[lang === 'id' ? 0 : 1]).join(', ')}.
                          </>
                        )}
                      </p>
                    )}
                    <hr />
                    <h3>{t('Warna bingkai', 'Frame color')}</h3>
                    {frame && (
                      <p>{t('Warna mengisi bagian transparan di luar foto. Pilih Bingkai polos untuk menggunakan warna tanpa desain.', 'Color fills transparent areas outside the photos. Choose Plain frame to use color without a design.')}</p>
                    )}

                    <div className="swatches">
                      {[
                        '#FFFFFF',

                        '#F6CE46',

                        '#F97CC4',

                        '#ABE890',

                        '#99C2FF',

                        '#111111',
                      ].map((c) => (
                        <button
                          key={c}

                          aria-label={c}

                          aria-pressed={color === c}

                          className={color === c ? 'selected' : ''}

                          style={{
                            background: c,

                            color: c === '#111111' ? '#FFFFFF' : '#111111',
                          }}

                          onClick={() => setColor(c)}
                        >
                          {color === c ? '✓' : ''}
                        </button>
                      ))}
                    </div>

                    <label className="color-input">
                      {t('Warna sendiri', 'Custom color')}

                      <input
                        type="color"

                        value={color}

                        onChange={(e) => setColor(e.target.value)}
                      />

                      <code>{color}</code>
                    </label>

                    <details className="custom-frame-tools">
                    <summary>{t('Bingkai buatan Anda', 'Your custom frame')}</summary>
                    <div className="custom-frame-body">

                    <p>
                      {t(
                        'PNG transparan, maksimal 10 MB. Ukuran wajib:',

                        'Transparent PNG, up to 10 MB. Required size:',
                      )}{' '}
                      <strong>
                        {g.width} × {g.height} px
                      </strong>
                      .
                    </p>

                    <p>
                      {t(
                        'Area foto harus tetap transparan. Jangan mengubah ukuran kanvas atau posisi lubang foto.',

                        'Keep photo openings transparent. Do not change canvas dimensions or photo opening positions.',
                      )}
                    </p>
                    <p>{t('Upload di sini hanya berlaku untuk sesi Anda.', 'Uploads here apply only to your session.')}</p>

                    <div className="custom-frame-actions">
                      <button onClick={() => template(false)}>
                        {t(
                          '↓ Unduh template bingkai',
                          '↓ Download frame template',
                        )}
                      </button>

                      <button onClick={() => template(true)}>
                        {t(
                          '↓ Unduh panduan posisi foto',
                          '↓ Download placement guide',
                        )}
                      </button>

                      <label className="button primary">
                        {t('Upload bingkai', 'Upload frame')}

                        <input
                          type="file"

                          accept="image/png"

                          onChange={(e) => {
                            uploadAsset(e.target.files?.[0], 'frame');

                            e.target.value = '';
                          }}
                        />
                      </label>

                      {frame && (
                        <button
                          className="pink"
                          onClick={() => {
                            frameRequest.current += 1;
                            setLoadingPreset(null);
                            setFrame(null);
                          }}
                        >
                          {t('Hapus bingkai', 'Remove frame')}
                        </button>
                      )}
                    </div>
                    </div>
                    </details>
                  </div>
                )}

                {tab === 'filter' && (
                  <div className="control-body" role="tabpanel">
                    <h3>{t('Pilih suasana', 'Pick a mood')}</h3>

                    <p>
                      {t(
                        'Filter diterapkan pada semua foto. Foto asli tetap dipertahankan.',

                        'Filters apply to all photos. Original photos are kept.',
                      )}
                    </p>

                    <div className="filter-options">
                      {photoFilters.map(({ id: key, name }) => (
                        <button
                          className={filter === key ? 'mint' : ''}

                          key={key}

                          aria-pressed={filter === key}

                          onClick={() => setFilter(key)}
                        >
                          {name} {filter === key ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                    <p className="filter-description" role="status">
                      {photoFilters.find((item) => item.id === filter)?.description[lang === 'id' ? 0 : 1]}
                    </p>
                    <label className="slider" htmlFor="filter-intensity">
                      <span>{t('Intensitas filter', 'Filter intensity')}</span>
                      <output htmlFor="filter-intensity">{filterIntensity}%</output>
                      <input id="filter-intensity" type="range" min="0" max="100" step="1" value={filterIntensity} disabled={filter === 'original' || exporting} aria-valuetext={filterIntensity + '%'} onChange={(event) => setFilterIntensity(Number(event.target.value))} />
                    </label>
                    <p className="helper">{filter === 'original'
                      ? t('Pilih filter untuk mengatur intensitas. Film FX tetap dapat digunakan pada Original.', 'Choose a filter to adjust its intensity. Film FX can still be used with Original.')
                      : t('0% menggunakan warna asli; 100% menggunakan efek penuh. Film FX diatur secara terpisah.', '0% uses original colors; 100% applies the full filter. Film FX is controlled separately.')}</p>
                    <details className="custom-frame-tools film-fx-tools">
                      <summary>Film FX</summary>
                      <div className="custom-frame-body">
                        <p>{t('Tambahkan tekstur film, tepi gelap, atau cahaya hangat dari sisi kiri. Bisa dipakai dengan semua filter.', 'Add film texture, dark edges, or warm light from the left. Works with every filter.')}</p>
                        {filter === 'film' && <p className="helper">{t('Preset Film sudah memiliki grain dan vignette halus. Slider ini menambahkan efek di atas preset tersebut.', 'The Film preset already includes subtle grain and vignette. These sliders add effects on top of that preset.')}</p>}
                        {([
                          ['grain', t('Grain', 'Grain')],
                          ['vignette', t('Vignette', 'Vignette')],
                          ['lightLeak', t('Bocoran cahaya', 'Light leak')],
                        ] as const).map(([key, label]) => <label className="slider" key={key} htmlFor={'fx-' + key}>
                          <span>{label}</span><output htmlFor={'fx-' + key}>{filmFx[key]}%</output>
                          <input id={'fx-' + key} type="range" min="0" max="100" step="1" value={filmFx[key]} disabled={exporting} aria-valuetext={filmFx[key] + '%'} onChange={(event) => setFilmFx((previous) => ({ ...previous, [key]: Number(event.target.value) }))} />
                        </label>)}
                        <button type="button" disabled={exporting || Object.values(filmFx).every((value) => value === 0)} onClick={() => setFilmFx({ ...defaultFilmFx })}>{t('Reset Film FX', 'Reset Film FX')}</button>
                      </div>
                    </details>
                  </div>
                )}

                {tab === 'sticker' && (
                  <div className="control-body" role="tabpanel">
                    <h3>{t('Sedikit dekorasi', 'A little decoration')}</h3>

                    <div className="segmented">
                      {[
                        ['none', t('Tanpa', 'None')],

                        ['stars', '✦'],

                        ['hearts', '♡'],
                      ].map(([key, name]) => (
                        <button
                          key={key}

                          className={decoration === key ? 'active' : ''}

                          aria-pressed={decoration === key}

                          onClick={() => setDecoration(key)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>

                    <hr />

                    <h3>
                      {t('Upload stiker sendiri', 'Upload your own sticker')}
                    </h3>

                    <p>
                      {t(
                        'PNG atau WebP, maksimal 5 MB. Disarankan transparan dan minimal 256 × 256 px. Maksimal 10 stiker.',

                        'PNG or WebP, up to 5 MB. Transparent images of at least 256 × 256 px recommended. Up to 10 stickers.',
                      )}
                    </p>

                    <label className="button primary">
                      {t('+ Upload stiker', '+ Upload sticker')}

                      <input
                        type="file"

                        accept="image/png,image/webp"

                        onChange={(e) => {
                          uploadAsset(e.target.files?.[0], 'sticker');

                          e.target.value = '';
                        }}
                      />
                    </label>

                    {stickers.length > 0 && (
                      <>
                        <div className="sticker-list">
                          {stickers.map((s, i) => (
                            <button
                              key={s.id}

                              className={selected === s.id ? 'mint' : ''}

                              aria-pressed={selected === s.id}

                              onClick={() => setSelected(s.id)}
                            >
                              {t('Stiker', 'Sticker')} {i + 1}
                            </button>
                          ))}
                        </div>

                        {activeSticker && (
                          <>
                            <h4>
                              {t(
                                'Atur stiker terpilih',
                                'Adjust selected sticker',
                              )}
                            </h4>

                            {[
                              [
                                'x',

                                t('Posisi horizontal', 'Horizontal position'),

                                0,

                                100,
                              ],

                              [
                                'y',
                                t('Posisi vertikal', 'Vertical position'),
                                0,
                                100,
                              ],

                              ['size', t('Ukuran', 'Size'), 5, 60],

                              ['rotation', t('Rotasi', 'Rotation'), -180, 180],
                            ].map(([key, name, min, max]) => (
                              <label className="slider" key={String(key)}>
                                {name}

                                <span>
                                  {
                                    activeSticker[
                                      key as 'x' | 'y' | 'size' | 'rotation'
                                    ]
                                  }
                                </span>

                                <input
                                  type="range"

                                  min={Number(min)}

                                  max={Number(max)}

                                  value={
                                    activeSticker[
                                      key as 'x' | 'y' | 'size' | 'rotation'
                                    ]
                                  }

                                  onChange={(e) =>
                                    updateSticker(
                                      key as 'x' | 'y' | 'size' | 'rotation',

                                      Number(e.target.value),
                                    )
                                  }
                                />
                              </label>
                            ))}

                            <button
                              className="pink"

                              onClick={() => {
                                setStickers((old) =>
                                  old.filter((s) => s.id !== selected),
                                );

                                setSelected('');
                              }}
                            >
                              {t(
                                'Hapus stiker terpilih',
                                'Remove selected sticker',
                              )}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

              </section>
                <div className="export-actions" role="region" aria-label={t('Simpan hasil foto', 'Save photo results')}>
                  <div className="export-actions-copy">
                    <strong>{t('Sudah cocok dengan hasilnya?', 'Happy with your photos?')}</strong>
                    <span>{t('Simpan sebelum memulai sesi baru.', 'Save before starting a new session.')}</span>
                  </div>
                  <label className="export-format">
                    <span>{t('Format', 'Format')}</span>
                    <select value={exportFormat} disabled={exporting} onChange={(event) => setExportFormat(event.target.value as 'png' | 'gif')}>
                      <option value="png">PNG</option>
                      <option value="gif" disabled={photos.length < 2}>GIF</option>
                    </select>
                  </label>
                  <button
                    className="primary"

                    disabled={exporting || !preview}

                    onClick={exportPhoto}
                  >
                    {exporting
                      ? t('Menyiapkan… ', 'Preparing… ') + gifProgress
                      : t('↓ Unduh ', '↓ Download ') + exportFormat.toUpperCase()}
                  </button>

                </div>
            </div>
          )}

          <p className="session-note">
            {t(
              'Foto hanya tersedia selama sesi ini. Refresh atau menutup tab akan menghapus sesi.',

              'Photos are available only during this session. Refreshing or closing the tab clears your session.',
            )}
          </p>
        </main>
      )}

      <footer>
        <span>
          BOOTHPOP / {t('dibuat untuk momen Anda', 'made for your moments')}
        </span>

        <div className="footer-links">
          {donationUrl && (
            <a
              className="button donate-button"

              href={donationUrl}

              target="_blank"

              rel="noopener noreferrer"
            >
              {t('♡ Dukung BOOTHPOP', '♡ Support BOOTHPOP')}
            </a>
          )}

          <button className="plain" onClick={() => setInfo('privacy')}>
            {t('Privasi foto', 'Photo privacy')} ↗
          </button>
        </div>
      </footer>

      {message && (
        <div className="toast mint" role="status">
          {message}
        </div>
      )}

      {info && (
        <div className="modal-overlay" onClick={() => setInfo(null)}>
          <section
            className={'card modal' + (info === 'preview' ? ' preview-detail-modal' : '')}

            role="dialog"

            aria-modal="true"

            aria-label={
              info === 'preview' ? t('Detail foto', 'Photo details') : info === 'help'
                ? t('Cara pakai', 'How it works')
                : t('Privasi foto', 'Photo privacy')
            }

            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"

              onClick={() => setInfo(null)}

              autoFocus

              aria-label={t('Tutup', 'Close')}
            >
              ×
            </button>

            <h2>
              {info === 'preview' ? t('Detail foto', 'Photo details') : info === 'help'
                ? t('Dari pose ke kenangan.', 'From poses to memories.')
                : t('Foto Anda, perangkat Anda.', 'Your photos, your device.')}
            </h2>

            {info === 'preview' ? (
              <img
                className="preview-detail-image"
                src={exportFormat === 'gif' ? gifPreview : preview}
                alt={t('Detail hasil foto Anda', 'Detailed view of your photo result')}
              />
            ) : info === 'help' ? (
              <ol>
                <li>
                  {t('Pilih layout dan timer.', 'Choose a layout and timer.')}
                </li>

                <li>
                  {t(
                    'Aktifkan kamera atau upload foto dari galeri.',

                    'Enable your camera or upload gallery photos.',
                  )}
                </li>

                <li>
                  {t(
                    'Review dan ulang foto jika perlu.',
                    'Review and retake if needed.',
                  )}
                </li>

                <li>
                  {t(
                    'Pilih filter, bingkai, dan stiker; lalu unduh PNG.',

                    'Choose filters, frames, and stickers; then download your PNG.',
                  )}
                </li>
              </ol>
            ) : (
              <>
                <p>
                  {t(
                    'Foto, bingkai, dan stiker upload diproses di browser. Aplikasi ini tidak mengunggahnya ke server dan tidak memiliki akun atau database foto.',

                    'Photos, frames, and uploaded stickers are processed in your browser. This app does not upload them to a server and has no account or photo database.',
                  )}
                </p>

                <p>
                  {t(
                    'Sesi tersimpan sementara dalam memori. Refresh atau menutup halaman akan menghapus sesi. Penyedia hosting tetap dapat memiliki log permintaan website sesuai kebijakannya.',

                    'Sessions are held temporarily in memory. Refreshing or closing the page clears them. The hosting provider may retain website request logs under its own policy.',
                  )}
                </p>
              </>
            )}

            <button className="primary" onClick={() => setInfo(null)}>
              {info === 'preview' ? t('Tutup detail', 'Close details') : t('Mengerti', 'Got it')}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
