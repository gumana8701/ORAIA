'use client'
import { useEffect } from 'react'
import { useVoiceProject } from '@/lib/VoiceProjectContext'

/**
 * Drop this on any project page to tell BOB which project is active.
 * Clears the context on unmount (when navigating away).
 */
export default function SetVoiceProject({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const { setCurrentProject } = useVoiceProject()

  useEffect(() => {
    setCurrentProject({ projectId, projectName })
    return () => setCurrentProject(null)
  }, [projectId, projectName, setCurrentProject])

  return null
}
