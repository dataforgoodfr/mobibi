import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Admins } from './collections/Admins'
import { Media } from './collections/Media'
import { Organizations } from './collections/Organizations'
import { Interpellations } from './collections/Interpellations'
import { Petitions } from './collections/Petitions'
import { CampaignTargets } from './collections/CampaignTargets'
import { InterpellationSubmissions } from './collections/InterpellationSubmissions'
import { PetitionSignatures } from './collections/PetitionSignatures'
import { Citizens } from './collections/Citizens'
import { MagicLinks } from './collections/MagicLinks'
import { emailAdapter } from './lib/email'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // Deliberately NOT set: Payload's own `url` field on uploads hardcodes
  // `relative: false` once `serverURL` is set (`uploads/getBaseFields.js`),
  // switching every media URL from relative to absolute — which then needs
  // `next.config.ts`'s `images.remotePatterns`, and has a documented history
  // of its own bugs (redirect loops, doubled origins, thumbnail URL
  // mismatches — payloadcms/payload#14918, #12171, #3097). The one place an
  // absolute origin is needed (the magic-link email URL,
  // `src/endpoints/magicLink.ts`) reads `PAYLOAD_PUBLIC_SERVER_URL` directly
  // instead, so that need doesn't leak into every upload URL in the app.
  admin: {
    user: Admins.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  email: emailAdapter,
  collections: [
    Admins,
    Media,
    Organizations,
    Interpellations,
    Petitions,
    CampaignTargets,
    InterpellationSubmissions,
    PetitionSignatures,
    Citizens,
    MagicLinks,
  ],
  // Editorial content is authored per locale; slugs, emails, handles, counters and
  // everything on the submission/signature side stay single-valued.
  localization: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    fallback: true,
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Runs any pending migrations at payload.init() when push is off (i.e.
    // in production — push stays on by default in dev).
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [],
})
