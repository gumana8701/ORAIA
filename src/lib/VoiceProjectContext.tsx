'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface VoiceProject {
  projectId: string
  projectName: string
}

interface VoiceProjectContextValue {
  currentProject: VoiceProject | null
  setCurrentProject: (p: VoiceProject | null) => void
}

const VoiceProjectContext = createContext<VoiceProjectContextValue>({
  currentProject: null,
  setCurrentProject: () => {},
})

export function VoiceProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<VoiceProject | null>(null)
  return (
    <VoiceProjectContext.Provider value={{ currentProject, setCurrentProject }}>
      {children}
    </VoiceProjectContext.Provider>
  )
}

export function useVoiceProject() {
  return useContext(VoiceProjectContext)
}
