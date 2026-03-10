'use client'
import { useRouter } from 'next/navigation'
import DeveloperAssigner from '@/components/DeveloperAssigner'
import { Developer, ProjectDeveloper } from '@/lib/types'

export default function DeveloperAssignerWrapper({
  projectId, allDevelopers, assigned
}: {
  projectId: string
  allDevelopers: Developer[]
  assigned: ProjectDeveloper[]
}) {
  const router = useRouter()
  return (
    <DeveloperAssigner
      projectId={projectId}
      allDevelopers={allDevelopers}
      assigned={assigned}
      onUpdate={() => router.refresh()}
    />
  )
}
