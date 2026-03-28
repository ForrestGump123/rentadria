/** Deterministički broj za prikaz #ID na grafici (isti za isti listing_public_id). */
export function listingDisplayId(listingPublicId: string): string {
  let h = 2166136261
  for (let i = 0; i < listingPublicId.length; i++) {
    h ^= listingPublicId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = Math.abs(h) % 999999 + 1
  return String(n)
}
