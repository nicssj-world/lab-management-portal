'use client'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { ChemicalHoldingDeleteImpact } from '@/lib/chemical-safety/holding-delete'
import { FONT, SPACE } from './shared/tokens'

interface Props {
  impact: ChemicalHoldingDeleteImpact
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function destinationLabel(destination: 'room' | 'department', departmentCode: string | null) {
  return destination === 'room' ? 'ห้องสารเคมี' : `งาน ${departmentCode ?? 'ไม่ระบุ'}`
}

export function HoldingDeleteImpactDialog({ impact, busy, onCancel, onConfirm }: Props) {
  const blocked = !impact.canDelete
  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center',
        padding: SPACE.md, background: 'rgba(15,23,42,.52)', backdropFilter: 'blur(3px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="holding-delete-impact-title"
        style={{
          width: 'min(720px, 100%)', maxHeight: 'min(760px, calc(100vh - 32px))', overflow: 'auto',
          border: '1px solid var(--border)', borderRadius: 16, background: 'var(--card)',
          boxShadow: '0 24px 80px rgba(15,23,42,.28)', padding: SPACE.lg,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: blocked ? 'var(--danger)' : 'var(--warning)', fontSize: FONT.xs, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {blocked ? 'ลบไม่ได้ในขณะนี้' : 'ตรวจสอบก่อนลบ'}
            </p>
            <h2 id="holding-delete-impact-title" style={{ margin: '5px 0 0', color: 'var(--ink)', fontSize: 20 }}>
              {blocked ? 'SDS ถูกใช้กับรายการอื่น' : 'ยืนยันการลบรายการถาวร'}
            </h2>
            <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>
              {impact.productName} · {impact.unitName}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon="x" title="ปิด" onClick={onCancel} disabled={busy} />
        </header>

        {blocked ? (
          <div role="alert" style={{ marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--danger) 28%,var(--border))', background: 'color-mix(in srgb,var(--danger) 7%,var(--card))' }}>
            <strong style={{ display: 'block', color: 'var(--danger)', fontSize: FONT.base }}>ยังลบไม่ได้ เพราะมีการใช้งาน SDS ร่วม</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>แก้การเชื่อมโยงของรายการต่อไปนี้ก่อน แล้วกลับมาลบจากทะเบียนอีกครั้ง</p>
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--ink)', fontSize: FONT.sm }}>
              {impact.sharedDependencies.map(dependency => (
                <li key={`${dependency.kind}-${dependency.relatedRowId}`} style={{ marginBottom: 6 }}>
                  {dependency.label} <span style={{ color: 'var(--muted)' }}>({dependency.relatedHoldingLabel})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div style={{ marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--warning) 30%,var(--border))', background: 'color-mix(in srgb,var(--warning) 8%,var(--card))' }}>
              <strong style={{ display: 'block', color: 'var(--warning)', fontSize: FONT.base }}>การลบนี้ถาวรและย้อนคืนไม่ได้</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>ระบบจะลบรายการจากทะเบียน พร้อม SDS และการเผยแพร่ที่เป็นของรายการนี้ในคำสั่งเดียว ส่วน SDS ที่ยังถูกใช้ร่วมกับรายการอื่นจะเก็บไว้</p>
            </div>

            <section style={{ marginTop: SPACE.lg }} aria-labelledby="holding-delete-impact-rows">
              <h3 id="holding-delete-impact-rows" style={{ margin: 0, color: 'var(--ink)', fontSize: FONT.base }}>ข้อมูลที่จะลบ</h3>
              <ul style={{ margin: '9px 0 0', paddingLeft: 20, color: 'var(--ink)', fontSize: FONT.sm }}>
                {impact.versions.filter(version => version.willDelete).map(version => (
                  <li key={`version-${version.id}`} style={{ marginBottom: 5 }}>
                    SDS version {version.revisionLabel ?? version.id} ({version.status})
                  </li>
                ))}
                {impact.publications.map(publication => (
                  <li key={`publication-${publication.id}`} style={{ marginBottom: 5 }}>
                    เผยแพร่ไปยัง {destinationLabel(publication.destination, publication.departmentCode)}: {publication.displayName}
                  </li>
                ))}
                {impact.departmentSds.map(departmentSds => (
                  <li key={`department-sds-${departmentSds.id}`} style={{ marginBottom: 5 }}>
                    SDS งาน {departmentSds.departmentCode}: {departmentSds.displayName}
                  </li>
                ))}
                {impact.versions.filter(version => version.willDelete).length === 0 && impact.publications.length === 0 && impact.departmentSds.length === 0 && (
                  <li>ข้อมูล SDS ที่เชื่อมโยงกับรายการนี้</li>
                )}
              </ul>
            </section>

            {impact.sharedDependencies.length > 0 && (
              <section style={{ marginTop: SPACE.md }} aria-labelledby="holding-delete-shared-sds">
                <h3 id="holding-delete-shared-sds" style={{ margin: 0, color: 'var(--ink)', fontSize: FONT.base }}>SDS ที่เก็บไว้เพราะยังมีการใช้งาน</h3>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>ระบบจะตัดเฉพาะการเชื่อมโยงของรายการนี้ ไม่ลบ SDS ที่รายการทะเบียนอื่นยังใช้อยู่</p>
                <ul style={{ margin: '7px 0 0', paddingLeft: 20, color: 'var(--muted)', fontSize: FONT.sm }}>
                  {impact.versions.filter(version => !version.willDelete).map(version => (
                    <li key={`kept-version-${version.id}`}>SDS version {version.revisionLabel ?? version.id} ยังเก็บไว้ให้รายการอื่นใช้งาน</li>
                  ))}
                  {impact.sharedDependencies.map(dependency => <li key={`kept-${dependency.kind}-${dependency.relatedRowId}`}>{dependency.label}</li>)}
                </ul>
              </section>
            )}

            {impact.filesToKeep.length > 0 && (
              <section style={{ marginTop: SPACE.md }} aria-labelledby="holding-delete-kept-files">
                <h3 id="holding-delete-kept-files" style={{ margin: 0, color: 'var(--ink)', fontSize: FONT.base }}><Icon name="doc" size={14} /> ไฟล์ที่เก็บไว้</h3>
                <ul style={{ margin: '7px 0 0', paddingLeft: 20, color: 'var(--muted)', fontSize: FONT.sm }}>
                  {impact.filesToKeep.map(file => <li key={file.id}>{file.fileName} — {file.reason}</li>)}
                </ul>
              </section>
            )}

            {impact.filesToDelete.length > 0 && (
              <p style={{ margin: `${SPACE.md}px 0 0`, color: 'var(--muted)', fontSize: FONT.sm }}>
                ไฟล์ที่ไม่มีการอ้างอิงอื่นและจะถูกลบ: {impact.filesToDelete.map(file => file.fileName).join(', ')}
              </p>
            )}
          </>
        )}

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.lg }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>ปิด</Button>
          {!blocked && (
            <Button variant="danger" onClick={onConfirm} disabled={busy}>
              {busy ? 'กำลังลบ…' : 'ยืนยันลบถาวร'}
            </Button>
          )}
        </footer>
      </section>
    </div>
  )
}
