import nodemailer from 'nodemailer'

type SendOpts = {
  to: string
  toName: string
  subject: string
  html: string
}

/** Brevo SMTP (preporučeno za xsmtpsib-* ključ) ili BREVO_API_KEY za REST. */
export async function sendTransactionalEmail({ to, toName, subject, html }: SendOpts): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'info@rentadria.com'
  const senderName = process.env.BREVO_SENDER_NAME || 'RentAdria'

  if (apiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`brevo_rest:${res.status}:${errText}`)
    }
    return
  }

  const smtpUser = process.env.BREVO_SMTP_USER?.trim()
  const smtpPass = process.env.BREVO_SMTP_PASS?.trim()
  if (!smtpUser || !smtpPass) {
    throw new Error(
      'missing_email_config: postavi BREVO_API_KEY (REST) ili BREVO_SMTP_USER + BREVO_SMTP_PASS (SMTP)',
    )
  }

  const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.BREVO_SMTP_PORT || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  })

  await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: `"${toName}" <${to}>`,
    subject,
    html,
  })
}
