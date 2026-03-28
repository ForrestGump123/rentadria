export type PublishResult = {
  instagramMediaId?: string
  facebookPostId?: string
  warnings: string[]
}

async function graphPost(url: string): Promise<unknown> {
  const r = await fetch(url, { method: 'POST' })
  const j = (await r.json()) as Record<string, unknown>
  if (!r.ok) throw new Error(JSON.stringify(j))
  if (j.error) throw new Error(JSON.stringify(j.error))
  return j
}

export async function publishInstagramFeed(imageUrl: string, caption: string): Promise<string> {
  const igUserId = process.env.META_IG_USER_ID?.trim()
  const token = process.env.META_ACCESS_TOKEN?.trim()
  const v = process.env.META_GRAPH_VERSION?.trim() || 'v21.0'
  if (!igUserId || !token) throw new Error('META_IG_USER_ID or META_ACCESS_TOKEN missing')

  const u1 = new URL(`https://graph.facebook.com/${v}/${igUserId}/media`)
  u1.searchParams.set('image_url', imageUrl)
  u1.searchParams.set('caption', caption)
  u1.searchParams.set('access_token', token)

  const created = (await graphPost(u1.toString())) as { id?: string }
  if (!created.id) throw new Error('Instagram media container failed')

  const u2 = new URL(`https://graph.facebook.com/${v}/${igUserId}/media_publish`)
  u2.searchParams.set('creation_id', created.id)
  u2.searchParams.set('access_token', token)

  const pub = (await graphPost(u2.toString())) as { id?: string }
  if (!pub.id) throw new Error('Instagram publish failed')
  return pub.id
}

export async function publishFacebookPagePhoto(imageUrl: string, message: string): Promise<string | null> {
  const pageId = process.env.META_PAGE_ID?.trim()
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim()
  const v = process.env.META_GRAPH_VERSION?.trim() || 'v21.0'
  if (!pageId || !token) return null

  const u = new URL(`https://graph.facebook.com/${v}/${pageId}/photos`)
  u.searchParams.set('url', imageUrl)
  u.searchParams.set('caption', message)
  u.searchParams.set('access_token', token)

  const j = (await graphPost(u.toString())) as { id?: string; post_id?: string }
  return j.post_id ?? j.id ?? null
}
