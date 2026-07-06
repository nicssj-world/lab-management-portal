import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { H2, H3, P, Callout, Section } from '../_primitives'
import { OUTLAB_PARTNERS, type Lang } from '../data'

interface Props { lang: Lang }

// ─── Timeline step ────────────────────────────────────────────────────────────

interface TimelineStepProps {
  role: string
  color: string
  bg: string
  borderColor: string
  icon: string
  steps: React.ReactNode[]
  isLast?: boolean
}

function TimelineStep({ role, color, bg, borderColor, icon, steps, isLast = false }: TimelineStepProps) {
  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Spine: icon dot + vertical connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: bg, border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={icon as any} size={16} style={{ color }} />
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, minHeight: 20, background: 'var(--border)', margin: '4px 0' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingLeft: 14, paddingBottom: isLast ? 0 : 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: bg, border: `1px solid ${borderColor}`,
          color, fontWeight: 700, fontSize: 11.5,
          padding: '4px 12px', borderRadius: 20,
          marginBottom: 10, marginTop: 6,
          letterSpacing: '.03em',
        }}>
          {role}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${color}`,
              fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.75,
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Connector for inline splits (no role) ────────────────────────────────────

function TimelineConnector({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
        <div style={{ width: 2, flex: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ flex: 1, paddingLeft: 14, paddingBottom: 28 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Document chain ───────────────────────────────────────────────────────────

function DocChain({ steps, color = 'var(--primary)', bg = 'var(--primary-soft)', borderColor = 'rgba(30,95,173,.25)' }: {
  steps: string[]
  color?: string
  bg?: string
  borderColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <span style={{
            background: bg, color,
            border: `1px solid ${borderColor}`,
            fontWeight: 700, fontSize: 12.5,
            padding: '4px 12px', borderRadius: 8,
            whiteSpace: 'nowrap',
          }}>{s}</span>
          {i < steps.length - 1 && (
            <Icon name="arrowRight" size={13} style={{ color, opacity: .7, flexShrink: 0 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualOutLab({ lang }: Props) {
  const govt = OUTLAB_PARTNERS.filter((p) => p.sector === 'gov')
  const priv = OUTLAB_PARTNERS.filter((p) => p.sector === 'priv')

  return (
    <>
      {/* ── Overview ── */}
      <Section>
        <H2 eyebrow="06 · Send-out">
          {lang === 'th' ? 'การใช้บริการ OUT LAB' : 'OUT LAB Service'}
        </H2>
        <P>
          {lang === 'th'
            ? 'รายการตรวจที่ยังไม่เปิดให้บริการในโรงพยาบาลจะถูกส่งต่อไปยังห้องปฏิบัติการคู่สัญญาที่ได้รับการรับรองมาตรฐาน โดยห้อง OUT LAB (โทร. 1461) เป็นผู้รับผิดชอบการบรรจุ ขนส่ง ติดตามผล และคืนรายงานผ่าน HIS'
            : 'Tests not performed in-house are forwarded to accredited reference laboratories. The OUT LAB section (ext. 1461) handles packaging, shipment, follow-up, and returning the result via HIS.'}
        </P>

        <H3>{lang === 'th' ? 'หน่วยงานที่ส่งตรวจต่อ — ภาครัฐ' : 'Reference labs — government'}</H3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {govt.map((o) => (
            <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="building" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.brand} · {o.accred}</div>
              </div>
              <Badge color="blue" size="sm">ภาครัฐ</Badge>
            </div>
          ))}
        </div>

        <H3>{lang === 'th' ? 'ภาคเอกชน' : 'Reference labs — private sector'}</H3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {priv.map((o) => (
            <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(22,163,74,.10)', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="building" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.brand} · {o.accred}</div>
              </div>
              <Badge color="green" size="sm">เอกชน</Badge>
            </div>
          ))}
        </div>

        <Callout tone="info" icon="mail">
          {lang === 'th'
            ? 'การส่ง OUT LAB ทุกครั้ง ห้องปฏิบัติการจะติดตามผลและบันทึกเข้าระบบ HIS ของโรงพยาบาลอัตโนมัติ — แพทย์ไม่ต้องโทรติดตามด้วยตนเอง'
            : 'For every OUT LAB send-out, the lab tracks the result and auto-attaches it to HIS — no manual follow-up needed.'}
        </Callout>
      </Section>

      {/* ── Flow 1 ── */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 6, flexShrink: 0, marginTop: 2 }}>FLOW 1</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.25 }}>
              การส่งตรวจ Lab นอก รพ. — ผู้ป่วยโครงการ / ใบสอบสวนโรค / สิทธิ สปสช.
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
              สำหรับผู้ป่วยที่เข้าโครงการ (ลำดับที่ 1–30) หรือมีใบสอบสวนโรค หรือเข้าเกณฑ์การรักษาผู้ป่วยรายโรคในระบบหลักประกันสุขภาพแห่งชาติ
            </p>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <TimelineStep
            role="แพทย์ / พยาบาล"
            color="var(--primary)" bg="var(--primary-soft)" borderColor="rgba(30,95,173,.3)"
            icon="syringe"
            steps={[
              <>บันทึกรายการส่งตรวจ Lab นอก รพ. ในระบบ HIS และพิมพ์ <strong>ใบนำส่งตรวจ LAB</strong> พร้อมแนบ<strong>แบบฟอร์มโครงการ</strong> หรือ<strong>แบบฟอร์มสอบสวนโรค</strong> หรือตราประทับโครงการ พร้อมลงนาม และระบุเลข E-Phis (ถ้ามี)</>,
              <div style={{ background: 'rgba(217,119,6,.08)', borderLeft: 'none', margin: '-12px -16px', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(217,119,6,.25)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="alert" size={15} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
                <span><strong>กรณีส่ง BRCA</strong> ต้องผ่านศูนย์มะเร็ง <strong>โทร. 1736 ทุกเคสก่อนส่ง</strong></span>
              </div>,
            ]}
          />

          <TimelineStep
            role="การเงิน"
            color="#B45309" bg="rgba(217,119,6,.08)" borderColor="rgba(217,119,6,.3)"
            icon="doc"
            steps={[
              <>ตรวจสอบหลักฐานจากใบนำส่งตรวจว่าเป็นโครงการหรือสอบสวนโรค และมีลายเซ็นอาจารย์แพทย์ / เลข E-Phis จึง<strong>ลงนาม</strong>และประทับตรา <strong>"ตรวจสอบแล้ว"</strong></>,
            ]}
          />

          <TimelineStep
            role="ห้อง Lab"
            color="#15803D" bg="rgba(22,163,74,.08)" borderColor="rgba(22,163,74,.3)"
            icon="flask"
            isLast
            steps={[
              <><strong>ผู้ป่วยนอก (OPD ชั้น 2)</strong> — ตรวจสอบว่ามีรายเซ็นของ จนท.การเงิน และตราประทับ "ตรวจสอบแล้ว" จึงดำเนินการเจาะเลือด เก็บสิ่งตัวอย่าง และนำส่งงานตรวจต่อ (โทร. 1461)</>,
              <><strong>ผู้ป่วยใน</strong> — นำส่งสิ่งตัวอย่างที่ห้อง Lab ชั้น 3 ตึกเฉลิมราชสมบัติ (โทร. 1461) จนท.ตรวจสอบหลักฐานมีรายเซ็น จนท.การเงิน และ "ตรวจสอบแล้ว" จึงลงทะเบียนรับและนำส่งห้องปฏิบัติการตรวจต่อ</>,
            ]}
          />
        </div>

        {/* Documents */}
        <div style={{ marginTop: 4, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>เอกสารที่ต้องแนบ</div>
          <DocChain steps={['ใบนำส่งตรวจ LAB', 'แบบฟอร์มโครงการ / สอบสวนโรค', 'ลายเซ็นแพทย์ + เลข E-Phis']} />
        </div>
      </Section>

      {/* ── Flow 2 ── */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#7C3AED', color: '#fff', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 6, flexShrink: 0, marginTop: 2 }}>FLOW 2</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.25 }}>
              การส่งตรวจ Lab นอก รพ. — ผู้ป่วยชำระเงิน หรือขออนุเคราะห์
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
              สำหรับผู้ป่วยที่ไม่เข้าโครงการหรือสอบสวนโรค ให้ชำระเงิน หรือผ่านสังคมสงเคราะห์
            </p>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <TimelineStep
            role="แพทย์ / พยาบาล"
            color="var(--primary)" bg="var(--primary-soft)" borderColor="rgba(30,95,173,.3)"
            icon="syringe"
            steps={[
              <>บันทึกรายการส่งตรวจ Lab นอก รพ. ในระบบ HIS และพิมพ์ <strong>ใบนำส่งตรวจ LAB</strong> → ให้ผู้ป่วย <strong>"ชำระเงิน"</strong> ที่การเงิน</>,
              <><strong>กรณีผู้ป่วยไม่สามารถชำระเงินได้</strong> ให้ผู้ป่วย <strong>"ขออนุเคราะห์"</strong> โดยแพทย์ผู้รักษาเลือก ☑ ขออนุเคราะห์รายการ LAB นอก รพ. พร้อมลงนาม และระบุเลข E-Phis → ส่ง<strong>สังคมสงเคราะห์</strong></>,
            ]}
          />

          {/* Path split */}
          <TimelineConnector>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>เส้นทางเอกสาร</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.25)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="check" size={13} style={{ color: 'var(--primary)' }} />
                  กรณีชำระเงิน
                </div>
                <DocChain steps={['ใบนำส่งตรวจ', 'การเงิน', 'ห้อง LAB']} />
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(124,58,237,.07)', border: '1px solid rgba(124,58,237,.25)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C3AED', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="users" size={13} style={{ color: '#7C3AED' }} />
                  กรณีขออนุเคราะห์
                </div>
                <DocChain
                  steps={['ใบนำส่งตรวจ', 'สังคมสงเคราะห์', 'การเงิน', 'ห้อง LAB']}
                  color="#7C3AED" bg="rgba(124,58,237,.1)" borderColor="rgba(124,58,237,.3)"
                />
              </div>
            </div>
          </TimelineConnector>

          <TimelineStep
            role="การเงิน"
            color="#B45309" bg="rgba(217,119,6,.08)" borderColor="rgba(217,119,6,.3)"
            icon="doc"
            steps={[
              <><strong>กรณีชำระเงิน</strong> — จนท.การเงินลงนาม พร้อมประทับตรา <strong>"ชำระเงิน"</strong></>,
              <><strong>กรณีขออนุเคราะห์</strong> — ตรวจสอบหลักฐานต้องมีลายเซ็น จนท.สังคมสงเคราะห์ และลายเซ็นอาจารย์แพทย์ จึงลงนามและประทับตรา <strong>"ตรวจสอบแล้ว"</strong></>,
            ]}
          />

          <TimelineStep
            role="ห้อง Lab"
            color="#15803D" bg="rgba(22,163,74,.08)" borderColor="rgba(22,163,74,.3)"
            icon="flask"
            isLast
            steps={[
              <><strong>ผู้ป่วยนอก (OPD ชั้น 2)</strong> — ตรวจสอบว่ามีรายเซ็น "ชำระเงิน" หรือ "ตรวจสอบแล้ว" จึงดำเนินการเจาะเลือด เก็บสิ่งตัวอย่าง และนำส่งงานตรวจต่อ (โทร. 1461)</>,
              <><strong>ผู้ป่วยใน</strong> — นำส่งสิ่งตัวอย่างที่ห้อง Lab ชั้น 3 ตึกเฉลิมราชสมบัติ (โทร. 1461) จนท.ตรวจสอบรายเซ็น จนท.การเงิน และ "ตรวจสอบแล้ว" จึงลงทะเบียนรับและนำส่งห้องปฏิบัติการตรวจต่อ</>,
            ]}
          />
        </div>

        <Callout tone="warning" icon="alert">
          กรณีส่ง <strong>BRCA</strong> ต้องผ่านศูนย์มะเร็ง <strong>โทร. 1736 ทุกเคสก่อนส่ง</strong> — ไม่ว่าจะเป็น Flow ใด
        </Callout>
      </Section>
    </>
  )
}
