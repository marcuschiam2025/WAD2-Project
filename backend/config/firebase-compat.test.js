import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('Firebase Auth loads when the runtime does not allow requiring ES modules', () => {
  const result = spawnSync(process.execPath, [
    '--no-experimental-require-module', '--input-type=module',
    '-e', `
      await import('firebase-admin/auth')
      const { createRequire } = await import('node:module')
      const { generateKeyPairSync, createPublicKey } = await import('node:crypto')
      const require = createRequire(import.meta.url)
      const firebaseRequire = createRequire(require.resolve('firebase-admin/auth'))
      const { JwksClient, passportJwtSecret } = firebaseRequire('jwks-rsa')
      const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }
      const client = new JwksClient({ jwksUri: 'https://unused.example', fetcher: async () => ({ keys: [jwk] }) })
      const key = await client.getSigningKey('test-key')
      const expected = publicKey.export({ format: 'der', type: 'spki' })
      if (!createPublicKey(key.getPublicKey()).export({ format: 'der', type: 'spki' }).equals(expected)) throw new Error('Signing key changed')
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = encode({ alg: 'RS256', kid: 'test-key' }) + '.' + encode({ sub: 'test' }) + '.unused'
      const secret = passportJwtSecret({ jwksUri: 'https://unused.example', fetcher: async () => ({ keys: [jwk] }) })
      const passportKey = await new Promise((resolve, reject) => secret(null, token, (error, value) => error ? reject(error) : resolve(value)))
      if (passportKey !== key.getPublicKey()) throw new Error('Passport signing key changed')
    `,
  ], { cwd: new URL('../', import.meta.url), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
