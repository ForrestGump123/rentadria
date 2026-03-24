/** Simplified Visa / Mastercard marks for “we accept” footer badges */

export function VisaMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 32"
      width="44"
      height="28"
      aria-hidden
    >
      <rect width="48" height="32" rx="4" fill="#1a1f71" />
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fill="#fff"
        fontFamily="system-ui, Arial, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        VISA
      </text>
    </svg>
  )
}

export function MastercardMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 32"
      width="44"
      height="28"
      aria-hidden
    >
      <rect width="48" height="32" rx="4" fill="#000" />
      <circle cx="19" cy="16" r="10" fill="#eb001b" />
      <circle cx="29" cy="16" r="10" fill="#f79e1b" fillOpacity="0.95" />
    </svg>
  )
}

/** American Express–style wordmark (blue box, two-line white type; not an official asset). */
export function AmexMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 32"
      width="44"
      height="28"
      aria-hidden
    >
      <rect width="48" height="32" rx="4" fill="#006FCF" />
      <text
        x="24"
        y="13"
        textAnchor="middle"
        fill="#fff"
        fontFamily="system-ui, 'Helvetica Neue', Arial, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.12em"
      >
        AMERICAN
      </text>
      <text
        x="24"
        y="23"
        textAnchor="middle"
        fill="#fff"
        fontFamily="system-ui, 'Helvetica Neue', Arial, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.14em"
      >
        EXPRESS
      </text>
    </svg>
  )
}
