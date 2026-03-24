import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buildListingDetail } from '../data/listingDetail'
import { getListingById, getSimilarListings, LISTING_IMAGE_FALLBACK } from '../data/listings'
import { MailAtIcon } from '../components/icons/MailAtIcon'
import { ContactMessengerIcons } from '../components/listing/ContactMessengerIcons'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { ListingLightbox } from '../components/listing/ListingLightbox'
import { ListingMap } from '../components/listing/ListingMap'
import { InquiryModal } from '../components/listing/InquiryModal'
import { ReportModal } from '../components/listing/ReportModal'
import { SimilarListingsRow } from '../components/listing/SimilarListingsRow'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle as listingTitleT } from '../utils/listingTitle'
import { downloadElementAsPdf } from '../utils/pdfListing'
import { isLoggedIn, setLoggedIn } from '../utils/storage'
import type { ListingCategory } from '../types'
import { useCurrency } from '../context/CurrencyContext'

function trField(v: string, t: (k: string) => string) {
  return v.startsWith('detail.') ? t(v) : v
}

const catIcons: Record<ListingCategory, ReactNode> = {
  accommodation: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
      />
    </svg>
  ),
  motorcycle: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M17.4 4.5c-.4 0-.8.2-1 .6l-1.4 2.4H9.5L8.3 6.2c-.2-.3-.5-.5-.9-.5H5v2h1.6l.6 1.1-2.3 4.1C4.1 14 3.5 15 3.5 16c0 1.9 1.6 3.5 3.5 3.5S10.5 17.9 10.5 16c0-.4-.1-.8-.2-1.2l1.1-2h3.1l.5 1.8c.3 1.1 1.3 1.9 2.5 1.9 1.4 0 2.5-1.1 2.5-2.5 0-.3 0-.6-.1-.9l-1.8-6.4 1.2-2.1c.1-.2.2-.4.2-.6 0-.6-.4-1-1-1h-1.6zm-8.9 9.5c-.8 0-1.5-.7-1.5-1.5S7.7 11 8.5 11s1.5.7 1.5 1.5S9.3 14 8.5 14zm7.5 3c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"
      />
    </svg>
  ),
}

export function ListingPage() {
  const { t, i18n } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const listing = id ? getListingById(id) : undefined
  const displayTitle = useMemo(
    () => (listing ? listingTitleT(listing, t) : ''),
    [listing, t, i18n.language],
  )
  const detail = useMemo(() => {
    if (!listing) return null
    const d = buildListingDetail(listing)
    if (listing.category === 'accommodation') return d
    const title = listingTitleT(listing, t)
    return {
      ...d,
      basicInfo: d.basicInfo.map((row) =>
        row.label === 'detail.basic.model' ? { ...row, value: title } : row,
      ),
    }
  }, [listing, t, i18n.language])
  const similar = useMemo(() => (listing ? getSimilarListings(listing) : []), [listing])

  const [tab, setTab] = useState<'desc' | 'chars' | 'prices'>('desc')
  const [showContact, setShowContact] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviews, setReviews] = useState<{ rating: number; text: string; at: string }[]>([])

  const pdfRootRef = useRef<HTMLDivElement>(null)
  const logged = isLoggedIn()

  useEffect(() => {
    document.documentElement.lang = i18n.language.split('-')[0]
  }, [i18n.language])

  useEffect(() => {
    if (!id) return
    try {
      const raw = localStorage.getItem(`rentadria_reviews_${id}`)
      if (raw) setReviews(JSON.parse(raw) as { rating: number; text: string; at: string }[])
    } catch {
      /* ignore */
    }
  }, [id])

  const share = useCallback(async () => {
    const url = window.location.href
    const title = listing ? listingTitleT(listing, t) : 'RentAdria'
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        window.alert(t('detail.share.copied'))
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        window.alert(t('detail.share.copied'))
      } catch {
        /* ignore */
      }
    }
  }, [listing, t])

  const downloadPdf = useCallback(async () => {
    if (!pdfRootRef.current || !listing) return
    await downloadElementAsPdf(pdfRootRef.current, `rentadria-${listing.id}.pdf`)
  }, [listing])

  const submitReview = useCallback(() => {
    if (!id || !logged || !reviewText.trim()) return
    const next = [...reviews, { rating: reviewRating, text: reviewText.trim(), at: new Date().toISOString() }]
    setReviews(next)
    localStorage.setItem(`rentadria_reviews_${id}`, JSON.stringify(next))
    setReviewText('')
  }, [id, logged, reviewRating, reviewText, reviews])

  if (!listing || !detail) {
    return (
      <div className="ra-app">
        <Helmet>
          <title>{t('listingPage.notFound')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <main className="ra-main">
          <p className="ra-listing-missing">{t('listingPage.notFound')}</p>
          <Link to="/" className="ra-btn ra-btn--primary">
            {t('listingPage.back')}
          </Link>
        </main>
      </div>
    )
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${detail.mapLat},${detail.mapLng}`
  const gallery = detail.gallery.map(listingImageUrl)
  const bentoMode = gallery.length === 1 ? 'single' : gallery.length === 2 ? 'pair' : 'bento'
  const thumb1 = gallery[1]
  const thumb2 = gallery[2]
  const morePhotos = gallery.length > 3 ? gallery.length - 3 : 0

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="ra-app">
      <Helmet>
        <title>{`${displayTitle} · RentAdria`}</title>
        <meta name="description" content={t('listingPage.meta')} />
        <meta property="og:title" content={`${displayTitle} · RentAdria`} />
        <meta property="og:description" content={t('listingPage.meta')} />
        <meta property="og:image" content={gallery[0] ?? listing.image} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={gallery[0] ?? listing.image} />
      </Helmet>
      <Header category={listing.category} onCategory={(c) => navigate(`/?cat=${c}`)} />

      <main className="ra-main ra-detail-main">
        <div ref={pdfRootRef} className="ra-detail-pdf-root">
          <nav className="ra-bc" aria-label="Breadcrumb">
            <Link to="/">{t('detail.breadcrumb.home')}</Link>
            <span className="ra-bc__sep">&gt;</span>
            <span>{t(`nav.${listing.category}`)}</span>
            <span className="ra-bc__sep">&gt;</span>
            <span>{listing.location}</span>
            <span className="ra-bc__sep">&gt;</span>
            <span className="ra-bc__cur">{displayTitle}</span>
          </nav>

          <div className="ra-detail-head">
            <div className="ra-detail-head__main">
              <p className="ra-detail-cat">
                <span className="ra-detail-cat__ico" aria-hidden>
                  {catIcons[listing.category]}
                </span>
                {t(`nav.${listing.category}`)}
              </p>
              <div className="ra-detail-title-wrap">
                <h1 className="ra-detail-title">{displayTitle}</h1>
                {listing.verified && (
                  <span className="ra-badge-verified" title={t('detail.verifiedTitle')}>
                    {t('detail.verified')}
                  </span>
                )}
              </div>
              <div className="ra-detail-meta">
                <span className="ra-detail-meta__item ra-detail-meta__item--star">
                  <span className="ra-detail-meta__ico" aria-hidden>
                    ★
                  </span>
                  {detail.rating.toFixed(1)}
                </span>
                <span className="ra-detail-meta__item">
                  <span className="ra-detail-meta__ico ra-detail-meta__ico--pin" aria-hidden>
                    📍
                  </span>
                  {listing.location}
                </span>
                <span className="ra-detail-meta__item">
                  <span className="ra-detail-meta__ico" aria-hidden>
                    👁
                  </span>
                  {t('detail.views', { count: detail.viewCount })}
                </span>
                <span className="ra-detail-meta__item ra-detail-meta__item--muted">
                  {t('detail.updated')} {detail.updatedAt}
                </span>
              </div>
              <p className="ra-detail-idline">
                {t('detail.idLabel')} {detail.listingNumber}
              </p>
              <div className="ra-detail-actions">
                <button type="button" className="ra-chip ra-chip--act" onClick={share}>
                  <span className="ra-chip__ico" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
                      />
                    </svg>
                  </span>
                  {t('detail.actions.share')}
                </button>
                <button type="button" className="ra-chip ra-chip--act" onClick={() => setReportOpen(true)}>
                  <span className="ra-chip__ico ra-chip__ico--flag" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6zm0 0"
                      />
                    </svg>
                  </span>
                  {t('detail.actions.report')}
                </button>
                <button type="button" className="ra-chip ra-chip--act" onClick={downloadPdf}>
                  <span className="ra-chip__ico" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z"
                      />
                    </svg>
                  </span>
                  {t('detail.actions.pdf')}
                </button>
              </div>
            </div>
          </div>

          <div className="ra-detail-gallery">
            <div className={`ra-detail-bento ra-detail-bento--${bentoMode}`}>
              <button type="button" className="ra-detail-hero-img" onClick={() => setLightbox(0)}>
                <img src={gallery[0]} alt="" onError={(e) => { e.currentTarget.src = LISTING_IMAGE_FALLBACK }} />
              </button>
              {thumb1 && bentoMode !== 'single' && (
                <button
                  type="button"
                  className="ra-detail-thumb ra-detail-thumb--t1"
                  onClick={() => setLightbox(1)}
                >
                  <img src={thumb1} alt="" onError={(e) => { e.currentTarget.src = LISTING_IMAGE_FALLBACK }} />
                </button>
              )}
              {thumb2 && bentoMode === 'bento' && (
                <button
                  type="button"
                  className="ra-detail-thumb ra-detail-thumb--t2"
                  onClick={() => setLightbox(2)}
                >
                  <img src={thumb2} alt="" onError={(e) => { e.currentTarget.src = LISTING_IMAGE_FALLBACK }} />
                  {morePhotos > 0 && (
                    <span className="ra-detail-more">
                      +{morePhotos} {t('detail.gallery.more')}
                    </span>
                  )}
                </button>
              )}
            </div>
            <aside className="ra-detail-sidecard">
              <h3 className="ra-detail-sidecard-h">{t('detail.basic.title')}</h3>
              <dl className="ra-detail-dl">
                {detail.basicInfo.map((row) => (
                  <div key={row.label + row.value}>
                    <dt>{trField(row.label, t)}</dt>
                    <dd>{trField(row.value, t)}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>

          <div className="ra-detail-tabs">
            <button
              type="button"
              className={`ra-tab ${tab === 'desc' ? 'ra-tab--on' : ''}`}
              onClick={() => setTab('desc')}
            >
              {t('detail.tabs.desc')}
            </button>
            <button
              type="button"
              className={`ra-tab ${tab === 'chars' ? 'ra-tab--on' : ''}`}
              onClick={() => setTab('chars')}
            >
              {t('detail.tabs.chars')}
            </button>
            <button
              type="button"
              className={`ra-tab ${tab === 'prices' ? 'ra-tab--on' : ''}`}
              onClick={() => setTab('prices')}
            >
              {t('detail.tabs.prices')}
            </button>
          </div>

          <div className="ra-detail-tabpanel">
            {tab === 'desc' && <p className="ra-detail-copy">{t(detail.description)}</p>}
            {tab === 'chars' && (
              <ul className="ra-detail-ul">
                {detail.characteristics.map((line) => (
                  <li key={line}>{t(line)}</li>
                ))}
              </ul>
            )}
            {tab === 'prices' && <p className="ra-detail-copy">{t(detail.pricesAndPayment)}</p>}
          </div>

          <div className="ra-detail-pricebar">
            <span className="ra-detail-price-big">{formatPriceLabel(listing.priceLabel)}</span>
            <button
              type="button"
              className="ra-btn ra-btn--primary"
              onClick={() => setShowContact((v) => !v)}
            >
              {showContact ? t('detail.contact.hide') : t('detail.contact.show')}
            </button>
          </div>

          {showContact && (
            <section className="ra-owner-card">
              <div className="ra-owner-head">
                <h3>{t('detail.owner.title')}</h3>
                <button type="button" className="ra-btn ra-btn--owner" onClick={() => setInquiryOpen(true)}>
                  {t('detail.owner.cta')}
                </button>
              </div>
              <p className="ra-owner-name">{detail.owner.displayName}</p>
              <p className="ra-owner-mail">
                <span className="ra-owner-mail__ico" aria-hidden>
                  <MailAtIcon />
                </span>
                <a href={`mailto:${detail.owner.email}`}>{detail.owner.email}</a>
              </p>
              {detail.owner.phones.map((p, i) => (
                <div key={p.e164} className="ra-owner-phone-row">
                  <ContactMessengerIcons
                    phoneDigits={p.e164.replace(/\D/g, '')}
                    telegramUsername={detail.owner.telegram}
                    withTelegram={i === 0}
                    prefillMessage={t('detail.contact.messagePrefill', { title: displayTitle })}
                  />
                  <a className="ra-owner-tel" href={`tel:${p.e164}`}>
                    {p.display}
                  </a>
                </div>
              ))}
            </section>
          )}

          <div className="ra-detail-map-block">
            <ListingMap lat={detail.mapLat} lng={detail.mapLng} />
          </div>

          <div className="ra-detail-pdf-snapshot" aria-hidden>
            <h2 className="ra-detail-pdf-h">{t('detail.owner.title')}</h2>
            <p className="ra-detail-pdf-name">{detail.owner.displayName}</p>
            <p>
              <a href={`mailto:${detail.owner.email}`}>{detail.owner.email}</a>
            </p>
            {detail.owner.phones.map((p) => (
              <p key={p.e164}>
                <a href={`tel:${p.e164}`}>{p.display}</a>
              </p>
            ))}
            <h2 className="ra-detail-pdf-h">{t('detail.map.title')}</h2>
            <p>{listing.location}</p>
            <p>
              {t('detail.map.coords')}: {detail.mapLat.toFixed(5)}, {detail.mapLng.toFixed(5)}
            </p>
            <p>
              <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                {t('detail.map.openGoogle')} →
              </a>
            </p>
          </div>
        </div>

        <section className="ra-reviews">
          <h2>{t('detail.reviews.title')}</h2>
          <p className="ra-reviews-hint">{t('detail.reviews.hint')}</p>
          {reviews.map((r, i) => (
            <article key={i} className="ra-review-item">
              <span>★ {r.rating}</span>
              <p>{r.text}</p>
              <small>{new Date(r.at).toLocaleString()}</small>
            </article>
          ))}
          {logged ? (
            <div className="ra-review-form">
              <div className="ra-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n <= reviewRating ? 'on' : ''}
                    onClick={() => setReviewRating(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder={t('detail.reviews.placeholder')} />
              <button type="button" className="ra-btn ra-btn--primary" onClick={submitReview}>
                {t('detail.reviews.submit')}
              </button>
            </div>
          ) : (
            <div className="ra-review-login">
              <p>{t('detail.reviews.loginOnly')}</p>
              <button type="button" className="ra-btn ra-btn--ghost" onClick={() => setLoggedIn(true)}>
                {t('detail.reviews.demoLogin')}
              </button>
            </div>
          )}
        </section>

        <SimilarListingsRow items={similar} />
      </main>

      <Footer />

      {lightbox !== null && (
        <ListingLightbox
          images={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}

      <InquiryModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        listingTitle={displayTitle}
        listingId={listing.id}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        listingTitle={displayTitle}
        listingId={listing.id}
      />
    </div>
  )
}
