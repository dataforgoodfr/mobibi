import { getPayload } from 'payload'
import type { Payload } from 'payload'

import config from './payload.config'

/**
 * Development seed built from the design handoff's mock data
 * (`design_handoff_mobibi/app/data.jsx`).
 *
 * Idempotent: every document is upserted by its natural key, so it can be re-run.
 * It never deletes, so existing submissions and signatures are left alone.
 *
 *   pnpm payload run src/seed.ts
 */

/** Minimal Lexical document from plain paragraphs. */
const richText = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      textFormat: 0,
      children: [
        {
          type: 'text',
          text,
          detail: 0,
          format: 0,
          mode: 'normal' as const,
          style: '',
          version: 1,
        },
      ],
    })),
  },
})

const MSG_EMAIL = `Madame, Monsieur,

Je vous écris au sujet de la proposition de loi qui instaure une présomption de légitime défense pour les forces de l'ordre, adoptée par l'Assemblée nationale le 7 juillet 2026 et désormais soumise au Sénat.

Ce texte inverse la charge de la preuve : en cas de tir mortel, ce ne serait plus à la justice de démontrer que l'usage de la force était nécessaire et proportionné, mais aux victimes et à leurs familles de prouver le contraire. Depuis la mort de Nahel Merzouk en 2023, on sait où mène l'absence de contrôle réel du recours à la force — ce n'est pas le moment de l'affaiblir encore.

Je vous demande de voter contre ce texte lors de son examen au Sénat.

Veuillez agréer mes sincères salutations.`

const MSG_TWITTER = `@{handle} La loi « permis de tuer » inverse la charge de la preuve quand un policier tue. Vous l'examinez bientôt au Sénat : votez contre. #StopImpunite #NonALaLoiPermisDeTuer`

const ORGANIZATIONS = [
  {
    slug: 'urgence-libertes',
    name: 'Urgence Libertés',
    shortName: 'UL',
    color: '#b91c1c',
    description:
      "On documente les violences policières et on se bat pour que la loi protège les citoyen·nes, pas l'impunité.",
  },
  {
    slug: 'respire',
    name: 'Respire',
    shortName: 'R',
    color: '#2563eb',
    description: "Pour un air qu'on peut respirer sans se poser de questions.",
  },
  {
    slug: 'vie-paysanne',
    name: 'Vie Paysanne',
    shortName: 'VP',
    color: '#b4471f',
    description: 'Des fermes à taille humaine, pas des usines à animaux.',
  },
]

const TARGETS = [
  [
    'Amel',
    'Gacquerre',
    'Sénatrice',
    'UC',
    'Loire-Atlantique',
    '@a_gacquerre',
    'a.gacquerre@exemple.fr',
  ],
  ['Bruno', 'Vasseur', 'Député', 'RE', 'Gironde', '@b_vasseur', 'b.vasseur@exemple.fr'],
  ['Camille', 'Roy', 'Députée', 'LR', 'Nord', '@camille_roy', 'c.roy@exemple.fr'],
  ['David', 'Lemoine', 'Sénateur', 'LR', 'Manche', '@d_lemoine', 'd.lemoine@exemple.fr'],
  ['Émilie', 'Brun', 'Députée', 'HOR', 'Seine-Maritime', '@emilie_brun', 'e.brun@exemple.fr'],
  ['Farid', 'Benali', 'Député', 'RDPI', 'Hérault', '@f_benali', 'f.benali@exemple.fr'],
  ['Gaëlle', 'Marchand', 'Sénatrice', 'UC', 'Puy-de-Dôme', '@g_marchand', 'g.marchand@exemple.fr'],
  ['Hugo', 'Petit', 'Député', 'RE', 'Moselle', '@hugo_petit', 'h.petit@exemple.fr'],
  ['Inès', 'Caron', 'Députée', 'LR', 'Gers', '@ines_caron', 'i.caron@exemple.fr'],
  ['Julien', 'Faure', 'Sénateur', 'LR', 'Oise', '@j_faure', 'j.faure@exemple.fr'],
  ['Karima', 'Dubois', 'Députée', 'RDPI', 'Hautes-Pyrénées', '@k_dubois', 'k.dubois@exemple.fr'],
  ['Lucas', 'Garnier', 'Ministre', 'Gouvernement', 'Intérieur', '@l_garnier', 'cabinet@exemple.fr'],
] as const

const FIRST_NAMES = [
  'Nina',
  'Théo',
  'Sofia',
  'Malik',
  'Chloé',
  'Yanis',
  'Léa',
  'Noah',
  'Inès',
  'Adam',
  'Manon',
  'Karim',
  'Alice',
  'Samuel',
  'Jade',
  'Lucie',
  'Rayan',
  'Camille',
  'Enzo',
  'Zoé',
  'Nathan',
  'Sarah',
  'Hugo',
  'Lina',
  'Mathis',
  'Emma',
  'Yasmine',
  'Louis',
  'Maya',
  'Baptiste',
] as const

const CITIES = [
  'Lyon',
  'Nantes',
  'Marseille',
  'Lille',
  'Bordeaux',
  'Toulouse',
  'Strasbourg',
  'Rennes',
  'Grenoble',
  'Montpellier',
  'Nice',
  'Nancy',
  'Reims',
  'Angers',
  'Dijon',
  'Le Havre',
  'Saint-Étienne',
  'Toulon',
  'Brest',
  'Limoges',
] as const

const SIGNER_COUNT = 250

/**
 * mulberry32: a tiny seeded PRNG. Picking names/cities with `Math.random()`
 * would pick a different 250 people on every `pnpm seed` run — since the
 * citizen loop below upserts by email, that would create a new batch of
 * accounts each time rather than updating the same 250. A fixed seed makes
 * the "random" cast identical on every run.
 */
const mulberry32 = (seed: number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Shared across both mobilisations: the same citizen can sign a petition and
 * declare an interpellation, so one list of accounts feeds both seed loops
 * below instead of two disjoint casts of fake people. Names and cities repeat
 * across entries on purpose — a small pool drawn with replacement, not 250
 * distinct identities to maintain.
 */
const CITIZENS: [string, string][] = (() => {
  const random = mulberry32(20260911)
  return Array.from({ length: SIGNER_COUNT }, () => [
    FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)],
    CITIES[Math.floor(random() * CITIES.length)],
  ])
})()

/** A few (citizen, target, channel) triples so counters don't start at 0. */
const SEED_SUBMISSIONS = [
  { citizen: 0, target: 'amelgacquerre', channel: 'email' },
  { citizen: 1, target: 'amelgacquerre', channel: 'twitter' },
  { citizen: 2, target: 'brunovasseur', channel: 'email' },
  { citizen: 3, target: 'camilleroy', channel: 'email' },
  { citizen: 4, target: 'davidlemoine', channel: 'twitter' },
  { citizen: 0, target: 'brunovasseur', channel: 'twitter' },
] as const

type SeedCollection =
  | 'organizations'
  | 'interpellations'
  | 'petitions'
  | 'campaign-targets'
  | 'citizens'
  | 'petition-signatures'

/**
 * Create the document, or update it if its natural key already matches — so the
 * seed can be re-run without duplicating anything or deleting live data.
 */
const upsert = async (
  payload: Payload,
  collection: SeedCollection,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> & { id: number }> => {
  const { docs } = await payload.find({
    collection,
    where: where as never,
    limit: 1,
    depth: 0,
    locale: 'fr',
  })

  const existing = docs[0]

  const doc = existing
    ? await payload.update({
        collection,
        id: existing.id,
        data: data as never,
        locale: 'fr',
      })
    : await payload.create({
        collection,
        data: data as never,
        locale: 'fr',
      })

  return doc as unknown as Record<string, unknown> & { id: number }
}

export const seed = async (payload: Payload): Promise<void> => {
  const orgIds: Record<string, number> = {}

  for (const org of ORGANIZATIONS) {
    const doc = await upsert(payload, 'organizations', { slug: { equals: org.slug } }, org)
    orgIds[org.slug] = doc.id
    payload.logger.info(`organization: ${org.name}`)
  }

  const interpellation = await upsert(
    payload,
    'interpellations',
    {
      and: [
        { slug: { equals: 'loi-permis-de-tuer' } },
        { organization: { equals: orgIds['urgence-libertes'] } },
      ],
    },
    {
      organization: orgIds['urgence-libertes'],
      slug: 'loi-permis-de-tuer',
      status: 'active',
      startDate: '2026-01-15T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      title: "Loi « permis de tuer » : stop à l'impunité policière",
      tagline:
        "Une présomption de légitime défense pour la police, votée par l'Assemblée, arrive au Sénat. Écrivez aux sénateur·rices avant qu'il ne soit trop tard — ça prend 2 minutes.",
      context: richText([
        "Depuis la mort de Nahel Merzouk à Nanterre en juin 2023, le recours à la force par la police est au cœur du débat public. Plutôt que d'ouvrir ce débat, une partie de la classe politique a choisi la fuite en avant.",
        "La proposition de loi déposée le 3 décembre 2024 étend aux policiers la présomption de légitime défense déjà accordée aux gendarmes : en cas de tir, ce ne serait plus à la justice de prouver que l'usage de la force était nécessaire, mais aux victimes et à leurs familles de prouver le contraire.",
        "Adoptée par l'Assemblée nationale le 7 juillet 2026 (313 voix contre 199, 5 abstentions), elle est désormais entre les mains du Sénat.",
      ]),
      demand: richText([
        "On ne renverse pas la charge de la preuve quand il s'agit de vies humaines. Ce texte ne protège pas les policiers qui font leur travail dans le respect de la loi — il protège ceux qui ne le font pas.",
        "Interpellez les sénateur·rices avant l'examen en commission : demandez-leur de voter contre.",
      ]),
      timeline: [
        { label: 'Dépôt de la proposition de loi', dateLabel: '3 décembre 2024', state: 'done' },
        {
          label: "Adoptée par l'Assemblée nationale",
          dateLabel: '7 juillet 2026',
          state: 'done',
        },
        { label: 'Examen en commission', dateLabel: 'Sénat, oct. 2026', state: 'current' },
        { label: 'Séance publique au Sénat', dateLabel: 'Date à venir', state: 'upcoming' },
      ],
      defaultMessages: [
        {
          channelType: 'email',
          subject: 'Contre la loi « permis de tuer »',
          body: MSG_EMAIL,
        },
        { channelType: 'twitter', body: MSG_TWITTER },
      ],
    },
  )

  payload.logger.info(`interpellation: loi-permis-de-tuer (#${interpellation.id})`)

  const targetsByRef: Record<string, Record<string, unknown> & { id: number }> = {}

  for (const [firstName, lastName, role, politicalGroup, district, handle, email] of TARGETS) {
    const externalRef = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, '')
    const targetWhere = {
      and: [{ campaign: { equals: interpellation.id } }, { externalRef: { equals: externalRef } }],
    }

    // Payload assigns a fresh id to every row of an array field unless the
    // incoming data echoes the existing one back — so on a rerun, look up
    // last run's channel ids by type and carry them forward. Without this,
    // `interpellation-submissions.channelId` (a snapshot of one of these ids)
    // would silently stop matching the row it was seeded against.
    const { docs: existing } = await payload.find({
      collection: 'campaign-targets',
      where: targetWhere as never,
      limit: 1,
      depth: 0,
      locale: 'fr',
    })
    const existingChannelIds: Record<string, string> = {}
    for (const channel of (existing[0]?.channels ?? []) as { id: string; type: string }[]) {
      existingChannelIds[channel.type] = channel.id
    }

    // Only sets `id` when a prior run's row is known — an explicit `id: undefined`
    // risks being treated differently from the key being absent.
    const channelRow = (type: string, rest: Record<string, unknown>) => ({
      ...(existingChannelIds[type] ? { id: existingChannelIds[type] } : {}),
      type,
      ...rest,
    })

    const target = await upsert(payload, 'campaign-targets', targetWhere, {
      campaign: interpellation.id,
      externalRef,
      firstName,
      lastName,
      role,
      politicalGroup,
      district,
      tags: [politicalGroup, district],
      channels: [
        channelRow('email', {
          value: email,
          feedbackFields: [{ label: "Comment s'est passé l'échange ? (optionnel)" }],
        }),
        channelRow('twitter', { value: handle }),
      ],
    })

    targetsByRef[externalRef] = target
  }

  payload.logger.info(`campaign targets: ${TARGETS.length}`)

  // Shared identities for both mobilisations below: petition signatures and
  // interpellation submissions.
  const citizenIds: number[] = []

  // Keyed by index rather than a slugified pseudo: names repeat across the
  // generated cast, so the email — the citizen's real identity — can't be
  // derived from the display name the way the old fixed list allowed.
  for (const [index, [pseudo]] of CITIZENS.entries()) {
    const email = `seed-citizen-${index}@exemple.fr`
    const citizen = await upsert(
      payload,
      'citizens',
      { email: { equals: email } },
      { email, pseudo },
    )
    citizenIds.push(citizen.id)
  }

  payload.logger.info(`citizens: ${CITIZENS.length}`)

  // `submission_count` only moves through `incrementInterpellationCounters` (an
  // `afterChange` hook gated on `operation === 'create'`), and submissions have
  // no natural unique key by design, so this checks for an existing row itself
  // rather than going through `upsert` — the seed must not double-count on rerun.
  for (const { citizen, target: targetRef, channel } of SEED_SUBMISSIONS) {
    const target = targetsByRef[targetRef]
    const channels = target.channels as { id: string; type: string }[]
    const channelRow = channels.find((row) => row.type === channel)
    if (!channelRow) continue

    const citizenId = citizenIds[citizen]

    const { totalDocs } = await payload.find({
      collection: 'interpellation-submissions',
      where: {
        and: [
          { citizen: { equals: citizenId } },
          { target: { equals: target.id } },
          { channelId: { equals: channelRow.id } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (totalDocs > 0) continue

    await payload.create({
      collection: 'interpellation-submissions',
      data: {
        citizen: citizenId,
        target: target.id,
        campaign: interpellation.id,
        channelId: channelRow.id,
        channelType: channelRow.type,
      },
    })
  }

  payload.logger.info(
    `interpellation submissions: ${SEED_SUBMISSIONS.length} on loi-permis-de-tuer`,
  )

  const petition = await upsert(
    payload,
    'petitions',
    {
      and: [
        { slug: { equals: 'stop-elevages-usines' } },
        { organization: { equals: orgIds['vie-paysanne'] } },
      ],
    },
    {
      organization: orgIds['vie-paysanne'],
      slug: 'stop-elevages-usines',
      status: 'active',
      startDate: '2026-05-12T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
      title: 'Stop aux élevages-usines',
      tagline:
        "85 000 poules dans un hangar sans fenêtre, ce n'est pas une ferme. Signez pour interdire les nouveaux méga-élevages.",
      text: richText([
        "Nous demandons un moratoire immédiat sur la construction de tout nouvel élevage industriel de plus de 40 000 animaux, et la fin des aides publiques à l'agrandissement de ces installations.",
        "Parce qu'on peut nourrir le pays sans entasser le vivant.",
      ]),
      tiers: [
        { threshold: 10000, label: 'On démarre' },
        { threshold: 50000, label: 'On se fait entendre' },
        { threshold: 100000, label: 'Le ministère doit répondre' },
        { threshold: 250000, label: 'On change la loi' },
      ],
      additionalFields: [
        { label: 'Code postal', required: false },
        { label: 'Pourquoi vous signez (optionnel)', required: false },
      ],
    },
  )

  payload.logger.info(`petition: stop-elevages-usines (#${petition.id})`)

  const petitionAir = await upsert(
    payload,
    'petitions',
    {
      and: [{ slug: { equals: 'zones-ecoles' } }, { organization: { equals: orgIds['respire'] } }],
    },
    {
      organization: orgIds['respire'],
      slug: 'zones-ecoles',
      status: 'active',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-12-01T00:00:00.000Z',
      title: "De l'air pur autour des écoles",
      tagline:
        'Pas de voitures qui tournent au ralenti devant les classes. Signez pour des zones protégées.',
      text: richText([
        "Nous demandons des zones à trafic restreint autour de chaque école, aux heures d'entrée et de sortie.",
      ]),
      tiers: [
        { threshold: 1000, label: 'On démarre' },
        { threshold: 10000, label: 'On se fait entendre' },
        { threshold: 30000, label: 'On interpelle les maires' },
      ],
      additionalFields: [{ label: 'Code postal', required: false }],
    },
  )

  payload.logger.info(`petition: zones-ecoles (#${petitionAir.id})`)

  // `signature_count` only moves through `incrementSignatureCounter` (an
  // `afterChange` hook gated on `operation === 'create'`), so upserting these
  // by (citizen, petition) is safe to re-run — an update never double-counts.
  for (const [index, [, city]] of CITIZENS.entries()) {
    await upsert(
      payload,
      'petition-signatures',
      {
        and: [{ citizen: { equals: citizenIds[index] } }, { petition: { equals: petitionAir.id } }],
      },
      { citizen: citizenIds[index], petition: petitionAir.id, city },
    )
  }

  payload.logger.info(`petition signatures: ${CITIZENS.length} on zones-ecoles`)
  payload.logger.info('Seed complete.')
}

const payload = await getPayload({ config })
await seed(payload)
process.exit(0)
