import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../../types'
import { adminSyncRequest } from '../../lib/adminSyncRequest'
import { fetchAdminOwnersProfiles } from '../../lib/adminOwnersApi'
import { isAdminSession } from '../../utils/adminSession'
import { type OwnerProfile } from '../../utils/ownerSession'
import {
  deleteImportPartner,
  fetchImportJobs,
  fetchImportOwnerSettings,
  fetchImportPartners,
  saveImportOwnerSettings,
  upsertImportPartner,
  type SyncPartner,
  type SyncJob,
} from '../../lib/adminImportApi'

const CATS: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

const XML_MAP_KEYS = ['title', 'description', 'price', 'city', 'images', 'phone'] as const

export function AdminImportPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const bump = useCallback(() => setEpoch((e) => e + 1), [])
  const [partners, setPartners] = useState<SyncPartner[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [profiles, setProfiles] = useState<OwnerProfile[]>([])
  const [loadOwnersError, setLoadOwnersError] = useState(false)

  const [partnerName, setPartnerName] = useState('')
  const [partnerUrl, setPartnerUrl] = useState('')
  const [partnerKey, setPartnerKey] = useState('')
  const [partnerCats, setPartnerCats] = useState<Record<ListingCategory, boolean>>({
    accommodation: true,
    car: true,
    motorcycle: true,
  })

  const [sitePartnerId, setSitePartnerId] = useState('')
  const [siteCats, setSiteCats] = useState<Record<ListingCategory, boolean>>({
    accommodation: true,
    car: true,
    motorcycle: true,
  })

  const [importOwnerId, setImportOwnerId] = useState('')
  const [importFeedUrl, setImportFeedUrl] = useState('')
  const [importPartnerId, setImportPartnerId] = useState('')
  const [importCats, setImportCats] = useState<Record<ListingCategory, boolean>>({
    accommodation: true,
    car: false,
    motorcycle: false,
  })

  const [mapDraft, setMapDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await fetchImportPartners()
      const j = await fetchImportJobs(30)
      const owners = await fetchAdminOwnersProfiles()
      if (cancelled) return
      if (p) setPartners(p)
      if (j) setJobs(j.slice().reverse())
      if (owners) {
        setLoadOwnersError(false)
        setProfiles(owners)
      } else {
        setLoadOwnersError(true)
        setProfiles([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [epoch])

  useEffect(() => {
    if (!importOwnerId) {
      setImportFeedUrl('')
      setMapDraft({})
      return
    }
    void (async () => {
      const s = await fetchImportOwnerSettings(importOwnerId)
      if (!s) return
      setImportFeedUrl(s.feedUrl ?? '')
      const m = s.fieldMapping ?? {}
      const next: Record<string, string> = {}
      for (const k of XML_MAP_KEYS) next[k] = m[k] ?? ''
      setMapDraft(next)
    })()
  }, [importOwnerId])

  useEffect(() => {
    if (partners.length && !importPartnerId) {
      setImportPartnerId(partners[0]!.id)
    }
  }, [partners, importPartnerId])

  const persistFeedUrl = () => {
    if (!importOwnerId) return
    void (async () => {
      await saveImportOwnerSettings({ ownerUserId: importOwnerId, feedUrl: importFeedUrl.trim() || null, fieldMapping: mapDraft })
      bump()
    })()
  }

  const persistMapping = () => {
    if (!importOwnerId) return
    const xmlFieldMapping: Record<string, string> = {}
    for (const k of XML_MAP_KEYS) {
      const v = (mapDraft[k] ?? '').trim()
      if (v) xmlFieldMapping[k] = v
    }
    void (async () => {
      await saveImportOwnerSettings({
        ownerUserId: importOwnerId,
        feedUrl: importFeedUrl.trim() || null,
        fieldMapping: xmlFieldMapping,
      })
      bump()
    })()
  }

  const addPartner = () => {
    if (!partnerName.trim() || !partnerUrl.trim()) return
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    void (async () => {
      await upsertImportPartner({
        id,
        name: partnerName.trim(),
        baseUrl: partnerUrl.trim(),
        apiKey: partnerKey.trim() || undefined,
        categories: { ...partnerCats },
      })
      setPartnerName('')
      setPartnerUrl('')
      setPartnerKey('')
      bump()
    })()
  }

  const runSiteSync = async () => {
    if (!sitePartnerId) return
    const cats = CATS.filter((c) => siteCats[c])
    const r = await adminSyncRequest({ scope: 'site', partnerId: sitePartnerId, categories: cats })
    if (!r.ok) window.alert(r.error ?? 'sync failed')
    bump()
  }

  const runOwnerSync = async (mode: 'test' | 'run') => {
    if (!importOwnerId || !importPartnerId) {
      window.alert(t('admin.import.pickOwnerPartner'))
      return
    }
    persistFeedUrl()
    const cats = CATS.filter((c) => importCats[c])
    const r = await adminSyncRequest({
      scope: 'owner',
      userId: importOwnerId,
      partnerId: importPartnerId,
      categories: cats,
      mode,
    })
    if (!r.ok) window.alert(r.error ?? 'sync failed')
    else if (mode === 'test') window.alert(t('admin.import.testDone'))
    bump()
  }

  if (!isAdminSession()) {
    return null
  }

  return (
    <div className="ra-admin-import">
      <Helmet>
        <title>{t('admin.import.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.import.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.import.lead')}</p>
        <p className="ra-admin-owners__hint ra-admin-import__supabase">{t('admin.import.supabaseNote')}</p>
        {loadOwnersError ? <p className="ra-admin-listings__hint">{t('admin.import.ownersLoadError')}</p> : null}
      </header>

      <section className="ra-admin-import__block" aria-labelledby="admin-import-uni-h">
        <h2 id="admin-import-uni-h" className="ra-admin-owners__h2">
          {t('admin.import.universalTitle')}
        </h2>
        <p className="ra-admin-owners__hint">{t('admin.import.universalHint')}</p>

        <div className="ra-admin-import__row">
          <label className="ra-fld ra-admin-import__grow">
            <span>{t('admin.import.feedUrl')}</span>
            <input
              type="url"
              className="ra-admin-listings__search ra-admin-import__input-full"
              placeholder="https://partners.com/feed.xml"
              value={importFeedUrl}
              onChange={(e) => setImportFeedUrl(e.target.value)}
            />
          </label>
          <label className="ra-fld">
            <span>{t('admin.import.ownerSelect')}</span>
            <select
              className="ra-admin-listings__select"
              value={importOwnerId}
              onChange={(e) => setImportOwnerId(e.target.value)}
            >
              <option value="">{t('admin.import.ownerPlaceholder')}</option>
              {profiles.map((p: OwnerProfile) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} ({p.email})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ra-admin-import__row">
          <label className="ra-fld">
            <span>{t('admin.import.partnerForSync')}</span>
            <select
              className="ra-admin-listings__select"
              value={importPartnerId}
              onChange={(e) => setImportPartnerId(e.target.value)}
            >
              <option value="">{t('admin.owners.pickPartner')}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="ra-admin-owners__cat-row ra-admin-import__cat-inline">
            {CATS.map((c) => (
              <label key={c} className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={importCats[c]}
                  onChange={(e) => setImportCats((s) => ({ ...s, [c]: e.target.checked }))}
                />
                {t(`nav.${c}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="ra-admin-import__btns">
          <button type="button" className="ra-btn ra-admin-import__btn-test" onClick={() => void runOwnerSync('test')}>
            {t('admin.import.testSync')}
          </button>
          <button type="button" className="ra-btn ra-btn--primary" onClick={() => void runOwnerSync('run')}>
            {t('admin.import.syncNow')}
          </button>
          <button type="button" className="ra-btn" onClick={persistFeedUrl} disabled={!importOwnerId}>
            {t('admin.import.saveUrl')}
          </button>
        </div>
      </section>

      <section className="ra-admin-import__block" aria-labelledby="admin-import-map-h">
        <h2 id="admin-import-map-h" className="ra-admin-owners__h2">
          {t('admin.import.mappingTitle')}
        </h2>
        <p className="ra-admin-owners__hint">{t('admin.import.mappingHint')}</p>
        {!importOwnerId ? (
          <p className="ra-admin-listings__empty">{t('admin.import.mappingNeedOwner')}</p>
        ) : (
          <>
            <div className="ra-admin-import__mapping">
              {XML_MAP_KEYS.map((key) => (
                <label key={key} className="ra-fld ra-admin-import__map-row">
                  <span>{t(`admin.import.mapFields.${key}`)}</span>
                  <input
                    className="ra-admin-listings__search"
                    placeholder={t('admin.import.mapPlaceholder')}
                    value={mapDraft[key] ?? ''}
                    onChange={(e) => setMapDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button type="button" className="ra-btn ra-btn--primary" onClick={persistMapping}>
              {t('admin.import.saveMapping')}
            </button>
          </>
        )}
      </section>

      <section className="ra-admin-owners__sync" aria-labelledby="admin-import-partners-h">
        <h2 id="admin-import-partners-h" className="ra-admin-owners__h2">
          {t('admin.import.partnersTitle')}
        </h2>
        <p className="ra-admin-owners__hint">{t('admin.owners.syncLead')}</p>

        <div className="ra-admin-owners__partner-form">
          <input
            type="text"
            className="ra-admin-listings__search"
            placeholder={t('admin.owners.partnerName')}
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
          />
          <input
            type="url"
            className="ra-admin-listings__search"
            placeholder={t('admin.owners.partnerUrl')}
            value={partnerUrl}
            onChange={(e) => setPartnerUrl(e.target.value)}
          />
          <input
            type="password"
            className="ra-admin-listings__search"
            placeholder={t('admin.owners.partnerKey')}
            value={partnerKey}
            onChange={(e) => setPartnerKey(e.target.value)}
            autoComplete="off"
          />
          <div className="ra-admin-owners__cat-row">
            {CATS.map((c) => (
              <label key={c} className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={partnerCats[c]}
                  onChange={(e) => setPartnerCats((p) => ({ ...p, [c]: e.target.checked }))}
                />
                {t(`nav.${c}`)}
              </label>
            ))}
          </div>
          <button type="button" className="ra-btn ra-btn--primary" onClick={addPartner}>
            {t('admin.owners.addPartner')}
          </button>
        </div>

        {partners.length > 0 && (
          <ul className="ra-admin-owners__partner-list">
            {partners.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {p.baseUrl}
                <button
                  type="button"
                  className="ra-link-btn"
                  onClick={() => {
                    void (async () => {
                      await deleteImportPartner(p.id)
                      bump()
                    })()
                  }}
                >
                  {t('admin.owners.removePartner')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="ra-admin-owners__site-sync">
          <h3 className="ra-admin-owners__h3">{t('admin.owners.siteSync')}</h3>
          <select
            className="ra-admin-listings__select"
            value={sitePartnerId}
            onChange={(e) => setSitePartnerId(e.target.value)}
          >
            <option value="">{t('admin.owners.pickPartner')}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="ra-admin-owners__cat-row">
            {CATS.map((c) => (
              <label key={c} className="ra-admin-owners__chk">
                <input
                  type="checkbox"
                  checked={siteCats[c]}
                  onChange={(e) => setSiteCats((s) => ({ ...s, [c]: e.target.checked }))}
                />
                {t(`nav.${c}`)}
              </label>
            ))}
          </div>
          <button type="button" className="ra-btn ra-btn--primary" onClick={() => void runSiteSync()}>
            {t('admin.owners.syncSiteNow')}
          </button>
        </div>

        {jobs.length > 0 && (
          <div className="ra-admin-owners__jobs">
            <h3 className="ra-admin-owners__h3">{t('admin.import.syncLog30')}</h3>
            <ul>
              {jobs.map((j) => (
                <li key={j.id}>
                  {new Date(j.at).toLocaleString()} — {j.scope} — {j.status} — {j.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
