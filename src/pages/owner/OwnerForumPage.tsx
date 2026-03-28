import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addReply,
  createTopic,
  getTopic,
  listTopics,
  type ForumReply,
  type ForumTopic,
} from '../../utils/ownerForum'
import { displayFirstName, formatDateDots, type OwnerProfile } from '../../utils/ownerSession'

const PAGE_SIZE = 4

type Props = {
  profile: OwnerProfile
}

type ThreadMessage =
  | {
      id: string
      kind: 'op'
      authorName: string
      body: string
      createdAt: string
    }
  | (ForumReply & { kind: 'reply' })

function threadMessages(topic: ForumTopic): ThreadMessage[] {
  return [
    {
      id: `op-${topic.id}`,
      kind: 'op',
      authorName: topic.authorName,
      body: topic.initialBody,
      createdAt: topic.createdAt,
    },
    ...topic.replies.map((r) => ({ ...r, kind: 'reply' as const })),
  ]
}

export function OwnerForumPage({ profile }: Props) {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [composerOpen, setComposerOpen] = useState(false)
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [replyDraft, setReplyDraft] = useState('')
  const [pageByTopic, setPageByTopic] = useState<Record<string, number>>({})

  const authorLabel = displayFirstName(profile.displayName) || profile.email.split('@')[0] || '—'

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-forum-updated', on)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_owner_forum_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-forum-updated', on)
      window.removeEventListener('storage', onStorage)
    }
  }, [bump])

  const topics = useMemo(() => listTopics(), [epoch])

  const toggleTopic = (topicId: string) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null)
      setReplyDraft('')
      return
    }
    const topic = getTopic(topicId)
    const msgs = topic ? threadMessages(topic) : []
    const tp = Math.max(1, Math.ceil(msgs.length / PAGE_SIZE))
    setPageByTopic((prev) => ({ ...prev, [topicId]: tp }))
    setExpandedTopicId(topicId)
    setReplyDraft('')
  }

  const setPage = (topicId: string, p: number) => {
    const topic = getTopic(topicId)
    const msgs = topic ? threadMessages(topic) : []
    const tp = Math.max(1, Math.ceil(msgs.length / PAGE_SIZE))
    const next = Math.min(Math.max(1, p), tp)
    setPageByTopic((prev) => ({ ...prev, [topicId]: next }))
  }

  const onCreateTopic = () => {
    if (!titleDraft.trim() || !bodyDraft.trim()) {
      window.alert(t('owner.forumPage.errEmpty'))
      return
    }
    const row = createTopic({
      authorUserId: profile.userId,
      authorName: authorLabel,
      title: titleDraft,
      initialBody: bodyDraft,
    })
    if (row) {
      setTitleDraft('')
      setBodyDraft('')
      setComposerOpen(false)
      setExpandedTopicId(row.id)
      setPageByTopic((prev) => ({ ...prev, [row.id]: 1 }))
      setReplyDraft('')
      bump()
    }
  }

  const onReply = () => {
    if (!expandedTopicId) return
    if (!replyDraft.trim()) {
      window.alert(t('owner.forumPage.errReply'))
      return
    }
    const r = addReply({
      topicId: expandedTopicId,
      authorUserId: profile.userId,
      authorName: authorLabel,
      body: replyDraft,
    })
    if (r) {
      setReplyDraft('')
      bump()
      const topic = getTopic(expandedTopicId)
      if (topic) {
        const msgs = threadMessages(topic)
        const tp = Math.max(1, Math.ceil(msgs.length / PAGE_SIZE))
        setPageByTopic((prev) => ({ ...prev, [expandedTopicId]: tp }))
      }
    }
  }

  return (
    <section className="ra-owner-forum" aria-labelledby="owner-forum-h">
      <div className="ra-owner-forum__head">
        <span className="ra-owner-forum__ico" aria-hidden>
          💭
        </span>
        <div>
          <h2 id="owner-forum-h" className="ra-owner-forum__title">
            {t('owner.forumPage.title')}
          </h2>
          <p className="ra-owner-forum__lead">{t('owner.forumPage.lead')}</p>
        </div>
      </div>

      <div className="ra-owner-forum__toolbar">
        <button
          type="button"
          className="ra-btn ra-btn--primary"
          aria-expanded={composerOpen}
          onClick={() => setComposerOpen((v) => !v)}
        >
          {composerOpen ? t('owner.forumPage.btnHideComposer') : t('owner.forumPage.btnNew')}
        </button>
      </div>

      {composerOpen && (
        <div className="ra-owner-forum__composer" id="forum-composer">
          <h3 className="ra-owner-forum__composer-h">{t('owner.forumPage.newTitle')}</h3>
          <label className="ra-fld">
            <span>{t('owner.forumPage.fieldTitle')}</span>
            <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder={t('owner.forumPage.phTitle')} />
          </label>
          <label className="ra-fld">
            <span>{t('owner.forumPage.fieldBody')}</span>
            <textarea rows={5} value={bodyDraft} onChange={(e) => setBodyDraft(e.target.value)} placeholder={t('owner.forumPage.phBody')} />
          </label>
          <button type="button" className="ra-btn ra-btn--primary" onClick={onCreateTopic}>
            {t('owner.forumPage.submitTopic')}
          </button>
        </div>
      )}

      {topics.length === 0 ? (
        <p className="ra-owner-forum__empty">{t('owner.forumPage.empty')}</p>
      ) : (
        <div className="ra-owner-table-wrap">
          <table className="ra-owner-table ra-owner-table--forum">
            <thead>
              <tr>
                <th>{t('owner.forumPage.colTitle')}</th>
                <th>{t('owner.forumPage.colAuthor')}</th>
                <th>{t('owner.forumPage.colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((row: ForumTopic) => {
                const expanded = expandedTopicId === row.id
                const msgs = threadMessages(row)
                const totalPages = Math.max(1, Math.ceil(msgs.length / PAGE_SIZE))
                const rawPage = pageByTopic[row.id] ?? 1
                const safePage = Math.min(Math.max(1, rawPage), totalPages)
                const start = (safePage - 1) * PAGE_SIZE
                const pageSlice = msgs.slice(start, start + PAGE_SIZE)

                return (
                  <Fragment key={row.id}>
                    <tr className={expanded ? 'is-expanded' : undefined}>
                      <td>
                        <button
                          type="button"
                          className="ra-owner-forum__title-link"
                          aria-expanded={expanded}
                          onClick={() => toggleTopic(row.id)}
                        >
                          <span className="ra-owner-forum__chev" aria-hidden>
                            {expanded ? '▼' : '▶'}
                          </span>
                          {row.title}
                        </button>
                      </td>
                      <td>{row.authorName}</td>
                      <td>{formatDateDots(row.createdAt)}</td>
                    </tr>
                    {expanded && (
                      <tr className="ra-owner-forum__detail-row">
                        <td colSpan={3}>
                          <div className="ra-owner-forum__panel" role="region" aria-label={t('owner.forumPage.threadRegion')}>
                            <p className="ra-owner-forum__meta">
                              {t('owner.forumPage.op')}: <strong>{row.authorName}</strong> · {formatDateDots(row.createdAt)}
                            </p>

                            <div className="ra-owner-forum__messages">
                              {pageSlice.map((m) => (
                                <div
                                  key={m.id}
                                  className={`ra-owner-forum__msg ${m.kind === 'op' ? 'ra-owner-forum__msg--op' : ''}`}
                                >
                                  <div className="ra-owner-forum__msg-head">
                                    <strong>{m.authorName}</strong>
                                    <time dateTime={m.createdAt}>{formatDateDots(m.createdAt)}</time>
                                  </div>
                                  <p className="ra-owner-forum__msg-body">{m.body}</p>
                                </div>
                              ))}
                            </div>

                            {totalPages > 1 && (
                              <div className="ra-owner-forum__pager">
                                <button
                                  type="button"
                                  className="ra-btn ra-btn--ghost ra-btn--sm"
                                  disabled={safePage <= 1}
                                  onClick={() => setPage(row.id, safePage - 1)}
                                >
                                  {t('owner.forumPage.prevPage')}
                                </button>
                                <span className="ra-owner-forum__pager-info">
                                  {t('owner.forumPage.pageOf', { current: safePage, total: totalPages })}
                                </span>
                                <button
                                  type="button"
                                  className="ra-btn ra-btn--ghost ra-btn--sm"
                                  disabled={safePage >= totalPages}
                                  onClick={() => setPage(row.id, safePage + 1)}
                                >
                                  {t('owner.forumPage.nextPage')}
                                </button>
                              </div>
                            )}

                            <label className="ra-fld ra-owner-forum__reply-fld">
                              <span>{t('owner.forumPage.replyLabel')}</span>
                              <textarea
                                rows={3}
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                placeholder={t('owner.forumPage.replyPh')}
                              />
                            </label>
                            <button type="button" className="ra-btn ra-btn--primary" onClick={onReply}>
                              {t('owner.forumPage.replySend')}
                            </button>
                            <p className="ra-owner-forum__hint">{t('owner.forumPage.noDelete')}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
