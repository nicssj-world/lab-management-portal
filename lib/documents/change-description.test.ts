import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHANGE_DESCRIPTION_REQUIRED_ERROR,
  FIRST_PUBLICATION_DESCRIPTION,
  getPublicationDescriptionError,
  getInitialChangeDescription,
  resolveInitialChangeDescription,
  hasChangeDescription,
  requiresPublicationDescription,
  shouldDisplayChangeDescription,
} from './change-description'

test('requires a non-empty change description only when QP/WI is published', () => {
  assert.equal(requiresPublicationDescription('QP', 'Published'), true)
  assert.equal(requiresPublicationDescription('WI', 'Published'), true)
  assert.equal(requiresPublicationDescription('QP', 'Review'), false)
  assert.equal(requiresPublicationDescription('Form', 'Published'), false)
})

test('treats blank and whitespace-only descriptions as missing', () => {
  assert.equal(hasChangeDescription('แก้ไขข้อ 1'), true)
  assert.equal(hasChangeDescription(''), false)
  assert.equal(hasChangeDescription('   \n  '), false)
  assert.equal(hasChangeDescription(null), false)
})

test('returns the first-publication default only for Rev.00 QP/WI documents', () => {
  const getInitial = (revision: string, type = 'QP') => getInitialChangeDescription({
    type,
    revision,
    isNewDocument: true,
    isImportCurrent: false,
  } as Parameters<typeof getInitialChangeDescription>[0])

  assert.equal(getInitial('00'), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitial('0'), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitial('Rev.00'), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitial('02'), null)
  assert.equal(getInitial('2'), null)
  assert.equal(getInitial('00', 'WI'), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitial('00', 'Form'), null)
  assert.equal(getInitial('00', 'QP'), FIRST_PUBLICATION_DESCRIPTION)
})

test('does not restore the first-publication default for a non-initial revision', () => {
  assert.equal(resolveInitialChangeDescription({
    type: 'QP',
    revision: '02',
    isNewDocument: true,
    isImportCurrent: false,
  } as Parameters<typeof resolveInitialChangeDescription>[0]), undefined)
  assert.equal(resolveInitialChangeDescription({
    type: 'QP',
    revision: '00',
    isNewDocument: true,
    isImportCurrent: false,
  } as Parameters<typeof resolveInitialChangeDescription>[0]), FIRST_PUBLICATION_DESCRIPTION)
})

test('keeps the existing non-default guards for initial descriptions', () => {
  const getInitial = (overrides: Record<string, unknown>) => getInitialChangeDescription({
    type: 'QP',
    revision: '00',
    isNewDocument: true,
    isImportCurrent: false,
    ...overrides,
  } as Parameters<typeof getInitialChangeDescription>[0])

  assert.equal(getInitial({ isNewDocument: false }), null)
  assert.equal(getInitial({ isImportCurrent: true }), null)
})

test('preserves an explicitly cleared description instead of restoring the default', () => {
  assert.equal(resolveInitialChangeDescription({ type: 'QP', revision: '00', isNewDocument: true, isImportCurrent: false }), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(resolveInitialChangeDescription({ type: 'QP', revision: '00', isNewDocument: true, isImportCurrent: false, description: '' }), '')
  assert.equal(resolveInitialChangeDescription({ type: 'QP', revision: '00', isNewDocument: true, isImportCurrent: false, description: '   ' }), '')
  assert.equal(resolveInitialChangeDescription({ type: 'Form', revision: '00', isNewDocument: true, isImportCurrent: false, description: '' }), '')
})

test('exposes the stable publish validation message', () => {
  assert.equal(CHANGE_DESCRIPTION_REQUIRED_ERROR, 'QP/WI ต้องระบุรายละเอียดการแก้ไขก่อนเผยแพร่')
})

test('returns the publish error only for QP/WI with missing descriptions', () => {
  assert.equal(getPublicationDescriptionError('QP', 'Published', ''), CHANGE_DESCRIPTION_REQUIRED_ERROR)
  assert.equal(getPublicationDescriptionError('WI', 'Published', '   '), CHANGE_DESCRIPTION_REQUIRED_ERROR)
  assert.equal(getPublicationDescriptionError('QP', 'Published', 'แก้ไขข้อ 1'), null)
  assert.equal(getPublicationDescriptionError('QP', 'Approved', ''), null)
  assert.equal(getPublicationDescriptionError('Reference', 'Published', ''), null)
})

test('only QP/WI rows display change-description details', () => {
  assert.equal(shouldDisplayChangeDescription('QP'), true)
  assert.equal(shouldDisplayChangeDescription('WI'), true)
  assert.equal(shouldDisplayChangeDescription('Reference'), false)
  assert.equal(shouldDisplayChangeDescription('Manual'), false)
})
