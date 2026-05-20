import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fslagsuorkcckvvtrmyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGFnc3VvcmtjY2t2dnRybXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MDc1OSwiZXhwIjoyMDk0NzU2NzU5fQ.6OwSnEAaMWpwQ52QaubLxIHDcqRVE-pj0qJWNGaFYdY',
  { auth: { persistSession: false } },
)

const CATEGORIES = [
  { id: 'immu', th: 'ภูมิคุ้มกันวิทยาคลินิก',            en: 'IMMUNOLOGY',          color: '#9333EA', icon: 'shieldCheck', sort_order: 0 },
  { id: 'hema', th: 'โลหิตวิทยาคลินิก',                  en: 'HEMATOLOGY',          color: '#DC2626', icon: 'blood',       sort_order: 1 },
  { id: 'misc', th: 'จุลทรรศนศาสตร์คลินิก',              en: 'CLINICAL MICROSCOPY', color: '#0891B2', icon: 'microscope',  sort_order: 2 },
  { id: 'micr', th: 'จุลชีววิทยาคลินิก',                 en: 'MICROBIOLOGY',        color: '#16A34A', icon: 'petri',       sort_order: 3 },
  { id: 'biom', th: 'อณูชีววิทยาคลินิก',                 en: 'BIOMOLECULAR',        color: '#065F46', icon: 'dna',         sort_order: 4 },
  { id: 'blba', th: 'คลังเลือด',                          en: 'BLOOD BANK',          color: '#B91C1C', icon: 'bloodBag',    sort_order: 5 },
  { id: 'outl', th: 'ตรวจพิเศษและปฏิบัติการตรวจต่อ',    en: 'OUT LAB',             color: '#475569', icon: 'doc',         sort_order: 6 },
  { id: 'chc',  th: 'ศูนย์สุขภาพชุมชนเมืองชลบุรี',      en: 'Community Health Center Chonburi', color: '#EA580C', icon: 'shield', sort_order: 7 },
]

const rows = CATEGORIES.map((c) => ({ ...c, active: true }))

const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'id' })

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
console.log(`✅ เพิ่ม ${rows.length} หมวดหมู่สำเร็จ`)
