import { useEffect } from 'react'
import { trackSiteVisitOncePerDay } from '../utils/siteVisitTracker'

/** Broji posjetu (jednom dnevno po pregledaču) na produkciji /api. */
export function SiteVisitTracker() {
  useEffect(() => {
    void trackSiteVisitOncePerDay()
  }, [])
  return null
}
