export function openMailto(to: string, subject: string, body: string) {
  const u = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = u
}
