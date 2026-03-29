import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { isAdminSession } from '../../utils/adminSession'
import { listStaff, toggleStaffBlock, upsertStaff, type StaffRole } from '../../utils/adminStaffStore'
import { sha256Hex } from '../../utils/passwordHash'

export function AdminStaffPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('agent')

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-admin-staff-updated', on)
    return () => window.removeEventListener('rentadria-admin-staff-updated', on)
  }, [bump])

  const staff = useMemo(() => {
    void epoch
    return listStaff()
  }, [epoch])

  const cancelForm = () => {
    setEditing(false)
    setName('')
    setEmail('')
    setPassword('')
    setRole('agent')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) return
    const hash = await sha256Hex(password)
    upsertStaff({ name, email, passwordHash: hash, role, blocked: false })
    cancelForm()
    bump()
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.staff.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.staff.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.staff.lead')}</p>
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
                        toggleStaffBlock(s.id)
                        bump()
                      }}
                    >
                      {s.blocked ? t('admin.staff.unblock') : t('admin.staff.block')}
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
