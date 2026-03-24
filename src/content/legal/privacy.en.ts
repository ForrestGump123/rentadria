import type { LegalSection } from './types'

/** Privacy policy — replace with exact DOCX text if different */
export const PRIVACY_SECTIONS_EN: LegalSection[] = [
  {
    title: '1. Introduction',
    body:
      'RentAdria respects your privacy. This Policy explains what personal data we collect, for what purposes, on what legal basis and how long we keep it, and what rights you have under applicable data protection law.',
  },
  {
    title: '2. Data controller',
    body:
      'The controller for processing is RentAdria as identified by the contact details published on the Platform. For data protection requests, use the contact email shown in the contact section.',
  },
  {
    title: '3. Data we collect',
    body:
      'We may process: data you provide when registering (name, email, phone, country), listing content, technical data (IP address, device type, browser language, cookies necessary for operation), and communications with us for support or reports.',
  },
  {
    title: '4. Purposes and legal basis',
    body:
      'We process data to provide the Platform (contract), improve security and functionality (legitimate interests), comply with legal obligations, and — where required — on the basis of your consent (e.g. marketing, if introduced with separate consent).',
  },
  {
    title: '5. Sharing with third parties',
    body:
      'We do not sell your data. We may use trusted processors (e.g. hosting, email delivery, analytics according to settings) who process data on our instructions. We must disclose data to public authorities when required by law.',
  },
  {
    title: '6. Retention and security',
    body:
      'We keep data as long as necessary for the purpose or while an account exists, unless law requires longer retention. We apply appropriate technical and organisational security measures.',
  },
  {
    title: '7. Your rights',
    body:
      'Depending on applicable law, you may have the right to access, rectify, erase, restrict processing, object, data portability and withdraw consent where processing is consent-based. Contact us at the email in the contact section to exercise your rights.',
  },
  {
    title: '8. Cookies',
    body:
      'We use essential cookies for the Platform (e.g. language, session). Other categories, if introduced, will be described with a choice mechanism. By continuing after notice you accept essential cookies as described in the cookie notice.',
  },
  {
    title: '9. Changes',
    body:
      'We may update this Policy. Material changes will be highlighted on the Platform. The last update date appears at the bottom of this page.',
  },
]
