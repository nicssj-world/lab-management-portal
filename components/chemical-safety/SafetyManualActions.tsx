export function SafetyManualActions({ code, title }: { code: string; title: string }) {
  return (
    <div className="manual-actions">
      <a className="manual-download" href={`/api/public/safety-manual/${code}?disposition=attachment`}>ดาวน์โหลด {code} (PDF)</a>
      <a
        href={`/api/public/safety-manual/${code}?disposition=inline`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`เปิด ${title} ในแท็บใหม่`}
      >
        เปิดอ่าน
      </a>
    </div>
  )
}
