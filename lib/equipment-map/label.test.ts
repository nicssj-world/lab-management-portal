import assert from 'node:assert/strict'
import { labelForRenamedArea } from './label'

const label = labelForRenamedArea(
  'Sequence Room',
  { x: 0, y: 0, width: 50, height: 165 },
  { x: 25, y: 82, lines: ['เดิม'], fontSize: 11 },
)

assert.equal(label.fontSize, 10, 'the font must shrink before breaking an English word')
assert.deepEqual(label.lines, ['Sequence', 'Room'], 'English words must stay intact when a smaller readable font can fit them')

console.log('equipment map dynamic label wrapping passed')
