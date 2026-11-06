import { createFileRoute } from '@tanstack/react-router'
import { clearSession } from '../../../server/auth/session'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: () => {
        clearSession()
        return new Response(null, { status: 204 })
      },
    },
  },
})
