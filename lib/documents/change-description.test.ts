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

test('returns the first-publication default only for a new normal QP/WI document', () => {
  assert.equal(getInitialChangeDescription({ type: 'QP', isNewDocument: true, isImportCurrent: false }), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitialChangeDescription({ type: 'WI', isNewDocument: true, isImportCurrent: false }), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(getInitialChangeDescription({ type: 'Form', isNewDocument: true, isImportCurrent: false }), null)
  assert.equal(getInitialChangeDescription({ type: 'QP', isNewDocument: false, isImportCurrent: false }), null)
  assert.equal(getInitialChangeDescription({ type: 'QP', isNewDocument: true, isImportCurrent: true }), null)
})

test('preserves an explicitly cleared description instead of restoring the default', () => {
  assert.equal(resolveInitialChangeDescription({ type: 'QP', isNewDocument: true, isImportCurrent: false }), FIRST_PUBLICATION_DESCRIPTION)
  assert.equal(resolveInitialChangeDescription({ type: 'QP', isNewDocument: true, isImportCurrent: false, description: '' }), '')
  assert.equal(resolveInitialChangeDescription({ type: 'QP', isNewDocument: true, isImportCurrent: false, description: '   ' }), '')
  assert.equal(resolveInitialChangeDescription({ type: 'Form', isNewDocument: true, isImportCurrent: false, description: '' }), '')
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
