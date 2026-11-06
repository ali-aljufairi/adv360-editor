import { createServerFn } from '@tanstack/react-start'
import { getSessionUser } from './session'

/** Get the current session's public user. */
export const getSession = createServerFn({ method: 'GET' }).handler(() => getSessionUser())
