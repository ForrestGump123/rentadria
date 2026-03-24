/** Envelope + @ (mail) — shared for listing owner line and auth email field */

export function MailAtIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      <text
        x="12"
        y="15.25"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
      >
        @
      </text>
    </svg>
  )
}
