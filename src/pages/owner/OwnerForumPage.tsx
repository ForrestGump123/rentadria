import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addReply,
  createTopic,
  getTopic,
  listTopics,
  pullThread,
  pullTopics,
  type ForumReply,
  type ForumTopic,
  type ForumTopicListRow,
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
  const inflight = useRef(false)

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-forum-updated', on)
    return () => {
      window.removeEventListener('rentadria-owner-forum-updated', on)
    }
  }, [bump])

  const topics = useMemo(() => {
    void epoch
    return listTopics()
  }, [epoch])

  const pull = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      await pullTopics()
      if (expandedTopicId) await pullThread(expandedTopicId)
      bump()
    } finally {
      inflight.current = false
    }
  }, [bump, expandedTopicId])

  useEffect(() => {
    void pull()

    const onVis = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVis)

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void pull()
    }, 30_000)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(timer)
    }
  }, [pull])

  const toggleTopic = (topicId: string) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null)
      setReplyDraft('')
      return
    }
    void pullThread(topicId).finally(() => bump())
    setPageByTopic((prev) => ({ ...prev, [topicId]: 1 }))
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
    void (async () => {
      const r = await createTopic({
      authorUserId: profile.userId,
      authorName: authorLabel,
      title: titleDraft,
      initialBody: bodyDraft,
      })
      if (!r.ok) return
      setTitleDraft('')
      setBodyDraft('')
      setComposerOpen(false)
      setExpandedTopicId(r.topicId)
      setPageByTopic((prev) => ({ ...prev, [r.topicId]: 1 }))
      setReplyDraft('')
      bump()
    })()
  }

  const onReply = () => {
    if (!expandedTopicId) return
    if (!replyDraft.trim()) {
      window.alert(t('owner.forumPage.errReply'))
      return
    }
    void (async () => {
      const r = await addReply({
        topicId: expandedTopicId,
        authorUserId: profile.userId,
        authorName: authorLabel,
        body: replyDraft,
      })
      if (!r.ok) return
      setReplyDraft('')
      bump()
      const topic = getTopic(expandedTopicId)
      if (topic) {
        const msgs = threadMessages(topic)
        const tp = Math.max(1, Math.ceil(msgs.length / PAGE_SIZE))
        setPageByTopic((prev) => ({ ...prev, [expandedTopicId]: tp }))
      }
    })()
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
              {topics.map((row: ForumTopicListRow) => {
                const expanded = expandedTopicId === row.id
                const full = expanded ? getTopic(row.id) : undefined
                const msgs = full ? threadMessages(full) : []
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
                              {t('owner.forumPage.op')}: <strong>{full?.authorName ?? row.authorName}</strong> ·{' '}
                              {formatDateDots(full?.createdAt ?? row.createdAt)}
                            </p>

                            <div className="ra-owner-forum__messages">
                              {!full ? (
                                <p className="ra-owner-forum__empty">{t('owner.forumPage.loadingThread')}</p>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>

                            {full && totalPages > 1 && (
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
                                disabled={!full}
                              />
                            </label>
                            <button type="button" className="ra-btn ra-btn--primary" onClick={onReply} disabled={!full}>
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
