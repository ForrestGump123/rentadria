import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import './App.css'
import { fetchPublicBanners } from './lib/adminBannersApi'
import { pullPricingOverride, type PricingLocale } from './utils/pricingOverrides'
import { pullLegalOverride, type LegalKind, type LegalLocaleKey } from './utils/legalOverrides'
import { AdminSessionSync } from './components/AdminSessionSync'
import { CookieBanner } from './components/CookieBanner'
import { SiteVisitTracker } from './components/SiteVisitTracker'
import { FaqPage } from './pages/FaqPage'
import { HomePage } from './pages/HomePage'
import { ListingPage } from './pages/ListingPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { VerifyCodePage } from './pages/VerifyCodePage'
import { OwnerLoginLinkPage } from './pages/OwnerLoginLinkPage'
import { OwnerDashboardPage } from './pages/OwnerDashboardPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { replaceBannersFromServer } from './utils/adminBannersStore'

const PRICING_LOCALES: PricingLocale[] = ['cnr', 'en', 'sq', 'it', 'es']
const LEGAL_LOCALES: LegalLocaleKey[] = ['cnr', 'en', 'sq', 'it', 'es']
const LEGAL_KINDS: LegalKind[] = ['terms', 'privacy', 'faq']

export default function App() {
  useEffect(() => {
    void import('./utils/localDevOwnerSeed').then((m) => m.runLocalDevOwnerSeed())
  }, [])

  useEffect(() => {
    const pull = () => {
      void fetchPublicBanners().then((list) => {
        if (list) replaceBannersFromServer(list)
      })
    }
    pull()
    const onVis = () => {
      if (document.visibilityState === 'visible') pull()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    void Promise.all(PRICING_LOCALES.map((loc) => pullPricingOverride(loc)))
  }, [])

  useEffect(() => {
    void Promise.all(LEGAL_LOCALES.flatMap((loc) => LEGAL_KINDS.map((k) => pullLegalOverride(loc, k))))
  }, [])

  return (
    <>
      <AdminSessionSync />
      <SiteVisitTracker />
      <CookieBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/listing/:id" element={<ListingPage />} />
        <Route path="/verify" element={<VerifyCodePage />} />
        <Route path="/owner-login" element={<OwnerLoginLinkPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/owner/*" element={<OwnerDashboardPage />} />
        <Route path="/admin/*" element={<AdminDashboardPage />} />
      </Routes>
    </>
  )
}
