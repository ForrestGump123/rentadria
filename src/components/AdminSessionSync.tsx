import { useEffect } from 'react'
import { syncAdminSessionWithServer } from '../utils/adminSession'

/** Clears stale admin UI state if HttpOnly session cookie is missing or invalid. */
export function AdminSessionSync() {
  useEffect(() => {
    void syncAdminSessionWithServer()
  }, [])
  return null
}
