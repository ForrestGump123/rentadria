import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  appendThreadMessage,
  createOwnerThread,
  lastMessagePreview,
  listThreadsForOwner,
  getThreadMessagesOwner,
  markThreadSeenByOwner,
  pullThreadsForOwner,
  type OwnerAdminThread,
} from '../../utils/ownerAdminMessages'
import { formatDateDots } from '../../utils/ownerSession'
import { listOwnerNotifications, markOwnerNotificationRead, pullOwnerNotificationsToLocal } from '../../utils/ownerNotifications'

type Props = {
  ownerUserId: string
  ownerEmail: string
}

export function OwnerMessagesPage({ ownerUserId, ownerEmail }: Props) {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [openMessages, setOpenMessages] = useState<{ threadId: string; msgs: { id: string; from: 'owner' | 'admin'; body: string; at: string }[] } | null>(null)
  const inflight = useRef(false)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-messages-updated', on)
    const onNotif = () => bump()
    window.addEventListener('rentadria-owner-notifications-updated', onNotif)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_owner_notifications_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-messages-updated', on)
      window.removeEventListener('rentadria-owner-notifications-updated', onNotif)
      window.removeEventListener('storage', onStorage)
    }
  }, [bump])

  useEffect(() => {
    void pullOwnerNotificationsToLocal(80)
    void pullThreadsForOwner().then(() => bump())
  }, [ownerUserId, bump])

  const pullAll = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      await Promise.all([
        pullOwnerNotificationsToLocal(80),
        pullThreadsForOwner(),
      ])
      if (openThreadId) {
        const msgs = await getThreadMessagesOwner(openThreadId)
        if (msgs) setOpenMessages({ threadId: openThreadId, msgs })
      }
      bump()
    } finally {
      inflight.current = false
    }
  }, [openThreadId, bump])

  useEffect(() => {
    let timer: number | null = null

    const schedule = () => {
      if (timer != null) return
      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        void pullAll()
      }, 30_000)
    }

    const stop = () => {
      if (timer != null) window.clearInterval(timer)
      timer = null
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        schedule()
        void pullAll()
      } else {
        stop()
      }
    }

    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [pullAll])

  const notifications = useMemo(() => {
    void epoch
    return listOwnerNotifications()
  }, [epoch])

  const threads = useMemo(() => {
    void epoch
    return listThreadsForOwner()
  }, [epoch])

  const onSendAdmin = async () => {
    if (!subject.trim() || !body.trim()) {
      window.alert(t('owner.messagesPage.errNeedSubjectBody'))
      return
    }
    setSending(true)
    try {
      const ok = await createOwnerThread({
        ownerUserId,
        ownerEmail,
        subject,
        body,
      })
      if (!ok) {
        window.alert(t('owner.messagesPage.errSend'))
        return
      }
      setSubject('')
      setBody('')
      setRemindAt('')
      await pullAll()
    } finally {
      setSending(false)
    }
  }

  const onSendReply = async () => {
    if (!openThreadId) return
    if (!replyDraft.trim()) return
    setReplySending(true)
    try {
      const ok = await appendThreadMessage({
        threadId: openThreadId,
        from: 'owner',
        body: replyDraft,
        actingOwnerUserId: ownerUserId,
      })
      if (!ok) {
        window.alert(t('owner.messagesPage.errSend'))
        return
      }
      setReplyDraft('')
      await pullAll()
    } finally {
      setReplySending(false)
    }
  }

  return (
    <section className="ra-owner-messages" aria-labelledby="owner-messages-h">
      <div className="ra-owner-messages__head">
        <span className="ra-owner-messages__ico" aria-hidden>
          ✉️
        </span>
        <div>
          <h2 id="owner-messages-h" className="ra-owner-messages__title">
            {t('owner.messagesPage.title')}
          </h2>
          <p className="ra-owner-messages__lead">{t('owner.messagesPage.lead')}</p>
        </div>
      </div>

      <div className="ra-owner-messages__compose">
        <label className="ra-fld">
          <span>{t('owner.messagesPage.subjectLabel')}</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('owner.messagesPage.subjectPlaceholder')}
            autoComplete="off"
          />
        </label>
        <label className="ra-fld">
          <span>{t('owner.messagesPage.bodyLabel')}</span>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('owner.messagesPage.bodyPlaceholder')}
          />
        </label>
        <label className="ra-fld ra-owner-messages__remind">
          <span>{t('owner.messagesPage.remindAtLabel')}</span>
          <input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </label>
        <div className="ra-owner-messages__actions">
          <button type="button" className="ra-btn ra-btn--primary" disabled={sending} onClick={() => void onSendAdmin()}>
            {t('owner.messagesPage.btnAdmin')}
          </button>
        </div>
      </div>

      <div className="ra-owner-messages__threads">
        <h3 className="ra-owner-messages__subh">{t('owner.messagesPage.threadsTitle')}</h3>
        {threads.length === 0 ? (
          <p className="ra-owner-messages__empty">{t('owner.messagesPage.noThreads')}</p>
        ) : (
          <div className="ra-owner-table-wrap">
            <table className="ra-owner-table ra-owner-table--msg-threads">
              <thead>
                <tr>
                  <th>{t('owner.messagesPage.colSubject')}</th>
                  <th>{t('owner.messagesPage.colUpdated')}</th>
                  <th>{t('owner.messagesPage.colPreview')}</th>
                  <th>{t('owner.messagesPage.colCount')}</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((th: OwnerAdminThread) => (
                  <tr key={th.id}>
                    <td>
                      <button
                        type="button"
                        className="ra-owner-messages__thread-link"
                        onClick={() => {
                          setOpenThreadId(th.id)
                          setReplyDraft('')
                          void markThreadSeenByOwner(th.id)
                          void (async () => {
                            const msgs = await getThreadMessagesOwner(th.id)
                            if (msgs) setOpenMessages({ threadId: th.id, msgs })
                            bump()
                          })()
                        }}
                      >
                        {th.subject}
                      </button>
                    </td>
                    <td>{formatDateDots(th.updatedAt)}</td>
                    <td className="ra-owner-table__msg">{lastMessagePreview(th)}</td>
                    <td>{th.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ra-owner-messages__threads">
        <h3 className="ra-owner-messages__subh">{t('owner.messagesPage.notificationsTitle')}</h3>
        {notifications.length === 0 ? (
          <p className="ra-owner-messages__empty">{t('owner.messagesPage.notificationsEmpty')}</p>
        ) : (
          <div className="ra-owner-table-wrap">
            <table className="ra-owner-table ra-owner-table--msg-threads">
              <thead>
                <tr>
                  <th>{t('owner.messagesPage.colUpdated')}</th>
                  <th>{t('owner.messagesPage.notificationsColTitle')}</th>
                  <th>{t('owner.messagesPage.notificationsColStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{formatDateDots(n.createdAt)}</td>
                    <td className="ra-owner-table__msg">
                      <strong>{n.title || '—'}</strong>
                      <div>{n.body}</div>
                    </td>
                    <td>
                      {n.readAt ? (
                        <span className="ra-admin-owners__badge">{t('owner.messagesPage.notificationsRead')}</span>
                      ) : (
                        <button
                          type="button"
                          className="ra-btn ra-btn--sm ra-btn--ghost"
                          onClick={() => void markOwnerNotificationRead(n.id)}
                        >
                          {t('owner.messagesPage.notificationsMarkRead')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openThreadId && openMessages && openMessages.threadId === openThreadId && (
        <div
          className="ra-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-thread-modal-h"
          onClick={() => setOpenThreadId(null)}
        >
          <div className="ra-modal__panel ra-owner-messages__modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ra-modal__close"
              onClick={() => setOpenThreadId(null)}
              aria-label={t('owner.messagesPage.close')}
            >
              ×
            </button>
            <h3 id="owner-thread-modal-h" className="ra-owner-messages__modal-title">
              {threads.find((t) => t.id === openThreadId)?.subject ?? '—'}
            </h3>
            <div className="ra-owner-messages__history">
              {openMessages.msgs.map((m) => (
                <div
                  key={m.id}
                  className={`ra-owner-messages__bubble ${m.from === 'admin' ? 'is-admin' : 'is-owner'}`}
                >
                  <div className="ra-owner-messages__bubble-meta">
                    {m.from === 'admin' ? t('owner.messagesPage.roleAdmin') : t('owner.messagesPage.roleYou')}
                    <time dateTime={m.at}>{formatDateDots(m.at)}</time>
                  </div>
                  <p className="ra-owner-messages__bubble-body">{m.body}</p>
                </div>
              ))}
            </div>
            <label className="ra-fld">
              <span>{t('owner.messagesPage.replyLabel')}</span>
              <textarea
                rows={3}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={t('owner.messagesPage.replyPlaceholder')}
              />
            </label>
            <button type="button" className="ra-btn ra-btn--primary" disabled={replySending} onClick={() => void onSendReply()}>
              {t('owner.messagesPage.replySend')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
