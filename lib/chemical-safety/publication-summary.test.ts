import assert from 'node:assert/strict'
import test from 'node:test'
import { roomPublicationLabel, summarizeDepartmentPublication } from './publication-summary'

const publication = (id: string, linkedAt: string, versionUpdatedAt = linkedAt) => ({
  id,
  linkedAt,
  versionUpdatedAt,
})

test('uses first-publication copy when a department has never been published', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'draft',
    publishedAt: null,
    lastPublishedAt: null,
    activePublications: [publication('a', '2026-08-23T01:00:00.000Z')],
  }), {
    action: 'publish',
    buttonLabel: 'เผยแพร่ทั้งงาน',
    helperText: null,
    pendingCount: 0,
  })
})

test('uses update copy and counts a newly linked publication after the baseline', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'draft',
    publishedAt: null,
    lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-23T01:00:00.000Z')],
  }), {
    action: 'update',
    buttonLabel: 'อัปเดตการเผยแพร่ (1 รายการ)',
    helperText: 'มีการเปลี่ยนแปลงรอเผยแพร่ 1 รายการ',
    pendingCount: 1,
  })
})

test('counts an existing publication whose SDS version was edited after the baseline', () => {
  const result = summarizeDepartmentPublication({
    status: 'published',
    publishedAt: '2026-08-22T01:00:00.000Z',
    lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-20T01:00:00.000Z', '2026-08-23T01:00:00.000Z')],
  })
  assert.equal(result.action, 'update')
  assert.equal(result.buttonLabel, 'อัปเดตการเผยแพร่ (1 รายการ)')
  assert.equal(result.pendingCount, 1)
})

test('shows unpublish copy when a published department has no pending item', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'published',
    publishedAt: '2026-08-22T01:00:00.000Z',
    lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-20T01:00:00.000Z')],
  }), {
    action: 'unpublish',
    buttonLabel: 'ยกเลิกเผยแพร่ทั้งงาน',
    helperText: null,
    pendingCount: 0,
  })
})

test('uses the room auto-publication labels', () => {
  assert.equal(roomPublicationLabel('active'), 'เผยแพร่แล้ว · อัปเดตอัตโนมัติ')
  assert.equal(roomPublicationLabel('ready'), 'พร้อมเผยแพร่อัตโนมัติ')
  assert.equal(roomPublicationLabel('stale'), 'มีฉบับใหม่ · อัปเดตอัตโนมัติ')
  assert.equal(roomPublicationLabel('unlinked'), 'ยังไม่มีการเผยแพร่ · ต้องแนบ SDS')
})
