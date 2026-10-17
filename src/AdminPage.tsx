import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CatalogConfig } from './frame-catalog';
import { layouts, geometry } from './layout.mjs';
import { prepareAdminFrame, ADMIN_FRAME_TARGET_BYTES } from './admin-frame';
import { layoutCoverage } from './admin-coverage';
import { canvasBlob, downloadBlob, frameTemplate } from './canvas';
import { createAdminClient, listAdminTemplates, addAdminTemplate, editAdminTemplate, deleteAdminTemplate, type AdminTemplate } from './admin-api';
import './admin.css';

export default function AdminPage({ config }: { config: CatalogConfig | null }) {
  const [client] = useState(() => config ? createAdminClient(config) : null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState<'checking' | 'admin' | 'denied'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState<AdminTemplate[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [name, setName] = useState('');
  const [layoutId, setLayoutId] = useState('strip4');
  const [sortOrder, setSortOrder] = useState(1);
  const [active, setActive] = useState(false);
  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [prepared, setPrepared] = useState<{ blob: Blob; url: string; originalSize: number } | null>(null);
  const [search, setSearch] = useState('');
  const [listLayout, setListLayout] = useState('all');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'missing' | 'available'>('missing');
  const version = useRef(0), fileVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const currentLayout = layouts.find((item) => item.id === layoutId)!;
  const size = geometry(currentLayout);

  useEffect(() => {
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, value) => {
      version.current++;
      setSession(value); setAuthReady(true); setRows([]); setAccess('checking');
      if (!value) { setPrepared(null); setEditing(null); setPassword(''); }
    });
    return () => { subscription.unsubscribe(); version.current++; fileVersion.current++; };
  }, [client]);
  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);

  async function refresh() {
    if (!client) return;
    const request = ++version.current;
    setAccess('checking');
    try {
      const result = await listAdminTemplates(client);
      if (request !== version.current) return;
      setRows(result); setAccess('admin');
    } catch (cause) {
      if (request !== version.current) return;
      setRows([]); setAccess('denied'); setError((cause as Error).message);
    }
  }
  useEffect(() => { if (session) void refresh(); }, [session]);

  async function login(event: FormEvent) {
    event.preventDefault(); if (!client || busy) return;
    setBusy(true); setError('');
    try {
      const { error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) setError('Login gagal. Periksa email, password akun admin, dan koneksi Anda.');
    } catch { setError('Login belum berhasil. Periksa koneksi dan coba lagi.'); }
    finally { setPassword(''); setBusy(false); }
  }
  async function logout() {
    if (!client || busy || preparing) return;
    setBusy(true);
    try { const { error: logoutError } = await client.auth.signOut({ scope: 'local' }); if (logoutError) throw logoutError; setMessage(''); setError(''); }
    catch { setError('Keluar belum berhasil. Coba lagi.'); }
    finally { setBusy(false); }
  }
  function resetForm() {
    fileVersion.current++; setPrepared(null); setEditing(null); setName(''); setSortOrder(1); setActive(false);
    if (fileInput.current) fileInput.current.value = '';
  }
  function addForLayout(id: string) {
    if (busy || preparing) return;
    resetForm(); setLayoutId(id); setListLayout(id); setSearch(''); setError(''); setMessage('');
    setSortOrder(Math.min(999999, Math.max(0, ...rows.map((row) => row.sort_order)) + 1));
    document.querySelector('.admin-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function downloadPattern(guide: boolean) {
    try { downloadBlob(await canvasBlob(frameTemplate(currentLayout, guide)), `boothpop-${layoutId}-${guide ? 'panduan' : 'pola'}.png`); }
    catch { setError('Pola bingkai gagal diunduh. Silakan coba lagi.'); }
  }
  async function pickFile(file: File | undefined) {
    if (!file) return;
    const request = ++fileVersion.current;
    setPreparing(true); setPrepared(null); setError(''); setMessage('');
    try {
      const blob = await prepareAdminFrame(file, currentLayout);
      if (request !== fileVersion.current) return;
      setPrepared({ blob, url: URL.createObjectURL(blob), originalSize: file.size });
    } catch (cause) { if (request === fileVersion.current) setError((cause as Error).message); }
    finally { if (request === fileVersion.current) setPreparing(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!client || busy || preparing) return;
    if (!editing && !prepared) { setError('Pilih gambar bingkai yang valid terlebih dahulu.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (editing) await editAdminTemplate(client, editing.id, { name, sortOrder, active });
      else await addAdminTemplate(client, { name, sortOrder, active, layoutId, blob: prepared!.blob });
      resetForm(); await refresh(); setMessage('Template tersimpan. Muat ulang halaman photobooth untuk melihat katalog terbaru.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function toggle(row: AdminTemplate) {
    if (!client || busy || preparing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await editAdminTemplate(client, row.id, { name: row.name, sortOrder: row.sort_order, active: !row.is_active });
      await refresh(); setMessage(row.is_active ? 'Template dinonaktifkan.' : 'Template diaktifkan.');
      if (editing?.id === row.id) setActive(!row.is_active);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(row: AdminTemplate) {
    if (!client || busy || preparing || !confirm(`Hapus template "${row.name}" beserta gambarnya? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const warning = await deleteAdminTemplate(client, row);
      if (editing?.id === row.id) resetForm();
      await refresh(); setMessage(warning ?? 'Template dan gambar berhasil dihapus.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  const visible = rows.filter((row) => (listLayout === 'all' || row.layout_id === listLayout) && `${row.name} ${row.id}`.toLowerCase().includes(search.toLowerCase()));
  const coverage = layoutCoverage(layouts, rows);
  const missing = coverage.filter((item) => item.total === 0).length;
  const shownCoverage = coverage.filter((item) => coverageFilter === 'all' || (coverageFilter === 'missing' ? item.total === 0 : item.total > 0));
  return <div className="app admin-app">
    <header>
      <a className="wordmark admin-brand" href="#">BOOTHPOP <span className="pill yellow">ADMIN</span></a>
      <div className="header-actions"><a className="button" href="#">Ke photobooth ↗</a>{session && <button disabled={busy || preparing} onClick={logout}>Keluar</button>}</div>
    </header>
    <main className="admin-main">
      <div className="section-heading"><div><span className="eyebrow">KELOLA DESAIN</span><h1>Studio bingkai Anda.</h1><p>Tambahkan desain baru dan atur template yang dilihat pengunjung.</p></div></div>
      {error && <div className="notice pink" role="alert"><span>{error}</span><button className="plain" aria-label="Tutup pesan kesalahan" onClick={() => setError('')}>×</button></div>}
      {message && <div className="notice mint" role="status">{message}</div>}
      {!client ? <section className="card admin-login"><h2>Konfigurasi belum tersedia</h2><p>Isi URL Supabase dan publishable key pada environment website, lalu restart atau deploy ulang.</p></section>
        : !authReady ? <p role="status">Memeriksa sesi…</p>
        : !session ? <form className="card admin-login" onSubmit={login}>
          <span className="pill mint">KHUSUS ADMIN</span><h2>Masuk ke studio.</h2><p>Gunakan akun email admin yang dibuat di Supabase Authentication.</p>
          <label>Email<input required type="email" autoComplete="username" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
          <p className="helper">Tidak ada pendaftaran publik. Akun dan hak admin ditetapkan oleh pemilik project.</p>
        </form>
        : access === 'checking' ? <p role="status">Memeriksa hak admin dan memuat template…</p>
        : access === 'denied' ? <section className="card admin-login"><h2>Akses admin diperlukan.</h2><p>Akun: {session.user.email}. Pemilik project perlu memberikan hak admin terlebih dahulu.</p><button disabled={busy} onClick={() => { setError(''); void refresh(); }}>Periksa lagi</button></section>
        : <>
          <div className="admin-summary"><span>{rows.length} template</span><span>{rows.filter((row) => row.is_active).length} aktif</span><small>{session.user.email}</small><button disabled={busy || preparing} onClick={() => { setError(''); void refresh(); }}>Muat ulang</button></div>
          <details className="card admin-coverage">
            <summary>Ketersediaan template per layout <span>{missing} belum ada · {coverage.length - missing} sudah ada</span></summary>
            <div className="admin-coverage-body">
              <p>Pilih layout untuk melihat desain yang tersedia atau menambahkan desain baru. Template nonaktif tetap dihitung sebagai sudah ada.</p>
              <div className="segmented" role="group" aria-label="Filter ketersediaan template">
                {([
                  ['missing', `Belum ada (${missing})`],
                  ['available', `Sudah ada (${coverage.length - missing})`],
                  ['all', `Semua (${coverage.length})`],
                ] as const).map(([key, title]) => <button key={key} aria-pressed={coverageFilter === key} className={coverageFilter === key ? 'active' : ''} onClick={() => setCoverageFilter(key)}>{title}</button>)}
              </div>
              <div className="admin-coverage-grid">{shownCoverage.map(({ layout, total, active: activeCount }) => {
                const g = geometry(layout);
                return <article className="admin-layout-card" key={layout.id}>
                  <svg viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={`${layout.label[0]}, ${layout.count} foto`}>
                    <rect width={g.width} height={g.height} fill="#fff" stroke="#111" strokeWidth={g.width * 0.025} />
                    {g.slots.map((slot, index) => <rect key={index} x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill="#abe890" stroke="#111" strokeWidth={g.width * 0.01} />)}
                  </svg>
                  <h3>{layout.label[0]}</h3>
                  <p>{layout.count} foto · {g.width} × {g.height} px</p>
                  <small>{total === 0 ? 'Belum ada desain' : `${total} desain tersimpan · ${activeCount} aktif`}</small>
                  <div className="admin-layout-actions">
                    {total > 0 && <button disabled={busy || preparing} onClick={() => { setListLayout(layout.id); setSearch(''); document.querySelector('.admin-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Lihat desain</button>}
                    <button className={total === 0 ? 'primary' : ''} disabled={busy || preparing} onClick={() => addForLayout(layout.id)}>{total === 0 ? 'Tambah template' : '+ Tambah desain'}</button>
                  </div>
                </article>;
              })}</div>
              {shownCoverage.length === 0 && <p role="status">Tidak ada layout pada kategori ini.</p>}
            </div>
          </details>
          <div className="admin-workspace">
            <form className="card admin-form" onSubmit={save}>
              <h2>{editing ? 'Edit template' : 'Tambah template'}</h2>
              <label>Nama template<input required maxLength={100} value={name} disabled={busy || preparing} onChange={(event) => setName(event.target.value)} /></label>
              <label>Layout<select value={layoutId} disabled={busy || preparing || !!editing} onChange={(event) => { setLayoutId(event.target.value); setPrepared(null); if (fileInput.current) fileInput.current.value = ''; }}>{coverage.map(({ layout, total }) => <option key={layout.id} value={layout.id}>{layout.label[0]} · {total ? `${total} desain` : 'belum ada template'}</option>)}</select></label>
              <p className="helper">Ukuran wajib: <strong>{size.width} × {size.height} px</strong>. Lubang foto harus transparan.</p>
              {!editing && <div className="admin-pattern-actions"><button type="button" disabled={busy || preparing} onClick={() => void downloadPattern(false)}>↓ Pola bingkai</button><button type="button" disabled={busy || preparing} onClick={() => void downloadPattern(true)}>↓ Panduan posisi</button><small>Gunakan pola ini untuk membuat desain sesuai layout pilihan.</small></div>}
              <label>Urutan tampil<input type="number" min={0} max={999999} step={1} required value={sortOrder} disabled={busy || preparing} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
              {!editing && <label className="button admin-file-picker">{preparing ? 'Memeriksa dan mengompres…' : 'Pilih PNG / WebP'}<input ref={fileInput} type="file" accept="image/png,image/webp" disabled={busy || preparing} onChange={(event) => void pickFile(event.target.files?.[0])} /></label>}
              {(prepared || editing) && <div className="admin-file-preview"><img src={prepared?.url ?? `${config!.url}/storage/v1/object/public/frames/${encodeURIComponent(editing!.image_path)}`} alt="Preview bingkai yang akan disimpan" />{prepared && <>
                <small>WebP · {(prepared.originalSize / 1024).toFixed(1)} KB → {(prepared.blob.size / 1024).toFixed(1)} KB{prepared.blob.size < prepared.originalSize ? ` · hemat ${Math.round((1 - prepared.blob.size / prepared.originalSize) * 100)}%` : ''}</small>
                <small>{prepared.blob.size > ADMIN_FRAME_TARGET_BYTES ? 'Hasil masih di atas target 500 KB agar kualitas dan ukuran kanvas tetap terjaga. Periksa preview sebelum menyimpan.' : 'Ukuran dan transparansi terjaga. Periksa seluruh area foto sebelum menyimpan.'}</small>
              </>}</div>}
              <label className="admin-checkbox"><input type="checkbox" checked={active} disabled={busy || preparing} onChange={(event) => setActive(event.target.checked)} />Tampilkan untuk pengunjung</label>
              <button className="primary" disabled={busy || preparing || (!editing && !prepared)}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan template'}</button>
              <button type="button" disabled={busy || preparing} onClick={resetForm}>{editing ? 'Batal edit' : 'Bersihkan formulir'}</button>
              <p className="helper">Input maksimal 10 MB. Upload otomatis menjadi WebP dengan target sekitar 500 KB. Dimensi kanvas tetap. Untuk mengganti gambar, tambahkan desain baru dengan file baru.</p>
            </form>
            <section className="admin-catalog" aria-label="Daftar template">
              <div className="admin-search"><label>Cari template<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama atau kode desain" /></label><label>Layout<select value={listLayout} onChange={(event) => setListLayout(event.target.value)}><option value="all">Semua layout</option>{layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label[0]}</option>)}</select></label></div>
              {visible.length === 0 && <p className="card admin-empty">Belum ada template yang cocok.</p>}
              <div className="admin-template-grid">{visible.map((row) => <article className="card admin-template" key={row.id}>
                <img src={`${config!.url}/storage/v1/object/public/frames/${encodeURIComponent(row.image_path)}`} alt={row.name} loading="lazy" />
                <div className="admin-template-heading"><h3>{row.name}</h3><span className={'pill ' + (row.is_active ? 'mint' : '')}>{row.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
                <p>{layouts.find((layout) => layout.id === row.layout_id)?.label[0] ?? row.layout_id} · Urutan {row.sort_order}</p>
                <div className="admin-template-actions">
                  <button disabled={busy || preparing} onClick={() => { resetForm(); setEditing(row); setName(row.name); setLayoutId(row.layout_id); setSortOrder(row.sort_order); setActive(row.is_active); setError(''); setMessage(''); document.querySelector('.admin-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Edit</button>
                  <button disabled={busy || preparing} onClick={() => void toggle(row)}>{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="pink" disabled={busy || preparing} onClick={() => void remove(row)}>Hapus</button>
                </div>
              </article>)}</div>
            </section>
          </div>
        </>}
    </main>
  </div>;
}
