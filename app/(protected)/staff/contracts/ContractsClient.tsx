'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getContractUsage, addContractUsage } from '@/lib/queries/contracts'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ContractBattery } from '@/components/lab/ContractBattery'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import type { ContractUsage } from '@/lib/supabase/types'

interface Props { contracts: ContractWithUsage[]; canEdit?: boolean }

export function ContractsClient({ contracts: initialContracts, canEdit = false }: Props) {
  const [contracts, setContracts] = useState(initialContracts)
  const [usageModal, setUsageModal] = useState<{ contractId: number; contractName: string } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ contractId: number; contractName: string; history: ContractUsage[] } | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const supabase = createClient()

  async function handleLogUsage() {
    if (!usageModal || !amount) return
    const usage = await addContractUsage(supabase, {
      contract_id: usageModal.contractId,
      amount: parseFloat(amount),
      note,
      usage_date: new Date().toISOString().split('T')[0],
    })
    setContracts((prev) => prev.map((c) => c.id === usageModal.contractId ? { ...c, used: c.used + usage.amount } : c))
    setUsageModal(null)
    setAmount('')
    setNote('')
  }

  async function openHistory(contract: ContractWithUsage) {
    const history = await getContractUsage(supabase, contract.id)
    setHistoryModal({ contractId: contract.id, contractName: `${contract.vendor} — ${contract.product}`, history })
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {contracts.map((c) => {
          const pct = c.total ? (c.used / c.total) * 100 : 0
          const isExpiring = c.end_date && (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 30
          return (
            <Card key={c.id} padding={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{c.vendor}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{c.product}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isExpiring && <Badge color="red" size="sm">ใกล้หมด</Badge>}
                  <Badge color={c.status === 'active' ? 'green' : c.status === 'expired' ? 'red' : 'gray'} size="sm">{c.status}</Badge>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14, fontSize: 12 }}>
                <div>
                  <div style={{ color: 'var(--muted)' }}>มูลค่ารวม</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>฿{(c.total ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)' }}>ใช้แล้ว</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>฿{c.used.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)' }}>คงเหลือ</div>
                  <div style={{ fontWeight: 700, color: pct >= 80 ? '#DC2626' : 'var(--ink)' }}>฿{((c.total ?? 0) - c.used).toLocaleString()}</div>
                </div>
              </div>

              <ContractBattery total={c.total ?? 0} used={c.used} />

              {c.end_date && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>
                  สิ้นสุด: {new Date(c.end_date).toLocaleDateString('th-TH')}
                </div>
              )}

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                {canEdit && (
                  <Button variant="primary" size="sm" onClick={() => setUsageModal({ contractId: c.id, contractName: `${c.vendor} — ${c.product}` })}>
                    บันทึกการใช้
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openHistory(c)}>
                  ประวัติ
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Log usage modal */}
      {usageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={() => setUsageModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>บันทึกการใช้งาน</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 20 }}>{usageModal.contractName}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>จำนวน (บาท) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>หมายเหตุ</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดการใช้งาน"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setUsageModal(null)}>ยกเลิก</Button>
              <Button variant="primary" onClick={handleLogUsage} disabled={!amount}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={() => setHistoryModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>ประวัติการใช้งาน</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{historyModal.contractName}</div>
            </div>
            <div style={{ padding: 24 }}>
              {historyModal.history.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>ยังไม่มีประวัติ</div>
              ) : (
                historyModal.history.map((u) => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{u.note ?? '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {u.usage_date} · {u.recorded_by ?? '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>฿{u.amount.toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setHistoryModal(null)}>ปิด</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
