import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../../types'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import {
  deleteAdminPromoOnServer,
  fetchAdminPromoList,
  fetchAdminOwnerPickList,
  upsertAdminPromoToServer,
  type AdminOwnerPickRow,
} from '../../lib/adminPromoApi'
import { isAdminSession } from '../../utils/adminSession'
import {
  ALL_PROMO_COUNTRIES,
  generatePromoCodeString,
  type AdminPromoCodeRecord,
  type PromoBenefitType,
} from '../../utils/adminPromoCodes'
import { formatDateDots } from '../../utils/ownerSession'

const CATS: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function benefitLabel(r: AdminPromoCodeRecord, t: (k: string, o?: Record<string, string | number>) => string): string {
  switch (r.type) {
    case 'discount_percent':
      return `${r.discountPercent ?? 0}%`
    case 'free_month':
      return t('admin.promo.benefitFreeMonth')
    case 'free_year':
      return t('admin.promo.benefitFreeYear')
    case 'free_forever':
      return t('admin.promo.benefitFreeForever')
    default:
      return '—'
  }
}

function statusKey(r: AdminPromoCodeRecord): 'active' | 'expired' | 'exhausted' {
  if (r.maxUses != null && r.uses >= r.maxUses) return 'exhausted'
  if (r.validUntil) {
    const end = new Date(r.validUntil)
    end.setHours(23, 59, 59, 999)
    if (Date.now() > end.getTime()) return 'expired'
  }
  return 'active'
}

export function AdminPromoPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<AdminPromoCodeRecord[]>([])
  const [loadError, setLoadError] = useState(false)
  const [ownerPickList, setOwnerPickList] = useState<AdminOwnerPickRow[]>([])
  const [ownersLoadError, setOwnersLoadError] = useState(false)

  const [editTarget, setEditTarget] = useState<AdminPromoCodeRecord | null>(null)
  const [type, setType] = useState<PromoBenefitType>('discount_percent')
  const [discountPercent, setDiscountPercent] = useState(20)
  const [validUntil, setValidUntil] = useState('')
  const [maxUses, setMaxUses] = useState<string>('1')
  const [note, setNote] = useState('')
  const [countries, setCountries] = useState<Set<SearchCountryId>>(new Set())
  const [maxPerCountry, setMaxPerCountry] = useState('')
  const [categories, setCategories] = useState<Set<ListingCategory>>(new Set())
  const [onlyMember, setOnlyMember] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)

  const resetFormDefaults = useCallback(() => {
    setType('discount_percent')
    setDiscountPercent(20)
    setValidUntil('')
    setMaxUses('1')
    setNote('')
    setCountries(new Set())
    setMaxPerCountry('')
    setCategories(new Set())
    setOnlyMember(false)
    setMemberUserId('')
    setMemberSearch('')
    setManualCode('')
    setShowManual(false)
  }, [])

  useEffect(() => {
    void fetchAdminOwnerPickList().then((list) => {
      if (list === null) setOwnersLoadError(true)
      else {
        setOwnersLoadError(false)
        setOwnerPickList(list)
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const remote = await fetchAdminPromoList()
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
  }, [])

  useEffect(() => {
    if (!editTarget) return
    setType(editTarget.type)
    setDiscountPercent(editTarget.discountPercent ?? 20)
    setValidUntil(isoToDateInput(editTarget.validUntil))
    setMaxUses(editTarget.maxUses != null ? String(editTarget.maxUses) : '')
    setNote(editTarget.note ?? '')
    setCountries(new Set(editTarget.countries ?? []))
    setMaxPerCountry(editTarget.maxUsesPerCountry != null ? String(editTarget.maxUsesPerCountry) : '')
    setCategories(new Set(editTarget.categories ?? []))
    const rid = editTarget.restrictedUserId
    setOnlyMember(!!rid)
    setMemberUserId(rid ?? '')
    setShowManual(false)
    setManualCode('')
  }, [editTarget])

  const filteredOwners = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return ownerPickList
    return ownerPickList.filter(
      (o) =>
        o.displayName.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        (o.phone && o.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))) ||
        (o.phone && o.phone.toLowerCase().includes(q)),
    )
  }, [ownerPickList, memberSearch])

  const toggleCountry = (c: SearchCountryId) => {
    setCountries((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const toggleCat = (c: ListingCategory) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const buildPayload = (code: string): Omit<AdminPromoCodeRecord, 'id' | 'createdAt' | 'uses' | 'usesByCountry'> => {
    const maxU = maxUses.trim() === '' ? null : Math.max(0, parseInt(maxUses, 10))
    const mpc = maxPerCountry.trim() === '' ? null : Math.max(0, parseInt(maxPerCountry, 10))
    const vu = validUntil.trim() ? new Date(validUntil + 'T12:00:00').toISOString() : null
    return {
      code,
      type,
      discountPercent: type === 'discount_percent' ? Math.min(100, Math.max(0, discountPercent)) : null,
      validUntil: vu,
      maxUses: Number.isNaN(maxU as number) ? null : maxU,
      countries: [...countries],
      maxUsesPerCountry: mpc !== null && Number.isNaN(mpc) ? null : mpc,
      categories: [...categories],
      restrictedUserId: onlyMember && memberUserId ? memberUserId : null,
      note: note.trim(),
    }
  }

  const newId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `promo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const refresh = async () => {
    const remote = await fetchAdminPromoList()
    if (remote === null) {
      setLoadError(true)
      return
    }
    setLoadError(false)
    setRows(remote)
  }

  const onGenerate = () => {
    if (editTarget) return
    const code = generatePromoCodeString()
    const full: AdminPromoCodeRecord = {
      id: newId(),
      createdAt: new Date().toISOString(),
      uses: 0,
      usesByCountry: {},
      ...buildPayload(code),
    }
    void (async () => {
      const ok = await upsertAdminPromoToServer(full)
      if (!ok) window.alert(t('admin.promo.errDuplicate'))
      resetFormDefaults()
      await refresh()
    })()
  }

  const onManual = () => {
    if (editTarget) return
    const code = manualCode.trim().toUpperCase().replace(/\s+/g, '')
    if (!code) {
      window.alert(t('admin.promo.errManualEmpty'))
      return
    }
    const full: AdminPromoCodeRecord = {
      id: newId(),
      createdAt: new Date().toISOString(),
      uses: 0,
      usesByCountry: {},
      ...buildPayload(code),
    }
    void (async () => {
      const ok = await upsertAdminPromoToServer(full)
      if (!ok) window.alert(t('admin.promo.errDuplicate'))
      resetFormDefaults()
      await refresh()
    })()
  }

  const onSaveEdit = () => {
    if (!editTarget) return
    const full: AdminPromoCodeRecord = {
      ...editTarget,
      ...buildPayload(editTarget.code),
      id: editTarget.id,
      code: editTarget.code,
      createdAt: editTarget.createdAt,
      uses: editTarget.uses,
      usesByCountry: { ...(editTarget.usesByCountry ?? {}) },
    }
    void (async () => {
      const ok = await upsertAdminPromoToServer(full)
      if (!ok) window.alert(t('admin.promo.errSave'))
      else {
        setEditTarget(null)
        resetFormDefaults()
        await refresh()
      }
    })()
  }

  const onCancelEdit = () => {
    setEditTarget(null)
    resetFormDefaults()
  }

  const onDelete = (id: string) => {
    if (!window.confirm(t('admin.promo.confirmDelete'))) return
    void (async () => {
      await deleteAdminPromoOnServer(id)
      if (editTarget?.id === id) {
        setEditTarget(null)
        resetFormDefaults()
      }
      await refresh()
    })()
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-promo">
      <Helmet>
        <title>{t('admin.promo.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.promo.pageTitle')}</h1>
        <p className="ra-admin-subtitle">{t('admin.promo.subtitle')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.promo.loadError')}</p> : null}
      </header>

      <section className="ra-admin-promo__form" aria-labelledby="promo-form-h">
        <h2 id="promo-form-h" className="ra-admin-promo__h2">
          {editTarget ? t('admin.promo.formTitleEdit') : t('admin.promo.formTitle')}
        </h2>
        {editTarget ? <p className="ra-admin-listings__hint">{t('admin.promo.editingCode', { code: editTarget.code })}</p> : null}
        {ownersLoadError ? <p className="ra-admin-listings__hint">{t('admin.promo.ownersLoadError')}</p> : null}

        <div className="ra-admin-promo__row ra-admin-promo__row--wrap">
          <label className="ra-fld">
            <span>{t('admin.promo.fldType')}</span>
            <select value={type} onChange={(e) => setType(e.target.value as PromoBenefitType)}>
              <option value="discount_percent">{t('admin.promo.typeDiscount')}</option>
              <option value="free_month">{t('admin.promo.typeFreeMonth')}</option>
              <option value="free_year">{t('admin.promo.typeFreeYear')}</option>
              <option value="free_forever">{t('admin.promo.typeFreeForever')}</option>
            </select>
          </label>
          {type === 'discount_percent' && (
            <label className="ra-fld">
              <span>{t('admin.promo.fldDiscount')}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
              />
            </label>
          )}
          <label className="ra-fld">
            <span>{t('admin.promo.fldValidUntil')}</span>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
          <label className="ra-fld">
            <span>{t('admin.promo.fldMaxUses')}</span>
            <input type="number" min={0} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </label>
          <label className="ra-fld ra-admin-promo__grow">
            <span>{t('admin.promo.fldNote')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.promo.notePh')} />
          </label>
        </div>

        <div className="ra-admin-promo__block">
          <p className="ra-admin-promo__label">{t('admin.promo.countriesHint')}</p>
          <div className="ra-admin-promo__checks">
            {ALL_PROMO_COUNTRIES.map((c) => (
              <label key={c} className="ra-admin-promo__chk">
                <input type="checkbox" checked={countries.has(c)} onChange={() => toggleCountry(c)} />
                <span>{SEARCH_COUNTRY_ISO[c]}</span>
              </label>
            ))}
          </div>
          <label className="ra-fld ra-admin-promo__inline-num">
            <span>{t('admin.promo.fldMaxPerCountry')}</span>
            <input
              type="number"
              min={0}
              placeholder="—"
              value={maxPerCountry}
              onChange={(e) => setMaxPerCountry(e.target.value)}
            />
          </label>
        </div>

        <div className="ra-admin-promo__block">
          <p className="ra-admin-promo__label">{t('admin.promo.categoriesLabel')}</p>
          <div className="ra-admin-promo__checks">
            {CATS.map((c) => (
              <label key={c} className="ra-admin-promo__chk">
                <input type="checkbox" checked={categories.has(c)} onChange={() => toggleCat(c)} />
                <span>{t(`nav.${c}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="ra-admin-promo__block">
          <label className="ra-admin-promo__member-top">
            <input type="checkbox" checked={onlyMember} onChange={(e) => setOnlyMember(e.target.checked)} />
            <span>{t('admin.promo.onlyMember')}</span>
          </label>
          {onlyMember && (
            <div className="ra-admin-promo__member-pick">
              <input
                type="search"
                className="ra-admin-promo__search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={t('admin.promo.memberSearchPh')}
                aria-label={t('admin.promo.memberSearchPh')}
              />
              <select
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                className="ra-admin-promo__select-owner"
              >
                <option value="">{t('admin.promo.memberPlaceholder')}</option>
                {filteredOwners.map((o) => (
                  <option key={o.userId} value={o.userId}>
                    {o.displayName} ({o.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="ra-admin-promo__actions">
          {editTarget ? (
            <>
              <button type="button" className="ra-btn ra-btn--primary" onClick={onSaveEdit}>
                {t('admin.promo.btnSaveEdit')}
              </button>
              <button type="button" className="ra-btn ra-btn--ghost" onClick={onCancelEdit}>
                {t('admin.promo.btnCancelEdit')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ra-btn ra-btn--primary" onClick={onGenerate}>
                {t('admin.promo.btnGenerate')}
              </button>
              <button type="button" className="ra-btn" onClick={() => setShowManual((v) => !v)}>
                {showManual ? t('admin.promo.btnHideManual') : t('admin.promo.btnManual')}
              </button>
            </>
          )}
        </div>
        <p className="ra-admin-promo__export-hint">{t('admin.promo.serverHint')}</p>

        {!editTarget && showManual && (
          <div className="ra-admin-promo__manual">
            <label className="ra-fld">
              <span>{t('admin.promo.manualCode')}</span>
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="RA-XXXX-XXXX"
                autoComplete="off"
              />
            </label>
            <button type="button" className="ra-btn ra-btn--primary" onClick={onManual}>
              {t('admin.promo.btnAddManual')}
            </button>
          </div>
        )}
      </section>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.promo.colCode')}</th>
              <th>{t('admin.promo.colType')}</th>
              <th>{t('admin.promo.colBenefit')}</th>
              <th>{t('admin.promo.colValidity')}</th>
              <th>{t('admin.promo.colUsed')}</th>
              <th>{t('admin.promo.colStatus')}</th>
              <th>{t('admin.promo.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="ra-admin-listings__empty">
                  {t('admin.promo.empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const st = statusKey(r)
                return (
                  <tr key={r.id}>
                    <td className="ra-admin-listings__mono">
                      <strong>{r.code}</strong>
                    </td>
                    <td>{t(`admin.promo.typeShort.${r.type}`)}</td>
                    <td>{benefitLabel(r, t)}</td>
                    <td className="ra-admin-promo__cell-sm">
                      {r.validUntil ? formatDateDots(r.validUntil) : t('admin.promo.noExpiry')}
                      {r.maxUses != null && (
                        <>
                          <br />
                          <span className="ra-admin-listings__hint">
                            {t('admin.promo.maxUsesLine', { n: r.maxUses })}
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {r.uses} / {r.maxUses ?? '∞'}
                    </td>
                    <td>
                      <span
                        className={
                          st === 'active'
                            ? 'ra-admin-promo__status ra-admin-promo__status--ok'
                            : 'ra-admin-promo__status ra-admin-promo__status--bad'
                        }
                      >
                        {t(`admin.promo.status.${st}`)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="ra-btn ra-btn--sm" onClick={() => setEditTarget(r)}>
                        {t('admin.promo.edit')}
                      </button>{' '}
                      <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-del" onClick={() => onDelete(r.id)}>
                        {t('admin.promo.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
