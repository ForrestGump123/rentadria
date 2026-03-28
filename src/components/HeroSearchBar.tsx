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
  const makeListId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

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
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

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
        <label className="ra-search__field ra-search__field--facet">
          <span className="ra-search__facet-label">{t('search.propertyType')}</span>
          <select
            className="ra-search__select"
            value={propertyType}
            onChange={(e) => onPropertyType(e.target.value)}
            aria-label={t('search.propertyType')}
          >
            <option value="">{t('search.facetAll')}</option>
            {ACC_PROPERTY_TYPES.map((id) => (
              <option key={id} value={id}>
                {t(`owner.listing.pt.${id}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {(category === 'car' || category === 'motorcycle') && (
        <label className="ra-search__field ra-search__field--grow ra-search__field--facet">
          <span className="ra-search__facet-label">
            {category === 'car' ? t('search.carMake') : t('search.motoMake')}
          </span>
          <input
            type="search"
            name="make"
            list={makeListId}
            placeholder={category === 'car' ? t('search.carMakePh') : t('search.motoMakePh')}
            value={vehicleMake}
            onChange={(e) => onVehicleMake(e.target.value)}
            aria-label={category === 'car' ? t('search.carMake') : t('search.motoMake')}
          />
          <datalist id={makeListId}>
            {makeSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
      )}

      <div className="ra-search__field ra-search__field--grow ra-search__combo" ref={wrapRef}>
        <input
          type="search"
          name="city"
          placeholder={t('search.city')}
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
          disabled={!countryId || citiesLoading}
          aria-controls={`${listId}-panel`}
        />
        {countryId && citiesLoading && (
          <span className="ra-search__city-hint">{t('search.citiesLoading')}</span>
        )}
        {countryId && !citiesLoading && open && filtered.length > 0 && (
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
    </div>
  )
}
