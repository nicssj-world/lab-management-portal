import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const mutationRoutes = [
  'app/api/admin/satisfaction/surveys/route.ts',
  'app/api/admin/satisfaction/surveys/[surveyId]/route.ts',
  'app/api/admin/satisfaction/surveys/[surveyId]/draft/route.ts',
  'app/api/admin/satisfaction/surveys/[surveyId]/publish/route.ts',
]

for (const path of mutationRoutes) {
  const source = read(path)
  assert.ok(source.includes("requireResource('แบบสำรวจความพึงพอใจ'"), `${path} checks resource`)
  assert.ok(source.includes("'edit'"), `${path} checks edit permission`)
  assert.ok(source.includes('.safeParse('), `${path} parses mutation input with Zod`)
}

for (const path of mutationRoutes.slice(1)) {
  assert.match(read(path), /params\s*:\s*Promise</, `${path} uses async params`)
  assert.ok(read(path).includes('await params'), `${path} awaits params`)
}

const builder = read('components/satisfaction/SurveyBuilder.tsx')
const renderer = read('components/satisfaction/SurveyRenderer.tsx')
const preview = read('components/satisfaction/SurveyPreviewModal.tsx')
const page = read('app/(protected)/staff/satisfaction/[surveyId]/page.tsx')
const sql = read('scripts/satisfaction-survey-module.sql')

assert.ok(builder.includes('600'), 'autosaves after 600 ms')
assert.ok(builder.includes("aria-label=\"เลื่อนขึ้น\""), 'has explicit move-up control')
assert.ok(builder.includes("aria-label=\"เลื่อนลง\""), 'has explicit move-down control')
assert.ok(builder.includes('aria-live="polite"'), 'announces save and publish status')
assert.ok(builder.includes('setPublishIssues'), 'navigates users to publish issues')
for (const type of ['single_choice', 'short_text', 'number', 'rating_scale', 'long_text', 'yes_no']) {
  assert.ok(builder.includes(type), `builder supports ${type}`)
  assert.ok(renderer.includes(type), `renderer supports ${type}`)
}
assert.ok(preview.includes('<SurveyRenderer'), 'preview reuses the renderer')
assert.ok(preview.includes('aria-modal="true"'), 'preview is an accessible modal')
assert.ok(!builder.includes("@/lib/supabase/admin"), 'client builder does not import admin client')
assert.ok(!renderer.includes("@/lib/supabase/admin"), 'client renderer does not import admin client')
assert.ok(page.includes('await params'), 'builder page awaits dynamic params')
assert.ok(sql.includes('save_survey_draft'), 'draft graph is saved transactionally')

console.log('satisfaction builder tests passed')
