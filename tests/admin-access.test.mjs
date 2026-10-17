import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Admin SQL enforces privileges and RLS in PostgreSQL', async (t) => {
  const db = new PGlite();
  const admin = '00000000-0000-4000-8000-000000000001';
  const member = '00000000-0000-4000-8000-000000000002';
  async function asRole(role, user, run) {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
    try { return await run(); }
    finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
  }
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create schema storage;
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
      alter table storage.objects enable row level security;
      grant usage on schema public, auth, storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/01_schema.sql', import.meta.url), 'utf8'));
    const migration = await readFile(new URL('../supabase/04_admin_access.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`
      insert into auth.users values ('${admin}'), ('${member}');
      insert into boothpop_private.admins(user_id) values ('${admin}');
      insert into public.photo_layouts values ('strip4','Strip 4','Strip 4',4,720,2140);
      insert into public.frame_templates(id,name,layout_id,image_path,is_active) values
        ('existing','Public','strip4','seed.webp',true), ('hidden','Draft','strip4','draft.webp',false);
      insert into storage.objects(bucket_id,name) values ('frames','seed.webp');
    `);
    await t.test('Visitors see active metadata but cannot write', async () => {
      await asRole('anon', null, async () => {
        assert.deepEqual((await db.query('select id from public.frame_templates')).rows, [{ id: 'existing' }]);
        await assert.rejects(db.exec("insert into public.frame_templates(id,name,layout_id,image_path) values ('bad','Bad','strip4','bad.webp')"), { code: '42501' });
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('frames','bad.webp')"), { code: '42501' });
      });
    });
    await t.test('Signed-in non-admin cannot upload, edit, delete, or self-promote', async () => {
      await asRole('authenticated', member, async () => {
        assert.equal((await db.query('select public.is_boothpop_admin() as admin')).rows[0].admin, false);
        assert.deepEqual((await db.query('select id from public.frame_templates')).rows, [{ id: 'existing' }]);
        await assert.rejects(db.exec("insert into public.frame_templates(id,name,layout_id,image_path) values ('bad','Bad','strip4','bad.webp')"), { code: '42501' });
        assert.deepEqual((await db.query("update public.frame_templates set name='Changed' where id='existing' returning id")).rows, []);
        assert.deepEqual((await db.query("delete from public.frame_templates where id='existing' returning id")).rows, []);
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('frames','bad.webp')"), { code: '42501' });
        await assert.rejects(db.exec(`insert into boothpop_private.admins(user_id) values ('${member}')`), { code: '42501' });
      });
    });
    await t.test('Admin sees drafts, uploads in frames only, and manages metadata', async () => {
      await asRole('authenticated', admin, async () => {
        assert.equal((await db.query('select public.is_boothpop_admin() as admin')).rows[0].admin, true);
        assert.equal((await db.query('select id from public.frame_templates')).rows.length, 2);
        await db.exec("insert into storage.objects(bucket_id,name) values ('frames','new.webp')");
        await db.exec("insert into public.frame_templates(id,name,layout_id,image_path) values ('new','New','strip4','new.webp')");
        assert.equal((await db.query("update public.frame_templates set is_active=true where id='new' returning id")).rows.length, 1);
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('other','other.webp')"), { code: '42501' });
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('frames','file.html')"), { code: '42501' });
      });
    });
    await t.test('Admin cannot delete a referenced image; deletion works after metadata removal', async () => {
      await asRole('authenticated', admin, async () => {
        assert.deepEqual((await db.query("delete from storage.objects where name='new.webp' returning name")).rows, []);
        await db.exec("delete from public.frame_templates where id='new'");
        assert.deepEqual((await db.query("delete from storage.objects where name='new.webp' returning name")).rows, [{ name: 'new.webp' }]);
      });
    });
    await t.test('Revoking admin membership removes write access even with the same user ID', async () => {
      await db.exec(`delete from boothpop_private.admins where user_id='${admin}'`);
      await asRole('authenticated', admin, async () => {
        assert.equal((await db.query('select public.is_boothpop_admin() as admin')).rows[0].admin, false);
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('frames','revoked.webp')"), { code: '42501' });
      });
    });
  } finally { await db.close(); }
});
