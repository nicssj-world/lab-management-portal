import assert from 'node:assert/strict'
import {
  canOfferRegistrationSet,
  completeSuccessfulDocumentSave,
  normalizeRegisterSetSelection,
  shouldRegisterSetAfterSave,
} from './document-upload-set-flow'

assert.equal(canOfferRegistrationSet({ isEdit: false, isImportCurrent: false, type: 'QP', hasCallback: true }), true)
assert.equal(canOfferRegistrationSet({ isEdit: false, isImportCurrent: false, type: 'QP', hasCallback: false }), false)

const checkedQp = {
  isEdit: false,
  isImportCurrent: false,
  type: 'QP',
  registerSetAfterSave: true,
}

assert.equal(shouldRegisterSetAfterSave(checkedQp), true, 'a checked new QP Draft should continue to set registration')
assert.equal(normalizeRegisterSetSelection('Form', true), false, 'changing QP to Form must clear the remembered selection')
assert.equal(normalizeRegisterSetSelection('FM', true), false, 'an FM-like ineligible type must clear the remembered selection')
assert.equal(shouldRegisterSetAfterSave({ ...checkedQp, type: 'Form' }), false, 'a stale checked value must not register after changing to Form')
assert.equal(shouldRegisterSetAfterSave({ ...checkedQp, type: 'FM' }), false, 'a stale checked value must not register after changing to FM')
assert.equal(shouldRegisterSetAfterSave({ ...checkedQp, isEdit: true }), false, 'edits must not enter set registration')
assert.equal(shouldRegisterSetAfterSave({ ...checkedQp, isImportCurrent: true }), false, 'current-document imports must not enter set registration')
assert.equal(shouldRegisterSetAfterSave({ ...checkedQp, registerSetAfterSave: false }), false, 'an unchecked QP must remain a standalone save')

for (const nextType of ['Form', 'FM']) {
  const callbacksAfterTypeChange: string[] = []
  const normalizedSelection = normalizeRegisterSetSelection(nextType, checkedQp.registerSetAfterSave)
  completeSuccessfulDocumentSave(
    `${nextType}-document`,
    { ...checkedQp, type: nextType, registerSetAfterSave: normalizedSelection },
    {
      onSaved: () => callbacksAfterTypeChange.push('saved'),
      onRegisterSet: () => callbacksAfterTypeChange.push('register'),
    },
  )
  assert.deepEqual(
    callbacksAfterTypeChange,
    ['saved'],
    `changing a checked QP to ${nextType} must clear the selection and skip the registration callback`,
  )
}

const callbackOrder: string[] = []
completeSuccessfulDocumentSave(
  'saved-document',
  checkedQp,
  {
    onSaved: (document) => callbackOrder.push(`saved:${document}`),
    onRegisterSet: (document) => callbackOrder.push(`register:${document}`),
  },
)
assert.deepEqual(callbackOrder, [
  'saved:saved-document',
  'register:saved-document',
], 'the main save callback must run before opening set registration')

const ineligibleCallbacks: string[] = []
completeSuccessfulDocumentSave(
  'form-document',
  { ...checkedQp, type: 'Form' },
  {
    onSaved: () => ineligibleCallbacks.push('saved'),
    onRegisterSet: () => ineligibleCallbacks.push('register'),
  },
)
assert.deepEqual(ineligibleCallbacks, ['saved'], 'an ineligible type must keep the normal save callback without opening set registration')
