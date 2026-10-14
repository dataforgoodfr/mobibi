import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { EmailAdapter } from 'payload'

/**
 * Payload's own fallback when no `email` adapter is configured
 * (`consoleEmailAdapter`) only logs the recipient and subject, never the
 * body — useless here, since the magic-link URL lives in the body. This
 * adapter logs the full message so the link is actually visible in the
 * terminal during local development and CI.
 */
export const devEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'console-dev',
  defaultFromAddress: 'no-reply@mobibi.fr',
  defaultFromName: 'mobibi',
  sendEmail: async (message) => {
    payload.logger.info(
      `\n--- email ---\nTo: ${JSON.stringify(message.to)}\nSubject: ${message.subject}\n\n${
        message.text ?? message.html
      }\n-------------\n`,
    )
  },
})

/**
 * Real transport, used whenever SMTP_HOST is set (production) — falls back
 * to `devEmailAdapter` otherwise (local dev / CI), so no SMTP creds are
 * needed to run this app locally. See CLAUDE.md → Decisions.
 */
export const emailAdapter: EmailAdapter | Promise<EmailAdapter> = process.env.SMTP_HOST
  ? nodemailerAdapter({
      defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'no-reply@mobibi.fr',
      defaultFromName: process.env.SMTP_FROM_NAME || 'mobibi',
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      },
    })
  : devEmailAdapter
