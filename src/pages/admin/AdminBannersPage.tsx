import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import {
  listBanners,
  replaceBannersFromServer,
  type AdminBannerItem,
  type BannerSlot,
} from '../../utils/adminBannersStore'
import { isAdminSession } from '../../utils/adminSession'
import {
  deleteAdminBannerOnServer,
  fetchAdminBanners,
  uploadAdminBannerImageViaApi,
  upsertAdminBannerOnServer,
} from '../../lib/adminBannersApi'

const SLOTS: { id: BannerSlot; icon: string }[] = [
  { id: 'slideshow', icon: '🖼' },
  { id: 'left', icon: '◀' },
  { id: 'right', icon: '▶' },
  { id: 'popup', icon: '✨' },
]

export function AdminBannersPage() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [epoch, setEpoch] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [slot, setSlot] = useState<BannerSlot>('slideshow')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  /** Nova slika (data URL) prije uploada u Storage. */
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  /** Postojeći javni URL sa servera (preview bez ponovnog učitavanja cijelog fajla). */
  const [persistedImageUrl, setPersistedImageUrl] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [countries, setCountries] = useState<Set<SearchCountryId>>(() => new Set(SEARCH_COUNTRY_IDS))
  /** yyyy-mm-dd; prazno = bez ograničenja */
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-admin-banners-updated', on)
    return () => window.removeEventListener('rentadria-admin-banners-updated', on)
  }, [bump])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchAdminBanners()
      if (cancelled) return
      if (!rows) {
        setLoadError(true)
        return
      }
      setLoadError(false)
      replaceBannersFromServer(rows)
      bump()
    })()
    return () => {
      cancelled = true
    }
  }, [bump])

  const rows = useMemo(() => {
    void epoch
    return listBanners().filter((b) => b.slot === slot)
  }, [epoch, slot])

  const allRowsSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  const toggleSelectAllRows = () => {
    if (allRowsSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)))
    }
  }

  const toggleRowSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCountry = (c: SearchCountryId) => {
    setCountries((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const toggleAllCountries = () => {
    if (countries.size === SEARCH_COUNTRY_IDS.length) {
      setCountries(new Set())
    } else {
      setCountries(new Set(SEARCH_COUNTRY_IDS))
    }
  }

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => {
      setImageRemoved(false)
      setPersistedImageUrl(null)
      setImageDataUrl(typeof r.result === 'string' ? r.result : null)
    }
    r.readAsDataURL(f)
  }

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => {
      setImageRemoved(false)
      setPersistedImageUrl(null)
      setImageDataUrl(typeof r.result === 'string' ? r.result : null)
    }
    r.readAsDataURL(f)
  }

  const resetForm = useCallback(() => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setImageDataUrl(null)
    setPersistedImageUrl(null)
    setImageRemoved(false)
    setStartDate('')
    setEndDate('')
    setCountries(new Set(SEARCH_COUNTRY_IDS))
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const beginEdit = (b: AdminBannerItem) => {
    setEditingId(b.id)
    setTitle(b.title)
    setDescription(b.description)
    const url = b.imageUrl?.trim() || null
    setPersistedImageUrl(url)
    setImageDataUrl(url ? null : b.imageDataUrl ?? null)
    setImageRemoved(false)
    setStartDate(b.startDate?.trim() ?? '')
    setEndDate(b.endDate?.trim() ?? '')
    if (b.countries.length === 0) setCountries(new Set(SEARCH_COUNTRY_IDS))
    else setCountries(new Set(b.countries))
  }

  const onSave = () => {
    if (countries.size === 0) {
      window.alert(t('admin.banners.pickCountry'))
      return
    }
    const sd = startDate.trim()
    const ed = endDate.trim()
    if (sd && ed) {
      const a = sd.localeCompare(ed)
      if (a > 0) {
        window.alert(t('admin.banners.dateInvalidRange'))
        return
      }
    }
    void (async () => {
      let imageUrl: string | undefined
      if (imageDataUrl?.startsWith('data:image/')) {
        const uploaded = await uploadAdminBannerImageViaApi(imageDataUrl)
        if (!uploaded) {
          window.alert(t('admin.banners.uploadFail'))
          return
        }
        imageUrl = uploaded
      }

      const r = await upsertAdminBannerOnServer({
        id: editingId,
        slot,
        title: title.trim() || t('admin.banners.untitled'),
        description: description.trim(),
        countries: countries.size === SEARCH_COUNTRY_IDS.length ? [] : [...countries],
        startDate: sd || undefined,
        endDate: ed || undefined,
        removeImage: imageRemoved,
        ...(imageUrl ? { imageUrl } : {}),
      })
      if (!r.ok) {
        const detail =
          r.error === 'image_too_large' ? t('admin.banners.imageTooLarge') : (r.error ?? 'save_failed')
        window.alert(t('admin.owners.serverSaveError', { detail }))
        return
      }
      const next = await fetchAdminBanners()
      if (next) replaceBannersFromServer(next)
      else window.alert(t('admin.banners.refetchFail'))
      resetForm()
      bump()
    })()
  }

  useEffect(() => {
    resetForm()
  }, [slot, resetForm])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [slot])

  if (!isAdminSession()) return null

  const previewSrc = imageRemoved ? null : imageDataUrl || persistedImageUrl

  return (
    <div className="ra-admin-banners">
      <Helmet>
        <title>{t('admin.nav.banners')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.nav.banners')}</h1>
        <p className="ra-admin-subtitle">{t('admin.banners.lead')}</p>
        <p className="ra-admin-banners__note">{t('admin.banners.serverNote')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.banners.loadError')}</p> : null}
      </header>

      <div className="ra-admin-banners__tabs" role="tablist" aria-label={t('admin.nav.banners')}>
        {SLOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={slot === s.id}
            className={`ra-admin-banners__tab ${slot === s.id ? 'is-active' : ''}`}
            onClick={() => setSlot(s.id)}
          >
            <span className="ra-admin-banners__tab-ico" aria-hidden>
              {s.icon}
            </span>
            {t(`admin.banners.slot.${s.id}`)}
          </button>
        ))}
      </div>

      <div className="ra-admin-banners__layout">
        <section className="ra-admin-banners__panel" aria-labelledby="bform">
          <h2 id="bform" className="ra-admin-banners__h2">
            {t('admin.banners.addNew')}
          </h2>

          <fieldset className="ra-admin-banners__fieldset">
            <legend className="ra-admin-banners__legend">{t('admin.banners.countries')}</legend>
            <div className="ra-admin-banners__chips">
              <button
                type="button"
                className={`ra-admin-banners__chip ra-admin-banners__chip--all ${countries.size === SEARCH_COUNTRY_IDS.length ? 'is-on' : ''}`}
                onClick={toggleAllCountries}
              >
                {t('admin.banners.allCountries')}
              </button>
              {SEARCH_COUNTRY_IDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ra-admin-banners__chip ${countries.has(c) ? 'is-on' : ''}`}
                  onClick={() => toggleCountry(c)}
                >
                  {SEARCH_COUNTRY_ISO[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="ra-fld ra-admin-banners__fld">
            <span>{t('admin.banners.title')}</span>
            <input
              className="ra-admin-banners__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="ra-fld ra-admin-banners__fld">
            <span>{t('admin.banners.description')}</span>
            <textarea
              className="ra-admin-banners__textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="ra-admin-banners__date-row">
            <label className="ra-fld ra-admin-banners__fld">
              <span>{t('admin.banners.dateFrom')}</span>
              <input
                type="date"
                className="ra-admin-banners__input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label={t('admin.banners.dateFrom')}
              />
            </label>
            <label className="ra-fld ra-admin-banners__fld">
              <span>{t('admin.banners.dateTo')}</span>
              <input
                type="date"
                className="ra-admin-banners__input"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label={t('admin.banners.dateTo')}
              />
            </label>
          </div>
          <p className="ra-admin-banners__date-hint">{t('admin.banners.dateHint')}</p>

          <div className="ra-fld ra-admin-banners__fld">
            <span>{t('admin.banners.image')}</span>
            <div
              className="ra-admin-banners__drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropFile}
            >
              {previewSrc ? (
                <div className="ra-admin-banners__preview-wrap">
                  <img src={previewSrc} alt="" className="ra-admin-banners__preview-img" />
                  <button
                    type="button"
                    className="ra-btn ra-btn--ghost ra-admin-banners__clear-img"
                    onClick={() => {
                      setImageDataUrl(null)
                      setPersistedImageUrl(null)
                      setImageRemoved(true)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    × {t('admin.banners.removeImage')}
                  </button>
                </div>
              ) : (
                <label className="ra-admin-banners__drop-label">
                  <input
                    ref={fileRef}
                    type="file"
                    className="ra-admin-banners__file"
                    accept="image/*"
                    onChange={onPickImage}
                  />
                  <span className="ra-admin-banners__drop-ico" aria-hidden>
                    📷
                  </span>
                  <span className="ra-admin-banners__drop-text">{t('admin.banners.dropHint')}</span>
                  <span className="ra-admin-banners__drop-sub">{t('admin.banners.dropSub')}</span>
                </label>
              )}
            </div>
          </div>

          <div className="ra-admin-banners__actions">
            <button type="button" className="ra-btn ra-btn--primary ra-admin-banners__submit" onClick={onSave}>
              {editingId ? t('admin.banners.update') : t('admin.banners.save')}
            </button>
            {editingId ? (
              <button type="button" className="ra-btn ra-btn--ghost ra-admin-banners__submit" onClick={resetForm}>
                {t('admin.banners.cancelEdit')}
              </button>
            ) : null}
          </div>
        </section>

        <section className="ra-admin-banners__panel ra-admin-banners__panel--table" aria-labelledby="blist">
          <h2 id="blist" className="ra-admin-banners__h2">
            {t(`admin.banners.slot.${slot}`)}
          </h2>
          <div className="ra-admin-banners__table-wrap">
            <table className="ra-admin-banners__table">
              <thead>
                <tr>
                  <th className="ra-admin-banners__th-check">
                    <label className="ra-admin-banners__check-all">
                      <input
                        type="checkbox"
                        checked={allRowsSelected}
                        onChange={toggleSelectAllRows}
                        disabled={rows.length === 0}
                        aria-label={t('admin.banners.selectAllAds')}
                      />
                      <span>{t('admin.banners.selectAllAds')}</span>
                    </label>
                  </th>
                  <th>{t('admin.banners.colPreview')}</th>
                  <th>{t('admin.banners.colTitle')}</th>
                  <th>{t('admin.banners.colDesc')}</th>
                  <th>{t('admin.banners.colCountries')}</th>
                  <th>{t('admin.banners.colSchedule')}</th>
                  <th>{t('admin.banners.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ra-admin-banners__empty">
                      {t('admin.banners.empty')}
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.id}>
                      <td className="ra-admin-banners__td-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() => toggleRowSelected(b.id)}
                          aria-label={t('admin.banners.selectRow', { title: b.title })}
                        />
                      </td>
                      <td>
                        <div className="ra-admin-banners__thumb">
                          {b.imageUrl || b.imageDataUrl ? (
                            <img src={b.imageUrl || b.imageDataUrl || ''} alt="" />
                          ) : (
                            <span className="ra-admin-banners__thumb-ph">—</span>
                          )}
                        </div>
                      </td>
                      <td>{b.title}</td>
                      <td className="ra-admin-banners__td-desc">{b.description}</td>
                      <td>
                        {b.countries.length === 0
                          ? t('admin.banners.allCountries')
                          : b.countries.map((c) => SEARCH_COUNTRY_ISO[c]).join(', ')}
                      </td>
                      <td className="ra-admin-banners__td-schedule">
                        {b.startDate || b.endDate
                          ? `${b.startDate || '—'} → ${b.endDate || '—'}`
                          : t('admin.banners.scheduleAlways')}
                      </td>
                      <td className="ra-admin-banners__td-actions">
                        <button
                          type="button"
                          className="ra-btn ra-btn--sm ra-admin-banners__edit"
                          onClick={() => beginEdit(b)}
                        >
                          {t('admin.banners.edit')}
                        </button>
                        <button
                          type="button"
                          className="ra-btn ra-btn--sm ra-admin-banners__del"
                          onClick={() => {
                            if (editingId === b.id) resetForm()
                            void (async () => {
                              const ok = await deleteAdminBannerOnServer(b.id)
                              if (!ok) {
                                window.alert(t('admin.owners.serverSaveError', { detail: 'delete_failed' }))
                                return
                              }
                              const next = await fetchAdminBanners()
                              if (next) replaceBannersFromServer(next)
                              setSelectedIds((prev) => {
                                const n = new Set(prev)
                                n.delete(b.id)
                                return n
                              })
                              bump()
                            })()
                          }}
                        >
                          {t('admin.banners.delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
