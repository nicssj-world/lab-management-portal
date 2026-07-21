-- Public "เอกสารที่เกี่ยวข้อง" page — admin-managed sections
-- Run in Supabase Dashboard > SQL Editor
--
-- kind='manual' = section ที่แอดมินสร้างเองและเลือกเอกสารเข้าไป
-- kind='auto'   = แถบจัดกลุ่มอัตโนมัติของเอกสารที่ยังไม่ถูกจัดเข้า section ใด
--                 (settings เก็บโหมดจัดกลุ่ม / กลุ่มที่ซ่อน / ชื่อที่เปลี่ยน)

create table if not exists public_document_sections (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'manual' check (kind in ('manual','auto')),
  title_th         text not null,
  title_en         text not null default '',
  description_th   text,
  description_en   text,
  icon             text not null default 'doc',        -- key ใน ICONS map เท่านั้น
  sort_order       int  not null default 0,
  visible          boolean not null default true,
  default_expanded boolean not null default false,
  hot              boolean not null default false,   -- แสดงป้าย "Hot!!" แบบเดียวกับ NEW ในหน้าข่าวสาร
  settings         jsonb not null default '{}'::jsonb, -- ใช้เมื่อ kind='auto'
  updated_at       timestamptz not null default now(),
  updated_by       uuid references profiles(id) on delete set null
);

-- ไฟล์ที่แอดมินอัปโหลดตรงเข้า section (ไม่ผ่าน workflow เอกสารคุณภาพ)
create table if not exists public_section_uploads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_key    text not null,        -- R2 key: public-sections/{uuid}-{filename}
  file_name   text not null,
  mime_type   text,
  file_size   bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- สำหรับฐานข้อมูลที่รันสคริปต์นี้ไปแล้วก่อนจะมีคอลัมน์ hot
alter table public_document_sections add column if not exists hot boolean not null default false;

-- สมาชิกของ section — polymorphic 3 แหล่ง เลือกได้ทีละหนึ่ง
create table if not exists public_document_section_items (
  id               uuid primary key default gen_random_uuid(),
  section_id       uuid not null references public_document_sections(id) on delete cascade,
  source           text not null check (source in ('library','test_attachment','upload')),
  document_id      uuid   references documents(id) on delete cascade,              -- library
  test_document_id bigint references test_documents(id) on delete cascade,         -- test_attachment
  upload_id        uuid   references public_section_uploads(id) on delete cascade, -- upload
  label_override   text,                                                           -- ชื่อที่จะแสดงแทน (ไม่บังคับ)
  sort_order       int not null default 0,
  check (num_nonnulls(document_id, test_document_id, upload_id) = 1)
);

create unique index if not exists public_document_section_items_library_uniq
  on public_document_section_items(section_id, document_id) where document_id is not null;
create unique index if not exists public_document_section_items_attachment_uniq
  on public_document_section_items(section_id, test_document_id) where test_document_id is not null;
create index if not exists public_document_section_items_section_idx
  on public_document_section_items(section_id, sort_order);

-- ทั้ง 3 ตารางถูกอ่าน/เขียนผ่าน supabaseAdmin (service role) เท่านั้น — ไม่มี client component
-- ใดอ่านตรงผ่าน anon key จึงล็อกด้วย service-role-only policy แบบเดียวกับ document_links /
-- document_attachments. create policy ไม่มี "if not exists" → ต้อง drop ก่อนเสมอ ไม่งั้นรันซ้ำจะ error.
alter table public_document_sections enable row level security;
alter table public_section_uploads enable row level security;
alter table public_document_section_items enable row level security;

drop policy if exists "Service role full access" on public_document_sections;
drop policy if exists "Service role full access" on public_section_uploads;
drop policy if exists "Service role full access" on public_document_section_items;

create policy "Service role full access" on public_document_sections for all to service_role using (true);
create policy "Service role full access" on public_section_uploads for all to service_role using (true);
create policy "Service role full access" on public_document_section_items for all to service_role using (true);

-- seed แถบอัตโนมัติหนึ่งแถว ให้หน้าเว็บทำงานได้ทันทีแบบเดิม (จัดกลุ่มตามหน่วยงาน)
insert into public_document_sections (kind, title_th, title_en, icon, sort_order, settings)
select 'auto', 'เอกสารตามหน่วยงาน', 'Documents by Department', 'inbox', 1000,
       '{"group_by":"department","hidden_groups":[],"group_titles":{}}'::jsonb
where not exists (select 1 from public_document_sections where kind = 'auto');

notify pgrst, 'reload schema';
