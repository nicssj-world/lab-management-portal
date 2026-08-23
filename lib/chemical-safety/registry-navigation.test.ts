import assert from 'node:assert/strict'
import { resetRegistryFiltersForStorageNavigation } from './registry-navigation'

assert.deepEqual(
  resetRegistryFiltersForStorageNavigation('A1'),
  {
    position: 'A1',
    scopeFilter: '',
    lifecycleFilter: 'all',
    registryPage: 1,
    search: '',
    debouncedSearch: '',
  },
  'opening a storage location must not carry registry search or owner/status filters into the registry',
)

console.log('chemical-safety registry navigation: ok')
