import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  appendThreadMessage,
  lastMessagePreview,
  listAllThreadsForAdmin,
  markThreadSeenByAdmin,
  getThreadMessagesAdmin,
  pullThreadsForAdmin,
  type OwnerAdminThread,
} from '../../utils/ownerAdminMessages'
import { formatDateDots } from '../../utils/ownerSession'

export function AdminOwnerMessagesPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [openMessages, setOpenMessages] = useState<{ threadId: string; msgs: { id: string; from: 'owner' | 'admin'; body: string; at: string }[] } | null>(null)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-messages-updated', on)
    return () => {
      window.removeEventListener('rentadria-owner-messages-updated', on)
    }
  }, [bump])

  const threads = useMemo(() => {
    void epoch
    return listAllThreadsForAdmin()
  }, [epoch])

  useEffect(() => {
    let stopped = false
    const pull = () => {
      void pullThreadsForAdmin().then((ok) => {
        if (stopped) return
        setLoadError(!ok)
        bump()
      })
    }
    pull()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') pull()
    }, 30_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [bump])

  const onSendReply = async () => {
    if (!openThreadId) return
    if (!replyDraft.trim()) return
    const ok = await appendThreadMessage({
      threadId: openThreadId,
      from: 'admin',
      body: replyDraft,
    })
    if (!ok) {
      window.alert(t('admin.ownerMessages.sendError'))
      return
    }
    setReplyDraft('')
    const msgs = await getThreadMessagesAdmin(openThreadId)
    if (msgs) setOpenMessages({ threadId: openThreadId, msgs })
    void pullThreadsForAdmin().then((ok) => {
      setLoadError(!ok)
      bump()
    })
  }

  return (
    <section className="ra-admin-owner-msg" aria-labelledby="admin-owner-msg-h">
      <header className="ra-admin-owner-msg__head">
        <h2 id="admin-owner-msg-h" className="ra-admin-owner-msg__title">
          {t('admin.ownerMessages.title')}
        </h2>
        <p className="ra-admin-owner-msg__lead">{t('admin.ownerMessages.lead')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.ownerMessages.loadError')}</p> : null}
      </header>

      {threads.length === 0 ? (
        <p className="ra-admin-owner-msg__empty">{t('admin.ownerMessages.empty')}</p>
      ) : (
        <div className="ra-owner-table-wrap">
          <table className="ra-owner-table ra-owner-table--admin-threads">
            <thead>
              <tr>
                <th>{t('admin.ownerMessages.colSubject')}</th>
                <th>{t('admin.ownerMessages.colOwner')}</th>
                <th>{t('admin.ownerMessages.colUpdated')}</th>
                <th>{t('admin.ownerMessages.colPreview')}</th>
                <th>{t('admin.ownerMessages.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((th: OwnerAdminThread) => (
                <tr key={th.id}>
                  <td>
                    <button
                      type="button"
                      className="ra-admin-owner-msg__link"
                      onClick={() => {
                        setOpenThreadId(th.id)
                        setReplyDraft('')
                        void markThreadSeenByAdmin(th.id)
                        void (async () => {
                          const msgs = await getThreadMessagesAdmin(th.id)
                          if (msgs) setOpenMessages({ threadId: th.id, msgs })
                          bump()
                        })()
                      }}
                    >
                      {th.subject}
                    </button>
                  </td>
                  <td>{th.ownerEmail ?? th.ownerUserId}</td>
                  <td>{formatDateDots(th.updatedAt)}</td>
                  <td className="ra-owner-table__msg">{lastMessagePreview(th)}</td>
                  <td>{th.messageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openThreadId && openMessages && openMessages.threadId === openThreadId && (
        <div
          className="ra-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-thread-modal-h"
          onClick={() => setOpenThreadId(null)}
        >
          <div className="ra-modal__panel ra-admin-owner-msg__modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ra-modal__close"
              onClick={() => setOpenThreadId(null)}
              aria-label={t('admin.ownerMessages.close')}
            >
              ×
            </button>
            <h3 id="admin-thread-modal-h" className="ra-admin-owner-msg__modal-title">
              {threads.find((t) => t.id === openThreadId)?.subject ?? '—'}
            </h3>
            <p className="ra-admin-owner-msg__owner-line">
              {t('admin.ownerMessages.threadOwner')}: {threads.find((t) => t.id === openThreadId)?.ownerEmail ?? '—'}
            </p>
            <div className="ra-owner-messages__history">
              {openMessages.msgs.map((m) => (
                <div
                  key={m.id}
                  className={`ra-owner-messages__bubble ${m.from === 'admin' ? 'is-admin' : 'is-owner'}`}
                >
                  <div className="ra-owner-messages__bubble-meta">
                    {m.from === 'admin' ? t('admin.ownerMessages.roleAdmin') : t('admin.ownerMessages.roleOwner')}
                    <time dateTime={m.at}>{formatDateDots(m.at)}</time>
                  </div>
                  <p className="ra-owner-messages__bubble-body">{m.body}</p>
                </div>
              ))}
            </div>
            <label className="ra-fld">
              <span>{t('admin.ownerMessages.replyLabel')}</span>
              <textarea
                rows={3}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={t('admin.ownerMessages.replyPlaceholder')}
              />
            </label>
            <button type="button" className="ra-btn ra-btn--primary" onClick={() => void onSendReply()}>
              {t('admin.ownerMessages.replySend')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
