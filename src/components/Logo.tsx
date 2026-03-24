import { Link } from 'react-router-dom'

export type LogoVariant = 'header' | 'footer' | 'modal' | 'modalCompact'

type LogoProps = {
  /** @deprecated use variant */
  compact?: boolean
  variant?: LogoVariant
}

const SRC = '/rentadria-logo.png'

export function Logo({ compact, variant: variantProp }: LogoProps) {
  const variant: LogoVariant = variantProp ?? (compact ? 'footer' : 'header')

  return (
    <Link to="/" className={`ra-logo ra-logo--${variant}`} aria-label="RentAdria">
      <img src={SRC} alt="" className="ra-logo__img" decoding="async" />
    </Link>
  )
}
