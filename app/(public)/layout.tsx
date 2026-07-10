import { PublicNav } from '@/components/layout/PublicNav'
import { PublicFooter } from '@/components/layout/PublicFooter'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <style>{`
        .public-shell {
          --bg: #F6F8FB;
          --card: #FCFDFF;
          --surface-2: #EEF3F8;
          --border: #DDE6EF;
          --ink: #0B1626;
          --muted: #667589;
          --primary: #1E5FAD;
          --primary-2: #0E3F7E;
          --primary-soft: rgba(30,95,173,.11);
          --public-accent: #B08D57;
          --public-accent-soft: rgba(176,141,87,.13);
          --public-hairline: rgba(30,95,173,.16);
          --public-shadow-sm: 0 8px 22px rgba(11,22,38,.055);
          --public-shadow-md: 0 18px 48px rgba(11,22,38,.10);
          --public-shadow-lg: 0 28px 74px rgba(11,22,38,.16);
          background: var(--bg);
          color: var(--ink);
        }

        [data-theme="dark"] .public-shell {
          --bg: #0B1220;
          --card: #111B2B;
          --surface-2: #172438;
          --border: #27374C;
          --ink: #F4F7FB;
          --muted: #A8B4C3;
          --primary: #8DB6E3;
          --primary-2: #5E8DBE;
          --primary-soft: rgba(141,182,227,.16);
          --public-accent: #D0B071;
          --public-accent-soft: rgba(208,176,113,.14);
          --public-hairline: rgba(141,182,227,.20);
          --public-shadow-sm: 0 8px 24px rgba(0,0,0,.22);
          --public-shadow-md: 0 18px 52px rgba(0,0,0,.30);
          --public-shadow-lg: 0 28px 80px rgba(0,0,0,.38);
        }
      `}</style>
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
