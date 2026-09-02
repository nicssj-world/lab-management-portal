import assert from 'node:assert/strict'
import test from 'node:test'
import { SetMutationJournal } from './set-upload-transaction'

test('set mutation journal rolls back in reverse order and continues after an undo failure', async () => {
  const journal = new SetMutationJournal()
  const undone: string[] = []
  journal.add('first', async () => { undone.push('first') })
  journal.add('broken', async () => {
    undone.push('broken')
    throw new Error('undo failed')
  })
  journal.add('last', async () => { undone.push('last') })

  const failures = await journal.rollback()

  assert.deepEqual(undone, ['last', 'broken', 'first'])
  assert.deepEqual(failures, [{ label: 'broken', error: 'undo failed' }])
})

