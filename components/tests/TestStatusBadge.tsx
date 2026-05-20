import { Badge } from '@/components/ui/Badge'

export function TestStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge color={active ? 'green' : 'gray'} size="sm">
      {active ? 'ใช้งาน' : 'ปิดใช้'}
    </Badge>
  )
}
