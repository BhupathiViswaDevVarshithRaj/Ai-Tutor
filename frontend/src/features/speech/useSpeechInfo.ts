import { useQuery } from '@tanstack/react-query'

import { getSpeechInfo } from '../../lib/api/speech'

export function useSpeechInfo() {
  return useQuery({ queryKey: ['speech-info'], queryFn: getSpeechInfo, staleTime: Infinity })
}
