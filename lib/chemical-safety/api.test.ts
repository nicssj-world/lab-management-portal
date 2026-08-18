import assert from 'node:assert/strict'
import { transitionError } from './api'

async function main() {
  const response = transitionError({ message: 'holding_in_use_cannot_delete' })
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: 'รายการนี้เชื่อมกับ SDS หรือ SDS งานอยู่ ไม่สามารถลบได้',
  })

  console.log('chemical safety API error mapping passed')
}

void main()
