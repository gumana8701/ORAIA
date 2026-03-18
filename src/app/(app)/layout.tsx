import Sidebar from '@/components/Sidebar'
import VoiceWidget from '@/components/VoiceWidget'
import { ThemeProvider } from '@/lib/ThemeContext'
import { getSessionProfile } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile().catch(() => null)
  const role = profile?.rol ?? 'developer'

  return (
    <ThemeProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar role={role} />
        <main
          className="dot-bg"
          style={{
            flex: 1, minHeight: '100vh',
            padding: '40px 40px 40px 48px',
            position: 'relative', overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
      <VoiceWidget />
    </ThemeProvider>
  )
}
