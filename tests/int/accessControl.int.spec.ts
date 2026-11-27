import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Admin, Campaigner, Citizen } from '@/payload-types'

let payload: Payload
let citizen: Citizen & { collection: 'citizens' }
let admin: Admin & { collection: 'admins' }
let campaigner: Campaigner & { collection: 'campaigners' }

/** Unique per run so repeated runs never collide on emails or filenames. */
const run = Date.now()

/** A 1×1 transparent PNG — the smallest valid upload. */
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const pngFile = (name: string) => ({ data: png, mimetype: 'image/png', name, size: png.length })

describe('access control', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    citizen = {
      ...(await payload.create({
        collection: 'citizens',
        data: { email: `access-${run}-citizen@example.com`, pseudo: 'Probe' },
      })),
      collection: 'citizens',
    }
    admin = {
      ...(await payload.create({
        collection: 'admins',
        data: { email: `access-${run}-admin@example.com`, password: `pw-${run}` },
      })),
      collection: 'admins',
    }
    campaigner = {
      ...(await payload.create({
        collection: 'campaigners',
        data: { email: `access-${run}-campaigner@example.com`, name: 'Probe' },
      })),
      collection: 'campaigners',
    }
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'campaigners',
      where: { email: { contains: `access-${run}` } },
    })
    await payload.delete({
      collection: 'media',
      where: { filename: { contains: `access-${run}` } },
    })
    await payload.delete({ collection: 'admins', where: { email: { contains: `access-${run}` } } })
    await payload.delete({
      collection: 'citizens',
      where: { email: { contains: `access-${run}` } },
    })
  })

  // Payload writes its default rule into the config at boot, so check behaviour, not missing keys.
  it('no collection grants a citizen unrestricted writes', async () => {
    const req = { user: citizen, payload } as unknown as PayloadRequest
    const open: string[] = []
    for (const collection of payload.config.collections) {
      if (collection.slug.startsWith('payload-')) continue
      for (const op of ['create', 'update', 'delete'] as const) {
        if ((await collection.access[op]({ req })) === true) open.push(`${collection.slug}.${op}`)
      }
    }
    expect(open).toEqual([])
  })

  describe('admins', () => {
    it('a citizen cannot create an admin account', async () => {
      await expect(
        payload.create({
          collection: 'admins',
          data: { email: `access-${run}-evil@example.com`, password: 'pwned' },
          user: citizen,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed/i)
    })

    it('a citizen cannot list, update or delete admins', async () => {
      await expect(
        payload.find({ collection: 'admins', user: citizen, overrideAccess: false }),
      ).rejects.toThrow(/not allowed/i)
      await expect(
        payload.update({
          collection: 'admins',
          id: admin.id,
          data: { email: `access-${run}-hijacked@example.com` },
          user: citizen,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed/i)
      await expect(
        payload.delete({
          collection: 'admins',
          id: admin.id,
          user: citizen,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed/i)
    })

    it('an admin can still create an admin account', async () => {
      const created = await payload.create({
        collection: 'admins',
        data: { email: `access-${run}-second@example.com`, password: `pw-${run}` },
        user: admin,
        overrideAccess: false,
      })
      expect(created.email).toBe(`access-${run}-second@example.com`)
    })
  })

  describe('media', () => {
    it('a citizen cannot upload, edit or delete media; anyone can read it', async () => {
      const logo = await payload.create({
        collection: 'media',
        data: { alt: 'Org logo' },
        file: pngFile(`access-${run}-logo.png`),
        user: admin,
        overrideAccess: false,
      })

      await expect(
        payload.create({
          collection: 'media',
          data: { alt: 'x' },
          file: pngFile(`access-${run}-citizen.png`),
          user: citizen,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed/i)
      await expect(
        payload.update({
          collection: 'media',
          id: logo.id,
          data: { alt: 'defaced' },
          user: citizen,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed/i)
      await expect(
        payload.delete({ collection: 'media', id: logo.id, user: citizen, overrideAccess: false }),
      ).rejects.toThrow(/not allowed/i)

      const read = await payload.findByID({
        collection: 'media',
        id: logo.id,
        overrideAccess: false,
      })
      expect(read.alt).toBe('Org logo')
    })
  })

  describe('campaigners', () => {
    it('a citizen cannot read campaigners or their sessions', async () => {
      for (const collection of ['campaigners', 'campaigner-sessions'] as const) {
        await expect(
          payload.find({ collection, user: citizen, overrideAccess: false }),
        ).rejects.toThrow(/not allowed/i)
      }
    })

    it('an admin can read campaigners but not their sessions', async () => {
      const found = await payload.find({
        collection: 'campaigners',
        user: admin,
        overrideAccess: false,
      })
      expect(found.totalDocs).toBeGreaterThan(0)
      await expect(
        payload.find({ collection: 'campaigner-sessions', user: admin, overrideAccess: false }),
      ).rejects.toThrow(/not allowed/i)
    })

    it('a campaigner has no read access to protected collections', async () => {
      const user = campaigner as unknown as Citizen & { collection: 'citizens' }
      for (const collection of [
        'citizens',
        'admins',
        'petition-signatures',
        'interpellation-submissions',
        'magic-links',
        'campaigners',
        'campaigner-sessions',
      ] as const) {
        await expect(payload.find({ collection, user, overrideAccess: false })).rejects.toThrow(
          /not allowed/i,
        )
      }
    })
  })
})
