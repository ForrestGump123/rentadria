import { useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS } from '../../data/cities/countryIds'
import type { ListingCategory } from '../../types'
import type { SubscriptionPlan } from '../../types/plan'
import { isSubscriptionPlan } from '../../types/plan'
import {
  type AdminOwnerMeta,
  getAdminOwnerMeta,
  setAdminOwnerMeta,
} from '../../utils/adminOwnerMeta'
import { getListingById } from '../../data/listings'
import {
  formatDateDots,
  getAllOwnerProfilesForAdmin,
  getOwnerListings,
  getOwnerProfileByUserId,
  saveOwnerProfileForAdmin,
  softDeleteOwnerUser,
  type OwnerProfile,
} from '../../utils/ownerSession'
import { isAdminSession } from '../../utils/adminSession'
import { sha256Hex } from '../../utils/passwordHash'

const CATS: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

const COUNTRY_FILTER_ORDER: ('all' | SearchCountryId)[] = [
  'all',
  'me',
  'rs',
  'hr',
  'ba',
  'al',
  'it',
  'es',
]

export function AdminOwnersPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState<'all' | SearchCountryId>('all')
  const [viewProfile, setViewProfile] = useState<OwnerProfile | null>(null)
  const [editProfile, setEditProfile] = useState<OwnerProfile | null>(null)
  const [editMeta, setEditMeta] = useState<AdminOwnerMeta | null>(null)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const profiles = useMemo(() => {
    void epoch
    return getAllOwnerProfilesForAdmin()
  }, [epoch])

  const filtered = useMemo(() => {
    let list = profiles
    if (countryFilter !== 'all') {
      list = list.filter((p) => p.countryId === countryFilter)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.userId.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q),
    )
  }, [profiles, search, countryFilter])

  const openEdit = (p: OwnerProfile) => {
    const fresh = getOwnerProfileByUserId(p.userId) ?? p
    setEditProfile({ ...fresh })
    setEditMeta({ ...getAdminOwnerMeta(p.userId) })
  }

  const viewPublicListing = (p: OwnerProfile) => {
    const rows = getOwnerListings(p.userId).filter((r) => Boolean(r.publicListingId))
    for (const r of rows) {
      const pid = r.publicListingId!
      if (getListingById(pid)) {
        navigate(`/listing/${pid}`)
        return
      }
    }
    window.alert(t('admin.owners.noPublicListing'))
  }

  const saveEdit = async () => {
    if (!editProfile || !editMeta) return
    let next = { ...editProfile }
    const pw = (document.getElementById('admin-owner-pw') as HTMLInputElement | null)?.value?.trim()
    if (pw) {
      next = { ...next, passwordHash: await sha256Hex(pw) }
    }
    if (next.plan != null && !isSubscriptionPlan(next.plan)) {
      window.alert(t('admin.owners.planInvalid'))
      return
    }
    saveOwnerProfileForAdmin(next.userId, next)
    setAdminOwnerMeta(next.userId, editMeta)
    setEditProfile(null)
    setEditMeta(null)
    bump()
  }

  const toggleBlock = (p: OwnerProfile) => {
    const m = getAdminOwnerMeta(p.userId)
    setAdminOwnerMeta(p.userId, { ...m, blocked: !m.blocked })
    bump()
  }

  const delOwner = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.owners.confirmSoftDelete'))) return
    softDeleteOwnerUser(p.userId)
    bump()
  }

  if (!isAdminSession()) {
    return null
  }

  return (
    <div className="ra-admin-owners">
      <Helmet>
        <title>{t('admin.owners.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.owners.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.owners.lead')}</p>
        <p className="ra-admin-owners__hint">{t('admin.owners.hintXml')}</p>
        <p className="ra-admin-owners__hint">{t('admin.owners.hintPlan')}</p>
      </header>

      <div className="ra-admin-owners__chips" role="group" aria-label={t('admin.owners.countryFilterAria')}>
        {COUNTRY_FILTER_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`ra-admin-owners__chip ${countryFilter === id ? 'is-active' : ''}`}
            onClick={() => setCountryFilter(id)}
          >
            {id === 'all' ? t('admin.owners.filterAll') : t(`search.country_${id}`)}
          </button>
        ))}
      </div>

      <div className="ra-admin-listings__toolbar">
        <label className="ra-admin-listings__toolbar-fld ra-admin-owners__search-fld">
          <span className="ra-sr-only">{t('admin.owners.search')}</span>
          <input
            type="search"
            className="ra-admin-listings__search"
            placeholder={t('admin.owners.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table ra-admin-owners__table">
          <thead>
            <tr>
              <th>{t('admin.owners.colId')}</th>
              <th>{t('admin.owners.colName')}</th>
              <th>{t('admin.owners.colEmail')}</th>
              <th>{t('admin.owners.colPhone')}</th>
              <th>{t('admin.owners.colCountry')}</th>
              <th>{t('admin.owners.colPassword')}</th>
              <th>{t('admin.owners.colReg')}</th>
              <th>{t('admin.owners.colExpires')}</th>
              <th>{t('admin.owners.colStatus')}</th>
              <th>{t('admin.owners.colXml')}</th>
              <th>{t('admin.owners.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const meta = getAdminOwnerMeta(p.userId)
              const vu = p.validUntil ? formatDateDots(p.validUntil) : '—'
              const reg = p.registeredAt ? formatDateDots(p.registeredAt) : '—'
              const active = p.subscriptionActive && p.plan != null
              const countryLabel =
                p.countryId && (SEARCH_COUNTRY_IDS as readonly string[]).includes(p.countryId)
                  ? t(`search.country_${p.countryId}`)
                  : '—'
              return (
                <tr key={p.userId}>
                  <td className="ra-admin-listings__mono">{p.userId.slice(0, 18)}…</td>
                  <td>{p.displayName}</td>
                  <td>{p.email}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>{countryLabel}</td>
                  <td>{p.passwordHash ? '••••••••' : '—'}</td>
                  <td>{reg}</td>
                  <td>{vu}</td>
                  <td>
                    {active ? (
                      <span className="ra-admin-owners__badge ra-admin-owners__badge--ok">{t('admin.owners.active')}</span>
                    ) : (
                      <span className="ra-admin-owners__badge">{t('admin.owners.inactive')}</span>
                    )}
                    {meta.blocked && (
                      <span className="ra-admin-owners__badge ra-admin-owners__badge--block">{t('admin.owners.blocked')}</span>
                    )}
                  </td>
                  <td className="ra-admin-listings__mono">{meta.xmlImportUrl ? '✓' : '—'}</td>
                  <td className="ra-admin-listings__actions ra-admin-owners__actions-row">
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-view" onClick={() => viewPublicListing(p)}>
                      {t('admin.owners.view')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-edit" onClick={() => openEdit(p)}>
                      {t('admin.owners.edit')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-del" onClick={() => delOwner(p)}>
                      {t('admin.owners.delete')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-owners__btn-block" onClick={() => toggleBlock(p)}>
                      {meta.blocked ? t('admin.owners.unblock') : t('admin.owners.block')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="ra-admin-listings__empty">{t('admin.owners.empty')}</p>}
      </div>

      {editProfile && editMeta && (
        <div className="ra-modal" role="dialog" onClick={() => setEditProfile(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal ra-admin-owners__modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{t('admin.owners.editTitle')}</h2>
            <label className="ra-fld">
              <span>{t('admin.owners.fldName')}</span>
              <input
                value={editProfile.displayName}
                onChange={(e) => setEditProfile({ ...editProfile, displayName: e.target.value })}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.owners.fldEmail')}</span>
              <input
                type="email"
                value={editProfile.email}
                onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.owners.fldPhone')}</span>
              <input
                value={editProfile.phone ?? ''}
                onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.owners.fldCountry')}</span>
              <select
                value={editProfile.countryId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setEditProfile({
                    ...editProfile,
                    countryId: v === '' ? undefined : (v as SearchCountryId),
                  })
                }}
              >
                <option value="">{t('admin.owners.countryUnset')}</option>
                {SEARCH_COUNTRY_IDS.map((cid) => (
                  <option key={cid} value={cid}>
                    {t(`search.country_${cid}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ra-fld">
              <span>{t('admin.owners.fldPassword')}</span>
              <input id="admin-owner-pw" type="password" autoComplete="new-password" placeholder={t('admin.owners.fldPasswordHint')} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.owners.fldPlan')}</span>
              <select
                value={editProfile.plan ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  const plan = v === '' ? null : (v as SubscriptionPlan)
                  setEditProfile({
                    ...editProfile,
                    plan,
                    subscriptionActive: plan != null,
                  })
                }}
              >
                <option value="">{t('admin.owners.noPlan')}</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="agency">Agency</option>
              </select>
            </label>
            <label className="ra-fld ra-fld--row">
              <input
                type="checkbox"
                checked={editProfile.subscriptionActive ?? false}
                onChange={(e) => setEditProfile({ ...editProfile, subscriptionActive: e.target.checked })}
              />
              <span>{t('admin.owners.fldSubActive')}</span>
            </label>
            <h3 className="ra-admin-owners__h3">{t('admin.owners.planExtras')}</h3>
            <div className="ra-admin-owners__extras">
              <label>
                {t('nav.accommodation')}:{' '}
                <input
                  type="number"
                  min={0}
                  value={editMeta.extraListingsAcc}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, extraListingsAcc: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <label>
                {t('nav.car')}:{' '}
                <input
                  type="number"
                  min={0}
                  value={editMeta.extraListingsCar}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, extraListingsCar: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <label>
                {t('nav.motorcycle')}:{' '}
                <input
                  type="number"
                  min={0}
                  value={editMeta.extraListingsMoto}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, extraListingsMoto: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
            </div>
            <div className="ra-admin-owners__cat-row">
              <label className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={editMeta.extraCatAcc}
                  onChange={(e) => setEditMeta({ ...editMeta, extraCatAcc: e.target.checked })}
                />
                {t('admin.owners.extraCat')} — {t('nav.accommodation')}
              </label>
              <label className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={editMeta.extraCatCar}
                  onChange={(e) => setEditMeta({ ...editMeta, extraCatCar: e.target.checked })}
                />
                {t('admin.owners.extraCat')} — {t('nav.car')}
              </label>
              <label className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={editMeta.extraCatMoto}
                  onChange={(e) => setEditMeta({ ...editMeta, extraCatMoto: e.target.checked })}
                />
                {t('admin.owners.extraCat')} — {t('nav.motorcycle')}
              </label>
            </div>
            <div className="ra-admin-owners__modal-actions">
              <button type="button" className="ra-btn" onClick={() => setEditProfile(null)}>
                {t('admin.owners.cancel')}
              </button>
              <button type="button" className="ra-btn ra-btn--primary" onClick={() => void saveEdit()}>
                {t('admin.owners.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
