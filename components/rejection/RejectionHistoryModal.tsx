'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { RejectionUpload } from '@/lib/queries/rejection'

interface Props {
  canEdit: boolean
  onClose: () => void
  onDeleted: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const dialogStyle: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 760,
  maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
}

export default function RejectionHistoryModal({ canEdit, onClose, onDeleted }: Props) {
  const [history, setHistory] = useState<RejectionUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ month: string; deleted: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/rejection/history')
      .then(r => r.json())
      .then(j => { setHistory(j.data ?? []); setLoading(false) })
      .catch(() => { setError('โหลดข้อมูลไม่ได้'); setLoading(false) })
  }, [])

  async function handleDelete(month: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/rejection?month=${month}`, { method: 'DELETE' })
      const json = await res.json()
      if (res.ok) {
        setDeleteResult({ month, deleted: json.deleted })
        setHistory(h => h.filter(r => r.data_month !== month))
        onDeleted()
      } else {
        setError(json.error ?? 'ลบไม่ได้')
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setDeleting(false)
      setConfirmMonth(null)
    }
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ประวัติการ Upload</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Delete result banner */}
        {deleteResult && (
          <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#15803D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ลบข้อมูลเดือน <strong>{deleteResult.month}</strong> เรียบร้อย — {deleteResult.deleted.toLocaleString()} records</span>
            <button onClick={() => setDeleteResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', padding: 2 }}>
              <Icon name="x" size={13} />
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 0, marginTop: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</div>
          ) : history.length === 0 && !deleteResult ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีประวัติ</div>
          ) : history.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['วันที่ Upload', 'ไฟล์', 'เดือนข้อมูล', 'ทั้งหมด', 'เพิ่มใหม่', 'ข้ามซ้ำ', ...(canEdit ? [''] : [])].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(row.uploaded_at)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--ink)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.filename}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {row.data_month
                          ? <span style={{ fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{row.data_month}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>
                        {row.total_rows.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--success)', textAlign: 'right', fontWeight: 600 }}>
                        +{row.inserted.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--muted)', textAlign: 'right' }}>
                        {row.skipped.toLocaleString()}
                      </td>
                      {canEdit && (
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {confirmMonth === row.data_month ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 600 }}>ยืนยันลบ?</span>
                              <button
                                onClick={() => row.data_month && handleDelete(row.data_month)}
                                disabled={deleting}
                                style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                {deleting ? '…' : 'ลบ'}
                              </button>
                              <button
                                onClick={() => setConfirmMonth(null)}
                                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                ยกเลิก
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => row.data_month && setConfirmMonth(row.data_month)}
                              disabled={!row.data_month}
                              style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: row.data_month ? 'pointer' : 'default', fontFamily: 'inherit', opacity: row.data_month ? 1 : 0.4 }}
                            >
                              ลบ
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
