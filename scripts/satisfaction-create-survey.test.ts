import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const module = read('components/satisfaction/SatisfactionModule.tsx')
const route = read('app/api/admin/satisfaction/surveys/route.ts')

assert.ok(module.includes("from 'next/navigation'"), 'uses client navigation after creating a survey')
assert.ok(module.includes('setCreateSurveyOpen(true)'), 'both create controls open the creation dialog')
assert.ok(module.includes('<CreateSurveyDialog'), 'renders a dialog for creating a survey')
assert.ok(module.includes("fetch('/api/admin/satisfaction/surveys'"), 'submits new surveys to the existing API')
assert.ok(module.includes("method: 'POST'"), 'creates a survey with POST')
assert.ok(module.includes('onCreated(result.surveyId)'), 'returns the created survey ID to the page')
assert.ok(module.includes('router.push(`/staff/satisfaction/${surveyId}`)'), 'opens the new draft after creation')
assert.ok(module.includes('aria-modal="true"'), 'uses an accessible creation dialog')
assert.ok(module.includes('role="alert"'), 'shows create errors to the user')
assert.ok(module.includes("import { createPortal } from 'react-dom'"), 'renders the dialog through a document-level portal')
assert.ok(module.includes('createPortal(content, document.body)'), 'escapes page stacking contexts that can obscure the dialog')
assert.ok(module.includes('zIndex: 1000'), 'keeps the dialog above the protected application shell')
assert.ok(module.includes("background: 'var(--card)'"), 'uses a guaranteed opaque dialog surface')
assert.ok(module.includes('className="modal-scrim"'), 'uses the shared modal scrim treatment')
assert.ok(module.includes('className="modal-panel-pop"'), 'uses the shared modal panel animation')

assert.ok(route.includes("requireResource('แบบสำรวจความพึงพอใจ', 'edit')"), 'creation remains edit-protected')
assert.ok(route.includes('createSurveyWithDraft'), 'creation makes a draft workspace')

console.log('satisfaction create survey tests passed')
