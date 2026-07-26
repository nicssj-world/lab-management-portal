import assert from 'node:assert/strict'
import { aggregateIncidentMap, aggregateRegisterMap } from '../lib/risk/map'

const incidents = aggregateIncidentMap([
  { space_code: 'central-lab-left', severity_level: 'B', status: 'reported' },
  { space_code: 'central-lab-left', severity_level: 'H', status: 'reviewing' },
  { space_code: 'chemical-prep', severity_level: null, status: 'reported' },
  { space_code: null, severity_level: 'I', status: 'reported' },
])
assert.deepEqual(incidents, [
  { spaceCode: 'central-lab-left', count: 2, level: 'high', maxSeverity: 'H', unassessedCount: 0 },
  { spaceCode: 'chemical-prep', count: 1, level: 'unassessed', maxSeverity: null, unassessedCount: 1 },
])

const registers = aggregateRegisterMap([
  { space_code: 'central-lab-left', level: 'medium', residual_level: 'low', status: 'monitoring' },
  { space_code: 'central-lab-left', level: 'high', residual_level: null, status: 'open' },
  { space_code: 'chemical-prep', level: null, residual_level: null, status: 'open' },
  { space_code: 'chemical-prep', level: 'high', residual_level: 'high', status: 'closed' },
])
assert.deepEqual(registers, [
  { spaceCode: 'central-lab-left', count: 2, level: 'high', unassessedCount: 0 },
  { spaceCode: 'chemical-prep', count: 1, level: 'unassessed', unassessedCount: 1 },
])

console.log('risk map aggregation tests passed')
