import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv } from './lib/env.mjs'

const codes = [
  'FM-QP-LAB-09-01',
  'FM-QP-LAB-09-02',
  'FM-QP-LAB-09-03',
  'FM-QP-LAB-09-04',
]

const titles = {
  'FM-QP-LAB-09-01': 'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะบริการด่านหน้า)',
  'FM-QP-LAB-09-02': 'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะแพทย์/ทันตแพทย์ และพยาบาล)',
  'FM-QP-LAB-09-03': 'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะเจ้าหน้าที่ส่งตรวจ/เสมียนหอ)',
  'FM-QP-LAB-09-04': 'แบบประเมินความพึงพอใจของผู้บริจาคโลหิต',
}

const fail = (error) => {
  if (error) throw new Error(error.message)
}

function sourceDefinition(code) {
  const sql = readFileSync(join(process.cwd(), 'scripts/satisfaction-survey-module.sql'), 'utf8')
  const seedStart = sql.indexOf(`-- SEED ${code}`)
  const jsonStart = sql.indexOf('$json$', seedStart)
  const jsonEnd = sql.indexOf('$json$::jsonb', jsonStart)
  if (seedStart < 0 || jsonStart < 0 || jsonEnd < 0) {
    throw new Error(`ไม่พบต้นฉบับข้อมูลสำหรับ ${code}`)
  }
  return JSON.parse(sql.slice(jsonStart + '$json$'.length, jsonEnd))
}

async function insertDefinition(supabase, survey, definition) {
  const { data: version, error: versionError } = await supabase
    .from('survey_versions')
    .insert({
      id: randomUUID(),
      survey_id: survey.id,
      version_number: 2,
      status: 'draft',
      title: titles[survey.code],
      description: definition.description ?? null,
    })
    .select('id')
    .single()
  fail(versionError)

  for (const [sectionIndex, sourceSection] of definition.sections.entries()) {
    const sectionId = randomUUID()
    const { error: sectionError } = await supabase.from('survey_sections').insert({
      id: sectionId,
      survey_version_id: version.id,
      section_key: sourceSection.key,
      title: sourceSection.title,
      description: sourceSection.description ?? null,
      sort_order: sectionIndex + 1,
    })
    fail(sectionError)

    for (const [questionIndex, sourceQuestion] of sourceSection.questions.entries()) {
      const questionId = randomUUID()
      const { error: questionError } = await supabase.from('survey_questions').insert({
        id: questionId,
        survey_version_id: version.id,
        survey_section_id: sectionId,
        question_key: sourceQuestion.key,
        prompt: sourceQuestion.prompt,
        question_type: sourceQuestion.type,
        required: Boolean(sourceQuestion.required),
        sort_order: questionIndex + 1,
        numeric_min: sourceQuestion.min ?? null,
        numeric_max: sourceQuestion.max ?? null,
        text_max_length: sourceQuestion.max_length ?? null,
        positive_threshold: sourceQuestion.type === 'rating_scale'
          ? (sourceQuestion.positive_threshold ?? 4)
          : null,
        allow_detail_text: Boolean(sourceQuestion.allow_detail),
        detail_label: sourceQuestion.detail_label ?? null,
        is_comment: Boolean(sourceQuestion.comment),
      })
      fail(questionError)

      const sourceOptions = sourceQuestion.type === 'rating_scale'
        ? (sourceQuestion.options ?? definition.rating_options)
        : sourceQuestion.options
      if (!sourceOptions) continue

      const options = sourceOptions.map((option, optionIndex) => ({
        id: randomUUID(),
        survey_version_id: version.id,
        survey_question_id: questionId,
        option_key: option.key,
        label: option.label,
        value: option.value ?? option.key,
        score: option.score ?? null,
        allows_other_text: Boolean(option.other),
        sort_order: optionIndex + 1,
      }))
      const { error: optionsError } = await supabase.from('survey_question_options').insert(options)
      fail(optionsError)
    }
  }

  return version.id
}

async function run() {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const { data: surveys, error: surveysError } = await supabase
    .from('surveys')
    .select('id, code, survey_versions(id, version_number, status)')
    .in('code', codes)
  fail(surveysError)
  if (surveys?.length !== codes.length) throw new Error('ไม่พบแบบสำรวจต้นฉบับครบทั้ง 4 ฉบับ')

  for (const survey of surveys) {
    const versions = survey.survey_versions ?? []
    if (versions.some((version) => version.version_number >= 2)) {
      throw new Error(`${survey.code} มี Version 2 หรือใหม่กว่าอยู่แล้ว — ยกเลิกเพื่อป้องกันการล้างข้อมูลซ้ำ`)
    }
    if (versions.some((version) => version.status === 'draft')) {
      throw new Error(`${survey.code} มีฉบับร่างอยู่ — กรุณาจัดการฉบับร่างก่อนรันการแก้ไขต้นฉบับ`)
    }
  }

  console.log('▶ สร้าง Version 2 จากข้อความและตัวเลือกใน PDF ต้นฉบับ …')
  const versionIds = []
  for (const code of codes) {
    const survey = surveys.find((item) => item.code === code)
    const definition = sourceDefinition(code)
    versionIds.push(await insertDefinition(supabase, survey, definition))
  }

  const surveyIds = surveys.map((survey) => survey.id)
  const { data: campaigns, error: campaignsError } = await supabase
    .from('survey_campaigns')
    .select('id')
    .in('survey_id', surveyIds)
  fail(campaignsError)
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id)

  if (campaignIds.length > 0) {
    console.log('▶ ล้างคำตอบ แคมเปญ และข้อมูล KPI ที่เกี่ยวข้อง …')
    const { data: publications, error: publicationsError } = await supabase
      .from('survey_kpi_publications')
      .select('campaign_id, metric_code, fiscal_year')
      .in('campaign_id', campaignIds)
    fail(publicationsError)

    for (const publication of publications ?? []) {
      const { error } = await supabase.from('kpi_satisfaction')
        .delete()
        .eq('metric_code', publication.metric_code)
        .eq('fiscal_year', publication.fiscal_year)
      fail(error)
    }
    const { error: publicationDeleteError } = await supabase
      .from('survey_kpi_publications')
      .delete()
      .in('campaign_id', campaignIds)
    fail(publicationDeleteError)

    const { error: responseDeleteError } = await supabase
      .from('survey_responses')
      .delete()
      .in('campaign_id', campaignIds)
    fail(responseDeleteError)
    const { error: campaignDeleteError } = await supabase
      .from('survey_campaigns')
      .delete()
      .in('id', campaignIds)
    fail(campaignDeleteError)
  }

  for (const [index, code] of codes.entries()) {
    const survey = surveys.find((item) => item.code === code)
    const definition = sourceDefinition(code)
    const { error: surveyUpdateError } = await supabase.from('surveys').update({
      title: titles[code],
      description: definition.description ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', survey.id)
    fail(surveyUpdateError)
    const { error: publishError } = await supabase.from('survey_versions').update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', versionIds[index])
    fail(publishError)
  }

  console.log('✅ ล้างข้อมูลเดิมและสร้าง Version 2 ตาม PDF ครบทั้ง 4 ฉบับแล้ว')
}

run().catch((error) => {
  console.error('❌ การแก้ไขแบบสำรวจล้มเหลว:', error.message)
  process.exit(1)
})
