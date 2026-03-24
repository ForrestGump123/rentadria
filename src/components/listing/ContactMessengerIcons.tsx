/** Inline SVG brand icons for messenger links (currentColor + optional brand fill on hover) */

function IconViber({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M11.4 0C5.3 0 .4 4.9.4 11c0 1.9.5 3.7 1.4 5.3L0 24l8.1-2.1c1.5.8 3.2 1.3 5 1.3 6.1 0 11-4.9 11-11S17.5 0 11.4 0zm.6 17.9h-.1c-1.6 0-3.2-.4-4.6-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-3-1.3-4.7 0-5 4.1-9.1 9.1-9.1 2.4 0 4.7.9 6.4 2.6a9.06 9.06 0 012.7 6.4c0 5-4.1 9.1-9.1 9.1zm5-6.5c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 1.9 2.9 4.6 4.1.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"
      />
    </svg>
  )
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  )
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.01-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  )
}

type ContactMessengerIconsProps = {
  phoneDigits: string
  telegramUsername: string
  /** Telegram is username-based; show only next to the first number */
  withTelegram?: boolean
  className?: string
  /** Opens chat with optional pre-filled message (WhatsApp / Telegram; Viber opens chat without draft) */
  prefillMessage?: string
}

/** Viber / WhatsApp use the same phone digits; Telegram uses @username */
export function ContactMessengerIcons({
  phoneDigits,
  telegramUsername,
  withTelegram = true,
  className,
  prefillMessage,
}: ContactMessengerIconsProps) {
  const enc = prefillMessage ? encodeURIComponent(prefillMessage) : ''
  const wa =
    prefillMessage && enc
      ? `https://wa.me/${phoneDigits}?text=${enc}`
      : `https://wa.me/${phoneDigits}`
  const vb = `viber://chat?number=%2B${phoneDigits}`
  const user = telegramUsername.replace(/^@/, '')
  const tg =
    prefillMessage && enc
      ? `https://t.me/${user}?text=${enc}`
      : `https://t.me/${user}`

  return (
    <span className={className} role="group" aria-label="Messenger">
      <a className="ra-msg-ico ra-msg-ico--viber" href={vb} target="_blank" rel="noreferrer" title="Viber">
        <IconViber />
      </a>
      <a className="ra-msg-ico ra-msg-ico--wa" href={wa} target="_blank" rel="noreferrer" title="WhatsApp">
        <IconWhatsApp />
      </a>
      {withTelegram && (
        <a className="ra-msg-ico ra-msg-ico--tg" href={tg} target="_blank" rel="noreferrer" title="Telegram">
          <IconTelegram />
        </a>
      )}
    </span>
  )
}
