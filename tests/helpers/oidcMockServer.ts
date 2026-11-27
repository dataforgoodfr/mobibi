import { startOidcMock } from './oidcMock'

const mock = await startOidcMock(4011)

mock.setUser({
  sub: 'e2e-campaigner',
  email: 'e2e-campaigner@example.com',
  email_verified: true,
  name: 'Camille Martin',
  roles: ['access'],
  sid: 'e2e-sid',
})

console.log(`OIDC mock listening on ${mock.issuer}`)
