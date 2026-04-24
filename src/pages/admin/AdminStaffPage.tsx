import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { isAdminSession } from '../../utils/adminSession'
import type { StaffMember, StaffRole } from '../../utils/adminStaffStore'
import { sha256Hex } from '../../utils/passwordHash'
import { deleteAdminStaffOnServer, fetchAdminStaffList, upsertAdminStaffToServer } from '../../lib/adminStaffApi'

export function AdminStaffPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<StaffMember[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('agent')
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState(false)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const remote = await fetchAdminStaffList()
      if (cancelled) return
      if (remote === null) {
        setLoadError(true)
        setRows([])
        return
      }
      setLoadError(false)
      setRows(remote)
    })()
    return () => {
      cancelled = true
    }
  }, [bump])

  const staff = useMemo(() => {
    void epoch
    return rows
  }, [rows, epoch])

  const refresh = async () => {
    const remote = await fetchAdminStaffList()
    if (remote === null) {
      setLoadError(true)
      return
    }
    setLoadError(false)
    setRows(remote)
  }

  const newId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `staff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const cancelForm = () => {
    setEditing(false)
    setName('')
    setEmail('')
    setPassword('')
    setRole('agent')
    setPermissions(new Set())
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) return
    const hash = await sha256Hex(password)
    await upsertAdminStaffToServer({
      id: newId(),
      name,
      email,
      passwordHash: hash,
      role,
      blocked: false,
      permissions: [...permissions],
    })
    cancelForm()
    await refresh()
  }

  if (!isAdminSession()) return null

  const togglePerm = (id: string) => {
    setPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const PERMS: { id: string; label: string }[] = [
    { id: 'admin.read', label: t('admin.staff.permRead') },
    { id: 'admin.write', label: t('admin.staff.permWrite') },
    { id: 'owners.read', label: t('admin.staff.permOwnersRead') },
    { id: 'owners.write', label: t('admin.staff.permOwnersWrite') },
    { id: 'listings.read', label: t('admin.staff.permListingsRead') },
    { id: 'listings.write', label: t('admin.staff.permListingsWrite') },
    { id: 'inquiries.read', label: t('admin.staff.permInquiriesRead') },
    { id: 'messages.read', label: t('admin.staff.permMessagesRead') },
    { id: 'promo.write', label: t('admin.staff.permPromoWrite') },
    { id: 'import.write', label: t('admin.staff.permImportWrite') },
  ]

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.staff.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.staff.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.staff.lead')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.staff.loadError')}</p> : null}
      </header>

      {!editing ? (
        <p>
          <button type="button" className="ra-btn ra-btn--primary" onClick={() => setEditing(true)}>
            {t('admin.staff.addMember')}
          </button>
        </p>
      ) : (
        <form className="ra-admin-staff-form ra-admin-gate__panel" onSubmit={save}>
          <h2>{t('admin.staff.newMember')}</h2>
          <label className="ra-fld">
            <span>{t('admin.staff.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="ra-fld">
            <span>{t('admin.staff.email')}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </label>
          <label className="ra-fld">
            <span>{t('admin.staff.password')}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </label>
          <label className="ra-fld">
            <span>{t('admin.staff.role')}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              <option value="agent">{t('admin.staff.roleAgent')}</option>
              <option value="subadmin">{t('admin.staff.roleSubadmin')}</option>
            </select>
          </label>
          <p className="ra-admin-owners__hint">{t('admin.staff.roleHint')}</p>
          <div className="ra-admin-promo__block">
            <p className="ra-admin-promo__label">{t('admin.staff.permissions')}</p>
            <div className="ra-admin-promo__checks">
              {PERMS.map((p) => (
                <label key={p.id} className="ra-admin-promo__chk">
                  <input type="checkbox" checked={permissions.has(p.id)} onChange={() => togglePerm(p.id)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ra-admin-owners__modal-actions">
            <button type="button" className="ra-btn" onClick={cancelForm}>
              {t('admin.owners.cancel')}
            </button>
            <button type="submit" className="ra-btn ra-btn--primary">
              {t('admin.staff.save')}
            </button>
          </div>
        </form>
      )}

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.staff.colName')}</th>
              <th>{t('admin.staff.colEmail')}</th>
              <th>{t('admin.staff.colRole')}</th>
              <th>{t('admin.staff.colStatus')}</th>
              <th>{t('admin.staff.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="ra-admin-listings__empty">
                  {t('admin.staff.empty')}
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.role === 'subadmin' ? t('admin.staff.roleSubadmin') : t('admin.staff.roleAgent')}</td>
                  <td>{s.blocked ? t('admin.staff.blocked') : t('admin.staff.active')}</td>
                  <td>
                    <button
                      type="button"
                      className="ra-btn ra-btn--sm"
                      onClick={() => {
                        void (async () => {
                          await upsertAdminStaffToServer({
                            id: s.id,
                            name: s.name,
                            email: s.email,
                            passwordHash: s.passwordHash ?? '',
                            role: s.role,
                            blocked: !s.blocked,
                            permissions: s.permissions ?? [],
                          })
                          await refresh()
                        })()
                      }}
                    >
                      {s.blocked ? t('admin.staff.unblock') : t('admin.staff.block')}
                    </button>
                    <button
                      type="button"
                      className="ra-btn ra-btn--sm ra-admin-listings__btn-del"
                      onClick={() => {
                        if (!window.confirm(t('admin.staff.confirmDelete'))) return
                        void (async () => {
                          await deleteAdminStaffOnServer(s.id)
                          await refresh()
                        })()
                      }}
                    >
                      {t('admin.staff.delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
