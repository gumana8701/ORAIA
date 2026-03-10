import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ORA IA — Centro de Proyectos',
  description: 'Hub de gestión de proyectos ORA IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
