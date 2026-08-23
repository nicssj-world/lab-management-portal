export type ChemicalRegistryLifecycleFilter = 'all' | 'active' | 'retired'

export interface ChemicalRegistryNavigationState {
  position: string
  scopeFilter: string
  lifecycleFilter: ChemicalRegistryLifecycleFilter
  registryPage: number
  search: string
  debouncedSearch: string
}

/**
 * Starting from a storage location is a new registry context. Do not carry
 * filters that were selected while reviewing a department or another room.
 */
export function resetRegistryFiltersForStorageNavigation(position: string): ChemicalRegistryNavigationState {
  return {
    position,
    scopeFilter: '',
    lifecycleFilter: 'all',
    registryPage: 1,
    search: '',
    debouncedSearch: '',
  }
}
