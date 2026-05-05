import { useState, useCallback } from 'react'

/**
 * Reusable hook for save/update/delete operations against the API.
 *
 * Returns:
 *  - save(url, options) => Promise<{ ok, data }>
 *      where options = { method, body, onSuccess }
 *      Returns { ok: false } on failure (error is also set in state for UI display).
 *      Returns { ok: true, data } on success.
 *  - saving: boolean — true while a request is in flight
 *  - error: string — last error message, or '' if none
 *  - clearError(): void — manually clear the error (e.g. when reopening a modal)
 *
 * Error handling rules:
 *  1. Network errors (fetch throws) → error state set with err.message
 *  2. Non-2xx responses → tries to parse JSON body for { error } or { message },
 *     falls back to "Server returned <status>" if body isn't JSON.
 *  3. The hook never throws to the caller — every error path resolves with ok: false.
 *
 * Why a hook and not a util function: components need reactive saving/error
 * state to disable buttons, show banners, etc. Hooks compose this state
 * naturally with React's render cycle.
 */
export function useApiSave(token) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const clearError = useCallback(() => setError(''), [])

  const save = useCallback(async (url, options = {}) => {
    const { method = 'POST', body = null, onSuccess = null } = options
    setError('')
    setSaving(true)

    try {
      const fetchOptions = {
        method,
        headers: { Authorization: 'Bearer ' + token },
      }
      if (body !== null && body !== undefined) {
        fetchOptions.headers['Content-Type'] = 'application/json'
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
      }

      const r = await fetch(url, fetchOptions)

      if (!r.ok) {
        // Try to extract a useful error message from the response body
        let msg = `Server returned ${r.status}`
        try {
          const data = await r.json()
          if (data?.error) msg = data.error
          else if (data?.message) msg = data.message
        } catch {
          // Response wasn't JSON — fall back to status code message
        }
        setError(msg)
        return { ok: false, status: r.status, error: msg }
      }

      // Parse response — but tolerate empty bodies (e.g. 204 No Content)
      let data = null
      const contentType = r.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          data = await r.json()
        } catch {
          // JSON parse error on success response — unusual but not fatal
          data = null
        }
      }

      if (onSuccess) onSuccess(data)
      return { ok: true, data }
    } catch (err) {
      // Network error or unexpected exception
      const msg = err?.message || 'Network error'
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setSaving(false)
    }
  }, [token])

  return { save, saving, error, clearError, setError }
}