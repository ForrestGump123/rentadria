import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addPrivateNote,
  addReminderNote,
  appendThreadMessage,
  createOwnerThread,
  getThread,
  lastMessagePreview,
  listPrivateNotesForOwner,
  listRemindersForOwner,
  listThreadsForOwner,
  markThreadSeenByOwner,
  type OwnerAdminThread,
} from '../../utils/ownerAdminMessages'
import { formatDateDots } from '../../utils/ownerSession'

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

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-messages-updated', on)
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'rentadria_owner_admin_threads_v1' ||
        e.key === 'rentadria_owner_private_notes_v1' ||
        e.key === 'rentadria_owner_reminder_notes_v1'
      )
        bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-messages-updated', on)
      window.removeEventListener('storage', onStorage)
    }
  }, [bump])

  const threads = useMemo(
    () => listThreadsForOwner(ownerUserId),
    [ownerUserId, epoch],
  )
  const privateNotes = useMemo(
    () => listPrivateNotesForOwner(ownerUserId),
    [ownerUserId, epoch],
  )
  const reminders = useMemo(
    () => listRemindersForOwner(ownerUserId),
    [ownerUserId, epoch],
  )

  const openThread = useMemo(
    () => (openThreadId ? getThread(openThreadId) : undefined),
    [openThreadId, epoch],
  )

  const onSavePrivate = () => {
    if (!addPrivateNote(ownerUserId, body)) return
    setBody('')
    bump()
  }

  const onSendAdmin = () => {
    if (!subject.trim() || !body.trim()) {
      window.alert(t('owner.messagesPage.errNeedSubjectBody'))
      return
    }
    createOwnerThread({
      ownerUserId,
      ownerEmail,
      subject,
      body,
    })
    setSubject('')
    setBody('')
    bump()
  }

  const onRemind = () => {
    if (!remindAt.trim()) return
    const iso = new Date(remindAt)
    if (Number.isNaN(iso.getTime())) return
    if (!addReminderNote(ownerUserId, body, iso.toISOString())) return
    setBody('')
    setRemindAt('')
    bump()
  }

  const onSendReply = () => {
    if (!openThreadId) return
    const next = appendThreadMessage({
      threadId: openThreadId,
      from: 'owner',
      body: replyDraft,
      actingOwnerUserId: ownerUserId,
    })
    if (next) {
      setReplyDraft('')
      bump()
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
          <button type="button" className="ra-btn ra-btn--ghost" onClick={onSavePrivate}>
            {t('owner.messagesPage.btnSave')}
          </button>
          <button type="button" className="ra-btn ra-btn--primary" onClick={onSendAdmin}>
            {t('owner.messagesPage.btnAdmin')}
          </button>
          <button type="button" className="ra-btn ra-btn--warn" onClick={onRemind}>
            {t('owner.messagesPage.btnRemind')}
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
                          markThreadSeenByOwner(th.id)
                        }}
                      >
                        {th.subject}
                      </button>
                    </td>
                    <td>{formatDateDots(th.updatedAt)}</td>
                    <td className="ra-owner-table__msg">{lastMessagePreview(th)}</td>
                    <td>{th.messages.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ra-owner-messages__lists">
        <div className="ra-owner-messages__list-col">
          <h4 className="ra-owner-messages__list-h">{t('owner.messagesPage.secPrivate')}</h4>
          <hr className="ra-owner-messages__rule" />
          {privateNotes.length === 0 ? (
            <p className="ra-owner-messages__dash">—</p>
          ) : (
            <ul className="ra-owner-messages__note-list">
              {privateNotes.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.at}>{formatDateDots(n.at)}</time>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ra-owner-messages__list-col">
          <h4 className="ra-owner-messages__list-h">{t('owner.messagesPage.secAdminTitles')}</h4>
          <hr className="ra-owner-messages__rule" />
          {threads.length === 0 ? (
            <p className="ra-owner-messages__dash">—</p>
          ) : (
            <ul className="ra-owner-messages__compact-list">
              {threads.map((th) => (
                <li key={th.id}>
                  <button type="button" className="ra-owner-messages__mini-link" onClick={() => setOpenThreadId(th.id)}>
                    {th.subject}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ra-owner-messages__list-col">
          <h4 className="ra-owner-messages__list-h">{t('owner.messagesPage.secReminders')}</h4>
          <hr className="ra-owner-messages__rule" />
          {reminders.length === 0 ? (
            <p className="ra-owner-messages__dash">—</p>
          ) : (
            <ul className="ra-owner-messages__note-list">
              {reminders.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.remindAt}>{formatDateDots(n.remindAt)}</time>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {openThread && (
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
              {openThread.subject}
            </h3>
            <div className="ra-owner-messages__history">
              {openThread.messages.map((m) => (
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
            <button type="button" className="ra-btn ra-btn--primary" onClick={onSendReply}>
              {t('owner.messagesPage.replySend')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
