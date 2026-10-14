import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isAdmin, publishedCampaignOrAdminViaCampaign } from '@/access'
import { submitInterpellation } from '@/endpoints/submitInterpellation'
import { channelTypeField, feedbackFieldsField } from '@/fields/channels'

/**
 * Deleting a target would silently destroy the record of every citizen who acted
 * on it, so it is blocked while submissions exist. Counted live rather than read
 * from `submissionCount`, which is a denormalised cache.
 */
const blockDeleteWithSubmissions: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { totalDocs } = await req.payload.count({
    collection: 'interpellation-submissions',
    where: { target: { equals: id } },
    req,
  })

  if (totalDocs > 0) {
    throw new APIError(
      `This target has ${totalDocs} recorded interpellation(s) and cannot be deleted. Archive the campaign instead.`,
      400,
    )
  }
}

/**
 * A person to contact, scoped to one campaign.
 *
 * Named `campaign-targets` rather than `targets` on purpose: when a shared
 * `targets` collection of reusable people is introduced, it is added alongside a
 * nullable `target` relationship here, and the identity fields below become the
 * campaign-level overrides (`row.lastName ?? row.target.lastName`). Existing rows
 * keep working with `target = null` — no rename, no backfill.
 *
 * Always read through `resolveTarget()` so that fallback lands in one place.
 */
export const CampaignTargets: CollectionConfig = {
  slug: 'campaign-targets',
  labels: { singular: 'Campaign target', plural: 'Campaign targets' },
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'role', 'district', 'campaign', 'submissionCount'],
    group: 'Mobilisations',
  },
  access: {
    read: publishedCampaignOrAdminViaCampaign,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: [submitInterpellation],
  hooks: {
    beforeDelete: [blockDeleteWithSubmissions],
  },
  fields: [
    {
      name: 'campaign',
      type: 'relationship',
      relationTo: 'interpellations',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      // Stored rather than virtual: Payload only accepts a virtual field as
      // `useAsTitle` when it proxies a relationship. Being a real column also
      // makes the admin list sortable and searchable on it.
      name: 'fullName',
      type: 'text',
      index: true,
      access: { update: () => false },
      admin: { readOnly: true, hidden: true },
      hooks: {
        beforeChange: [
          ({ siblingData }) =>
            [siblingData?.firstName, siblingData?.lastName].filter(Boolean).join(' '),
        ],
      },
    },
    {
      name: 'role',
      type: 'text',
      required: true,
      admin: { description: '« Sénatrice », « Député », « Ministre »…' },
    },
    {
      name: 'politicalGroup',
      type: 'text',
      index: true,
      admin: { description: 'Parliamentary group, e.g. « UC », « RE », « LR ».' },
    },
    {
      name: 'district',
      type: 'text',
      index: true,
      admin: { description: 'Département or constituency, e.g. « Loire-Atlantique ».' },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: { description: 'Extra filters beyond group and district.' },
    },
    {
      name: 'externalRef',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Stable public identifier (Assemblée / NosDéputés id). Lets the same person be de-duplicated across campaigns later.',
      },
    },
    {
      name: 'channels',
      type: 'array',
      minRows: 1,
      required: true,
      labels: { singular: 'Channel', plural: 'Channels' },
      fields: [
        channelTypeField(),
        {
          name: 'value',
          type: 'text',
          required: true,
          admin: { description: 'Email address, @handle or phone number.' },
        },
        {
          name: 'message',
          type: 'textarea',
          localized: true,
          admin: {
            description:
              'Override only. Leave empty to use the campaign default message for this channel type.',
          },
        },
        feedbackFieldsField,
      ],
    },
    {
      name: 'submissionCount',
      type: 'number',
      defaultValue: 0,
      // Indexed because the campaign page's default sort is
      // « moins sollicité·es d'abord »: sort: 'submissionCount'.
      index: true,
      access: { update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Maintained automatically.',
      },
    },
  ],
}
