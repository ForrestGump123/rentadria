import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CurrencyCode } from '../types/currency'
import { formatListingPrice } from '../utils/priceFormat'

const STORAGE_KEY = 'rentadria_currency'

type CurrencyContextValue = {
  currency: CurrencyCode
  setCurrency: (c: CurrencyCode) => void
  /** 1 EUR = eurToAll ALL (Frankfurter); null while loading */
  eurToAll: number | null
  formatPriceLabel: (priceLabel: string) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'BAM' || s === 'ALL' || s === 'EUR') return s
    } catch {
      /* ignore */
    }
    return 'EUR'
  })
  const [eurToAll, setEurToAll] = useState<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currency)
    } catch {
      /* ignore */
    }
  }, [currency])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=ALL')
        if (!r.ok) throw new Error('rates')
        const j = (await r.json()) as { rates?: { ALL?: number } }
        if (!cancelled && typeof j.rates?.ALL === 'number') setEurToAll(j.rates.ALL)
      } catch {
        if (!cancelled) setEurToAll(100)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c)
  }, [])

  const formatPriceLabel = useCallback(
    (priceLabel: string) => formatListingPrice(priceLabel, currency, eurToAll),
    [currency, eurToAll],
  )

  const value = useMemo(
    () => ({ currency, setCurrency, eurToAll, formatPriceLabel }),
    [currency, setCurrency, eurToAll, formatPriceLabel],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
