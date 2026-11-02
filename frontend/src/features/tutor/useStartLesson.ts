import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { startLesson } from '../../lib/api/tutor'

/** Generate a lesson plan and open the new lesson's classroom. */
export function useStartLesson() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startLesson,
    onSuccess: ({ lesson }) => {
      queryClient.setQueryData(['lesson', lesson.id], lesson)
      void queryClient.invalidateQueries({ queryKey: ['lessons'] })
      navigate(`/app/tutor/${lesson.id}`)
    },
  })
}
