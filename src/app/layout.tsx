import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import VoiceWidget from '@/components/VoiceWidget'
import { ThemeProvider } from '@/lib/ThemeContext'

export const metadata: Metadata = {
  title: 'ORA IA — Centro de Proyectos',
  description: 'Hub de gestión de proyectos ORA IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ minHeight: '100vh' }}>
        <ThemeProvider>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main
              className="dot-bg"
              style={{
                flex: 1,
                minHeight: '100vh',
                padding: '40px 40px 40px 48px',
                position: 'relative',
                overflowX: 'hidden',
              }}
            >
              {children}
            </main>
          </div>
          <VoiceWidget />
        </ThemeProvider>
      </body>
    </html>
  )
}
