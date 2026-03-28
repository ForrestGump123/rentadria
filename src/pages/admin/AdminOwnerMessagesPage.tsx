import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  appendThreadMessage,
  getThread,
  lastMessagePreview,
  listAllThreadsForAdmin,
  type OwnerAdminThread,
} from '../../utils/ownerAdminMessages'
import { formatDateDots } from '../../utils/ownerSession'

export function AdminOwnerMessagesPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-messages-updated', on)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_owner_admin_threads_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-messages-updated', on)
      window.removeEventListener('storage', onStorage)
    }
  }, [bump])

  const threads = useMemo(() => listAllThreadsForAdmin(), [epoch])

  const openThread = useMemo(
    () => (openThreadId ? getThread(openThreadId) : undefined),
    [openThreadId, epoch],
  )

  const onSendReply = () => {
    if (!openThreadId) return
    const next = appendThreadMessage({
      threadId: openThreadId,
      from: 'admin',
      body: replyDraft,
    })
    if (next) {
      setReplyDraft('')
      bump()
    }
  }

  return (
    <section className="ra-admin-owner-msg" aria-labelledby="admin-owner-msg-h">
      <header className="ra-admin-owner-msg__head">
        <h2 id="admin-owner-msg-h" className="ra-admin-owner-msg__title">
          {t('admin.ownerMessages.title')}
        </h2>
        <p className="ra-admin-owner-msg__lead">{t('admin.ownerMessages.lead')}</p>
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
                      }}
                    >
                      {th.subject}
                    </button>
                  </td>
                  <td>{th.ownerEmail ?? th.ownerUserId}</td>
                  <td>{formatDateDots(th.updatedAt)}</td>
                  <td className="ra-owner-table__msg">{lastMessagePreview(th)}</td>
                  <td>{th.messages.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openThread && (
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
              {openThread.subject}
            </h3>
            <p className="ra-admin-owner-msg__owner-line">
              {t('admin.ownerMessages.threadOwner')}: {openThread.ownerEmail ?? openThread.ownerUserId}
            </p>
            <div className="ra-owner-messages__history">
              {openThread.messages.map((m) => (
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
            <button type="button" className="ra-btn ra-btn--primary" onClick={onSendReply}>
              {t('admin.ownerMessages.replySend')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
