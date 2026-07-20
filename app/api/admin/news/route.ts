import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NewsSchema } from '@/lib/validations/news'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const cat       = sp.get('cat') ?? undefined
    const published = sp.get('published')
    const isNew     = sp.get('is_new')

    let query = supabaseAdmin
      .from('news')
      .select('*')
      .order('created_at', { ascending: false })

    if (cat)                  query = query.eq('cat', cat)
    if (published === 'true') query = query.eq('published', true)
    if (published === 'false') query = query.eq('published', false)
    if (isNew === 'true')     query = query.eq('is_new', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['Admin', 'Manager'].includes(actor.role)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const form = await req.formData()
    const metaRaw = form.get('meta')
    if (!metaRaw) return NextResponse.json({ error: 'ไม่พบข้อมูลข่าว' }, { status: 422 })

    const parsed = NewsSchema.safeParse(JSON.parse(metaRaw as string))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const meta = parsed.data

    // Insert row first (no pdf_path yet)
    const insertPayload: Record<string, unknown> = {
      title:     meta.title,
      excerpt:   meta.excerpt ?? null,
      body:      meta.body ?? null,
      cat:       meta.cat,
      author:    meta.author ?? null,
      published: meta.published,
      is_new:    meta.is_new,
      new_until: meta.new_until ?? null,
    }
    if (meta.created_at) insertPayload.created_at = meta.created_at

    const { data: news, error: dbErr } = await supabaseAdmin
      .from('news')
      .insert(insertPayload)
      .select()
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    // Upload PDF if provided
    const pdfFile = form.get('pdf') as File | null
    if (pdfFile && pdfFile.size > 0) {
      if (pdfFile.size > 20 * 1024 * 1024) {
        await supabaseAdmin.from('news').delete().eq('id', news.id)
        return NextResponse.json({ error: 'ไฟล์ PDF ใหญ่เกิน 20 MB' }, { status: 422 })
      }

      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const r2Key = `news/${news.id}/${Date.now()}-${safeName}`

      try {
        const buffer = Buffer.from(await pdfFile.arrayBuffer())
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: buffer,
          ContentType: 'application/pdf',
        }))

        await supabaseAdmin.from('news').update({ pdf_path: r2Key }).eq('id', news.id)
        news.pdf_path = r2Key
      } catch {
        // R2 failed — roll back the DB row
        await supabaseAdmin.from('news').delete().eq('id', news.id)
        return NextResponse.json({ error: 'อัปโหลด PDF ไม่สำเร็จ' }, { status: 500 })
      }
    }

    supabaseAdmin.from('audit_log')
      .insert({ action: 'create_news', user_id: actor.id, target: String(news.id), detail: news.title })
      .then(undefined, () => {})

    revalidatePath('/')
    return NextResponse.json(news, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
