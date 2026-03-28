import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { SEARCH_COUNTRY_IDS } from '../../data/cities/countryIds'
import type { ListingCategory } from '../../types'
import type { OwnerProfile } from '../../utils/ownerSession'
import {
  type AdminListingRow,
  adminDeleteOwnerListing,
  buildAdminListingIndex,
} from '../../utils/adminListingsIndex'

const AccommodationListingModal = lazy(() =>
  import('../../components/owner/AccommodationListingModal').then((m) => ({
    default: m.AccommodationListingModal,
  })),
)

function adminProxyOwnerProfile(userId: string, displayName: string): OwnerProfile {
  const now = new Date().toISOString()
  const email = userId.includes('@')
    ? userId
    : `${userId.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40) || 'owner'}@owner.rentadria.local`
  return {
    userId,
    email,
    displayName: displayName.trim() || email.split('@')[0] || userId,
    plan: 'agency',
    subscriptionActive: true,
    registeredAt: now,
    validUntil: now,
  }
}

const CAT_ALL = '' as const
const COUNTRY_ALL = '' as const

export function AdminListingsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ListingCategory | ''>(CAT_ALL)
  const [country, setCountry] = useState<string>(COUNTRY_ALL)
  const [listEpoch, setListEpoch] = useState(0)
  const [editRow, setEditRow] = useState<AdminListingRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const allRows = useMemo(() => {
    void listEpoch
    return buildAdminListingIndex(t)
  }, [t, listEpoch])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((row) => {
      if (category && row.category !== category) return false
      if (country && country !== 'all') {
        if (row.countryKey !== country) return false
      }
      if (!q) return true
      return row.searchBlob.includes(q)
    })
  }, [allRows, search, category, country])

  const bump = useCallback(() => setListEpoch((e) => e + 1), [])

  const onEdit = (row: AdminListingRow) => {
    if (!row.isOwnerListing || !row.ownerRow) {
      window.alert(t('admin.listings.editMockHint'))
      return
    }
    setEditRow(row)
    setModalOpen(true)
  }

  const onDelete = (row: AdminListingRow) => {
    if (!row.isOwnerListing || !row.ownerRow) {
      window.alert(t('admin.listings.deleteMockHint'))
      return
    }
    if (!window.confirm(t('admin.listings.confirmDelete'))) return
    adminDeleteOwnerListing(row.ownerUserId, row.ownerRow)
    bump()
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditRow(null)
  }

  const onSaved = () => {
    bump()
    closeModal()
  }

  const editProfile = editRow
    ? adminProxyOwnerProfile(editRow.ownerUserId, editRow.ownerDisplayName)
    : null

  return (
    <div className="ra-admin-listings">
      <Helmet>
        <title>{t('admin.listings.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.listings.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.listings.lead')}</p>
      </header>

      <div className="ra-admin-listings__toolbar">
        <label className="ra-admin-listings__toolbar-fld">
          <span className="ra-sr-only">{t('admin.listings.searchLabel')}</span>
          <input
            type="search"
            className="ra-admin-listings__search"
            placeholder={t('admin.listings.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="ra-admin-listings__toolbar-fld">
          <span>{t('admin.listings.filterCategory')}</span>
          <select
            className="ra-admin-listings__select"
            value={category}
            onChange={(e) => setCategory(e.target.value as ListingCategory | '')}
          >
            <option value="">{t('admin.listings.filterAll')}</option>
            <option value="accommodation">{t('nav.accommodation')}</option>
            <option value="car">{t('nav.car')}</option>
            <option value="motorcycle">{t('nav.motorcycle')}</option>
          </select>
        </label>
        <label className="ra-admin-listings__toolbar-fld">
          <span>{t('admin.listings.filterCountry')}</span>
          <select
            className="ra-admin-listings__select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">{t('admin.listings.filterAll')}</option>
            {SEARCH_COUNTRY_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`search.country_${id}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th scope="col">{t('admin.listings.colId')}</th>
              <th scope="col">{t('admin.listings.colTitle')}</th>
              <th scope="col">{t('admin.listings.colCategory')}</th>
              <th scope="col">{t('admin.listings.colOwnerId')}</th>
              <th scope="col">{t('admin.listings.colOwner')}</th>
              <th scope="col">{t('admin.listings.colCountry')}</th>
              <th scope="col" className="ra-admin-listings__th-num">
                {t('admin.listings.colPrice')}
              </th>
              <th scope="col">{t('admin.listings.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.listingId}>
                <td className="ra-admin-listings__mono">{row.numericId}</td>
                <td>{row.title}</td>
                <td>{t(`nav.${row.category}`)}</td>
                <td>
                  <button
                    type="button"
                    className="ra-admin-listings__id-link"
                    onClick={() => setSearch(row.ownerUserId)}
                    title={t('admin.listings.filterByOwnerHint')}
                  >
                    {row.ownerIdSlug}
                  </button>
                </td>
                <td>{row.ownerDisplayName}</td>
                <td>
                  {row.countryKey
                    ? t(`search.country_${row.countryKey}`)
                    : t('admin.listings.countryUnknown')}
                </td>
                <td className="ra-admin-listings__price">{row.priceDisplay}</td>
                <td className="ra-admin-listings__actions">
                  <Link className="ra-btn ra-btn--sm ra-admin-listings__btn-view" to={`/listing/${row.listingId}`}>
                    {t('admin.listings.view')}
                  </Link>
                  <button
                    type="button"
                    className="ra-btn ra-btn--sm ra-admin-listings__btn-edit"
                    onClick={() => onEdit(row)}
                  >
                    {t('admin.listings.edit')}
                  </button>
                  <button
                    type="button"
                    className="ra-btn ra-btn--sm ra-admin-listings__btn-del"
                    onClick={() => onDelete(row)}
                  >
                    {t('admin.listings.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="ra-admin-listings__empty">{t('admin.listings.empty')}</p>
        )}
      </div>

      {modalOpen && editProfile && editRow?.ownerRow && (
        <Suspense fallback={<p className="ra-admin-listings__hint">{t('admin.listings.modalLoading')}</p>}>
          <AccommodationListingModal
            open={modalOpen}
            onClose={closeModal}
            profile={editProfile}
            formCategory={editRow.category}
            editingOwnerRowId={editRow.ownerRow.id}
            onSaved={onSaved}
          />
        </Suspense>
      )}
    </div>
  )
}
