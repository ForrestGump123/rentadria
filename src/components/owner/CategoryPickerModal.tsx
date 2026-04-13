import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../../types'

type Props = {
  open: boolean
  onClose: () => void
  unlocked: ListingCategory[]
  onPick: (c: ListingCategory) => void
}

const ORDER: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

export function CategoryPickerModal({ open, onClose, unlocked, onPick }: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="ra-modal ra-modal--owner-catpick" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ra-modal__panel ra-owner-catpick" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="ra-owner-catpick__title">{t('owner.listing.pickCategoryTitle')}</h2>
        <p className="ra-owner-catpick__hint">{t('owner.listing.pickCategoryHint')}</p>
        <div className="ra-owner-catpick__grid">
          {ORDER.map((c) => {
            const ok = unlocked.includes(c)
            return (
              <button
                key={c}
                type="button"
                disabled={!ok}
                className={`ra-owner-catpick__card ${ok ? '' : 'is-disabled'}`}
                onClick={() => {
                  if (!ok) return
                  onPick(c)
                  onClose()
                }}
              >
                <span className="ra-owner-catpick__ico" aria-hidden>
                  {c === 'accommodation' ? '🏠' : c === 'car' ? '🚗' : '🏍️'}
                </span>
                <span className="ra-owner-catpick__label">{t(`nav.${c}`)}</span>
                {!ok && <span className="ra-owner-catpick__lock">{t('owner.listing.categoryLocked')}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
