import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { isFullCountrySelection, type CountryFilterState } from '../../utils/subscriptionAdmin'

type Props = {
  value: CountryFilterState
  onChange: (next: CountryFilterState) => void
  allLabel: string
}

export function AdminCountryChips({ value, onChange, allLabel }: Props) {
  const isAll = value === 'all'
  const set = value === 'all' ? null : value
  const sveMasterActive = isFullCountrySelection(value)

  const toggleAll = () => {
    if (isFullCountrySelection(value)) {
      onChange(new Set())
    } else {
      onChange(new Set(SEARCH_COUNTRY_IDS))
    }
  }

  const toggleOne = (c: SearchCountryId) => {
    if (isAll) {
      onChange(new Set([c]))
      return
    }
    const next = new Set(set)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    onChange(next)
  }

  return (
    <div className="ra-admin-country-chips" role="group" aria-label={allLabel}>
      <button
        type="button"
        className={`ra-admin-country-chips__btn ra-admin-country-chips__btn--master ${sveMasterActive ? 'is-active' : ''}`}
        onClick={toggleAll}
      >
        {allLabel}
      </button>
      {SEARCH_COUNTRY_IDS.map((c) => {
        const active = isAll || (set?.has(c) ?? false)
        return (
          <button key={c} type="button" className={`ra-admin-country-chips__btn ${active ? 'is-active' : ''}`} onClick={() => toggleOne(c)}>
            {SEARCH_COUNTRY_ISO[c]}
          </button>
        )
      })}
    </div>
  )
}
