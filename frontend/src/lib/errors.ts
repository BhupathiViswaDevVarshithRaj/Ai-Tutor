import { ApiError } from './api/client'

/** User-facing message for any thrown value from an API call. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Could not reach the server. Check your connection and try again.'
}
