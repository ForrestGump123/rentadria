import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, type SearchCountryId } from '../data/cities/countryIds'
import { MOTORCYCLE_MAKES } from '../data/motorcycleCatalog'
import { VEHICLE_MAKES } from '../data/vehicleCatalog'
import type { ListingCategory } from '../types'

const ACC_PROPERTY_TYPES = [
  'studio',
  'room',
  'apartment',
  'villa',
  'house',
  'hostel',
  'hotel',
] as const

type HeroSearchBarProps = {
  category: ListingCategory
  countryId: SearchCountryId | null
  onCountryId: (id: SearchCountryId | null) => void
  city: string
  onCity: (v: string) => void
  cities: string[]
  citiesLoading: boolean
  onSubmit: () => void
  propertyType: string
  onPropertyType: (v: string) => void
  vehicleMake: string
  onVehicleMake: (v: string) => void
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function HeroSearchBar({
  category,
  countryId,
  onCountryId,
  city,
  onCity,
  cities,
  citiesLoading,
  onSubmit,
  propertyType,
  onPropertyType,
  vehicleMake,
  onVehicleMake,
}: HeroSearchBarProps) {
  const { t } = useTranslation()
  const listId = useId()
  const makePanelId = useId()
  const [open, setOpen] = useState(false)
  const [makeOpen, setMakeOpen] = useState(false)
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const makeWrapRef = useRef<HTMLDivElement>(null)
  const propertyWrapRef = useRef<HTMLDivElement>(null)

  const makeCatalog = category === 'motorcycle' ? MOTORCYCLE_MAKES : VEHICLE_MAKES
  const makeSuggestions = useMemo(() => {
    const q = fold(vehicleMake.trim())
    if (!q) return makeCatalog.slice(0, 80)
    return makeCatalog.filter((m) => fold(m).includes(q)).slice(0, 80)
  }, [makeCatalog, vehicleMake])

  const filtered = useMemo(() => {
    const q = fold(city.trim())
    if (!q) return cities.slice(0, 80)
    return cities.filter((c) => fold(c).includes(q)).slice(0, 80)
  }, [cities, city])

  useEffect(() => {
    if (!open && !propertyMenuOpen && !makeOpen) return
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node
      if (wrapRef.current && !wrapRef.current.contains(node)) setOpen(false)
      if (propertyWrapRef.current && !propertyWrapRef.current.contains(node)) setPropertyMenuOpen(false)
      if (makeWrapRef.current && !makeWrapRef.current.contains(node)) setMakeOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, propertyMenuOpen, makeOpen])

  return (
    <div className="ra-search">
      <label className="ra-search__field">
        <span className="ra-search__icon" aria-hidden>
          🔍
        </span>
        <select
          className="ra-search__select"
          value={countryId ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onCountryId(v === '' ? null : (v as SearchCountryId))
            onCity('')
          }}
          aria-label={t('search.country')}
        >
          <option value="">{t('search.countryAll')}</option>
          {SEARCH_COUNTRY_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`search.country_${id}`)}
            </option>
          ))}
        </select>
      </label>

      {category === 'accommodation' && (
        <div
          className="ra-search__field ra-search__field--property-dd"
          ref={propertyWrapRef}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPropertyMenuOpen(false)
          }}
        >
          <button
            type="button"
            className="ra-search__property-trigger"
            aria-haspopup="listbox"
            aria-expanded={propertyMenuOpen}
            aria-label={t('search.propertyType')}
            onClick={() => setPropertyMenuOpen((v) => !v)}
          >
            <span className="ra-search__property-trigger-text">
              {propertyType === '' ? t('search.propertyType') : t(`owner.listing.pt.${propertyType}`)}
            </span>
            <span className="ra-search__property-caret" aria-hidden>
              ▾
            </span>
          </button>
          {propertyMenuOpen && (
            <ul className="ra-search__property-menu" role="listbox">
              <li role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={propertyType === ''}
                  className="ra-search__property-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPropertyType('')
                    setPropertyMenuOpen(false)
                  }}
                >
                  {t('search.facetAll')}
                </button>
              </li>
              {ACC_PROPERTY_TYPES.map((id) => (
                <li key={id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={propertyType === id}
                    className="ra-search__property-opt"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPropertyType(id)
                      setPropertyMenuOpen(false)
                    }}
                  >
                    {t(`owner.listing.pt.${id}`)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(category === 'car' || category === 'motorcycle') && (
        <div
          className="ra-search__field ra-search__field--grow ra-search__combo"
          ref={makeWrapRef}
        >
          <input
            type="search"
            name="make"
            placeholder={category === 'car' ? t('search.carMake') : t('search.motoMake')}
            value={vehicleMake}
            onChange={(e) => {
              onVehicleMake(e.target.value)
              setMakeOpen(true)
            }}
            onFocus={() => setMakeOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSubmit()
                setMakeOpen(false)
              }
              if (e.key === 'Escape') setMakeOpen(false)
            }}
            autoComplete="off"
            aria-controls={makePanelId}
            aria-label={category === 'car' ? t('search.carMake') : t('search.motoMake')}
          />
          {makeOpen && makeSuggestions.length > 0 && (
            <ul id={makePanelId} className="ra-search__suggest" role="listbox">
              {makeSuggestions.map((m) => (
                <li key={m} role="option">
                  <button
                    type="button"
                    className="ra-search__suggest-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onVehicleMake(m)
                      setMakeOpen(false)
                    }}
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="ra-search__field ra-search__field--grow ra-search__combo" ref={wrapRef}>
        <input
          type="search"
          name="city"
          placeholder={t('search.placeOrKeyword')}
          value={city}
          onChange={(e) => {
            onCity(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
              setOpen(false)
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          autoComplete="off"
          disabled={citiesLoading}
          aria-controls={`${listId}-panel`}
        />
        {citiesLoading && (
          <span className="ra-search__city-hint">{t('search.citiesLoading')}</span>
        )}
        {!citiesLoading && open && filtered.length > 0 && (
          <ul id={`${listId}-panel`} className="ra-search__suggest" role="listbox">
            {filtered.map((c) => (
              <li key={c} role="option">
                <button
                  type="button"
                  className="ra-search__suggest-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onCity(c)
                    setOpen(false)
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="ra-btn ra-btn--primary ra-search__btn" onClick={onSubmit}>
        {t('search.button')}
      </button>
      <p className="ra-search__hint" role="note">
        {countryId ? t('search.hintWithCountry') : t('search.hintNoCountry')}
      </p>
    </div>
  )
}
