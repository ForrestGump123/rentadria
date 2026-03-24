import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../../types'

export type ContactDraft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  viber: string
  whatsapp: string
  telegram: string
  address: string
  categories: ListingCategory[]
}

const CAT_ORDER: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

type Props = {
  open: boolean
  initial: ContactDraft | null
  showCategoryCheckboxes: boolean
  onClose: () => void
  onSave: (d: ContactDraft) => void
}

const empty: ContactDraft = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  viber: '',
  whatsapp: '',
  telegram: '',
  address: '',
  categories: ['accommodation', 'car', 'motorcycle'],
}

export function ContactPersonModal({ open, initial, showCategoryCheckboxes, onClose, onSave }: Props) {
  const { t } = useTranslation()
  const [d, setD] = useState<ContactDraft>(empty)

  useEffect(() => {
    if (!open) return
    setD(
      initial
        ? {
            ...empty,
            ...initial,
            categories:
              initial.categories?.length > 0 ? [...initial.categories] : ['accommodation', 'car', 'motorcycle'],
          }
        : { ...empty },
    )
  }, [open, initial])

  if (!open) return null

  const toggleCat = (c: ListingCategory) => {
    setD((prev) => {
      const has = prev.categories.includes(c)
      const next = has ? prev.categories.filter((x) => x !== c) : [...prev.categories, c]
      return { ...prev, categories: next.length ? next : [c] }
    })
  }

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ra-modal__panel ra-owner-contact-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="ra-owner-contact-modal__title">{t('owner.listing.contactModalTitle')}</h2>

        <div className="ra-owner-contact-modal__grid">
          <label className="ra-fld">
            <span>{t('owner.listing.contactFirst')}</span>
            <input value={d.firstName} onChange={(e) => setD({ ...d, firstName: e.target.value })} />
          </label>
          <label className="ra-fld">
            <span>{t('owner.listing.contactLast')}</span>
            <input value={d.lastName} onChange={(e) => setD({ ...d, lastName: e.target.value })} />
          </label>
          <label className="ra-fld">
            <span>{t('owner.listing.contactPhone')}</span>
            <input
              value={d.phone}
              onChange={(e) => setD({ ...d, phone: e.target.value })}
              placeholder="+382 69 123 456"
            />
          </label>
          <label className="ra-fld">
            <span>{t('owner.listing.contactEmail')}</span>
            <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          </label>
          <label className="ra-fld">
            <span>Viber</span>
            <input value={d.viber} onChange={(e) => setD({ ...d, viber: e.target.value })} />
          </label>
          <label className="ra-fld">
            <span>WhatsApp</span>
            <input value={d.whatsapp} onChange={(e) => setD({ ...d, whatsapp: e.target.value })} />
          </label>
          <label className="ra-fld ra-owner-contact-modal__full">
            <span>Telegram</span>
            <input value={d.telegram} onChange={(e) => setD({ ...d, telegram: e.target.value })} />
          </label>
        </div>

        <label className="ra-fld">
          <span>{t('owner.listing.contactAddress')}</span>
          <input value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </label>

        {showCategoryCheckboxes && (
          <fieldset className="ra-owner-contact-modal__cats">
            <legend>{t('owner.listing.contactCategoriesLegend')}</legend>
            <div className="ra-owner-contact-modal__cat-row">
              {CAT_ORDER.map((c) => (
                <label key={c} className="ra-owner-contact-modal__cat">
                  <input
                    type="checkbox"
                    checked={d.categories.includes(c)}
                    onChange={() => toggleCat(c)}
                  />
                  <span>{t(`owner.listing.catLabel.${c}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="ra-owner-contact-modal__actions">
          <button
            type="button"
            className="ra-btn ra-btn--primary"
            onClick={() => {
              onSave(d)
              onClose()
            }}
          >
            {t('owner.listing.save')}
          </button>
          <button type="button" className="ra-btn ra-btn--ghost" onClick={onClose}>
            {t('owner.listing.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
