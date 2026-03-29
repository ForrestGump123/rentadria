import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { addBanner, deleteBanner, listBanners, type BannerSlot } from '../../utils/adminBannersStore'
import { isAdminSession } from '../../utils/adminSession'

const SLOTS: BannerSlot[] = ['slideshow', 'left', 'right', 'popup']

export function AdminBannersPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [slot, setSlot] = useState<BannerSlot>('slideshow')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [countries, setCountries] = useState<Set<SearchCountryId>>(() => new Set(SEARCH_COUNTRY_IDS))

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-admin-banners-updated', on)
    return () => window.removeEventListener('rentadria-admin-banners-updated', on)
  }, [bump])

  const rows = useMemo(() => {
    void epoch
    return listBanners().filter((b) => b.slot === slot)
  }, [epoch, slot])

  const toggleCountry = (c: SearchCountryId) => {
    setCountries((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const selectAllCountries = () => {
    setCountries(new Set(SEARCH_COUNTRY_IDS))
  }

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => setImageDataUrl(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(f)
  }

  const onAdd = () => {
    addBanner({
      slot,
      title: title.trim() || t('admin.banners.untitled'),
      description: description.trim(),
      imageDataUrl,
      countries: countries.size === SEARCH_COUNTRY_IDS.length ? [] : [...countries],
    })
    setTitle('')
    setDescription('')
    setImageDataUrl(null)
    bump()
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-banners">
      <Helmet>
        <title>{t('admin.nav.banners')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.nav.banners')}</h1>
        <p className="ra-admin-subtitle">{t('admin.banners.lead')}</p>
      </header>

      <div className="ra-admin-banners__tabs" role="tablist">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            className={`ra-admin-banners__tab ${slot === s ? 'is-active' : ''}`}
            onClick={() => setSlot(s)}
          >
            {t(`admin.banners.slot.${s}`)}
          </button>
        ))}
      </div>

      <section className="ra-admin-banners__form" aria-labelledby="bform">
        <h2 id="bform" className="ra-admin-banners__h2">
          {t('admin.banners.addNew')}
        </h2>
        <p className="ra-admin-banners__countries-label">{t('admin.banners.countries')}</p>
        <div className="ra-admin-banners__checks">
          <label className="ra-admin-banners__all">
            <input
              type="checkbox"
              checked={countries.size === SEARCH_COUNTRY_IDS.length}
              onChange={(e) => (e.target.checked ? selectAllCountries() : setCountries(new Set()))}
            />
            <span>{t('admin.banners.allCountries')}</span>
          </label>
          {SEARCH_COUNTRY_IDS.map((c) => (
            <label key={c} className="ra-admin-banners__chk">
              <input type="checkbox" checked={countries.has(c)} onChange={() => toggleCountry(c)} />
              <span>{SEARCH_COUNTRY_ISO[c]}</span>
            </label>
          ))}
        </div>
        <label className="ra-fld">
          <span>{t('admin.banners.title')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="ra-fld">
          <span>{t('admin.banners.description')}</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="ra-fld">
          <span>{t('admin.banners.image')}</span>
          <input type="file" accept="image/*" onChange={onPickImage} />
        </label>
        {imageDataUrl && (
          <img src={imageDataUrl} alt="" className="ra-admin-banners__preview" width={200} />
        )}
        <button type="button" className="ra-btn ra-btn--primary" onClick={onAdd}>
          {t('admin.banners.save')}
        </button>
      </section>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.banners.colTitle')}</th>
              <th>{t('admin.banners.colDesc')}</th>
              <th>{t('admin.banners.colCountries')}</th>
              <th>{t('admin.banners.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="ra-admin-listings__empty">
                  {t('admin.banners.empty')}
                </td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td className="ra-admin-listings__hint">{b.description}</td>
                  <td>
                    {b.countries.length === 0 ? t('admin.banners.allCountries') : b.countries.map((c) => SEARCH_COUNTRY_ISO[c]).join(', ')}
                  </td>
                  <td>
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-del" onClick={() => { deleteBanner(b.id); bump(); }}>
                      {t('admin.banners.delete')}
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
