'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { mergeEquipmentDepartments } from '@/lib/equipment/departments'
import { placementFilterOptions, UNCLASSIFIED_FILTER } from '@/lib/equipment-map/placement-pagination'
import type { EquipmentUnplacedDTO } from '@/lib/equipment-map/types'

export interface PlacementFiltersProps {
  unplaced: readonly EquipmentUnplacedDTO[]
  department: string
  classification: string
  calibrationOnly: boolean
  onDepartmentChange: (value: string) => void
  onClassificationChange: (value: string) => void
  onCalibrationOnlyChange: (value: boolean) => void
  onClear: () => void
}

export function PlacementFilters({
  unplaced,
  department,
  classification,
  calibrationOnly,
  onDepartmentChange,
  onClassificationChange,
  onCalibrationOnlyChange,
  onClear,
}: PlacementFiltersProps) {
  const options = useMemo(() => {
    const dynamicOptions = placementFilterOptions(unplaced)

    return {
      ...dynamicOptions,
      departments: mergeEquipmentDepartments(dynamicOptions.departments),
    }
  }, [unplaced])
  const hasActiveFilter = Boolean(department || classification || calibrationOnly)

  return (
    <section className="equipment-placement-toolbar" aria-label="ตัวกรองรายการเครื่องมือที่ยังไม่กำหนดตำแหน่ง">
      <div className="equipment-placement-toolbar-title">
        <strong>กรองรายการที่ยังไม่กำหนดตำแหน่ง</strong>
        <span>ตัวกรองนี้ไม่มีผลต่อหมุดบนแผนที่</span>
      </div>
      <div className="equipment-placement-toolbar-controls">
        <label>
          <span>แผนก</span>
          <select value={department} onChange={(event) => onDepartmentChange(event.target.value)}>
            <option value="">ทุกแผนก</option>
            {options.departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Classification</span>
          <select value={classification} onChange={(event) => onClassificationChange(event.target.value)}>
            <option value="">ทุก Classification</option>
            {options.classifications.map((item) => <option key={item} value={item}>{item}</option>)}
            {options.hasUnclassified ? <option value={UNCLASSIFIED_FILTER}>ยังไม่ระบุ Classification</option> : null}
          </select>
        </label>
        <div className="equipment-placement-toolbar-actions">
          <Button
            variant={calibrationOnly ? 'primary' : 'secondary'}
            aria-pressed={calibrationOnly}
            onClick={() => onCalibrationOnlyChange(!calibrationOnly)}
          >
            ต้องการสอบเทียบ
          </Button>
          {hasActiveFilter ? <Button variant="ghost" onClick={onClear}>ล้างตัวกรอง</Button> : null}
        </div>
      </div>
    </section>
  )
}
