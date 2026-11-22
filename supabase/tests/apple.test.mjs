// The signed note the apple function hands Apple has to be a valid ES256 JWT.
//
//   npm run test:server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientSecret } from '../functions/apple/index.ts';

const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

test('the client secret is an ES256 JWT that Apple can check with the key', async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;

  const jwt = await clientSecret('TEAM123456', 'KEY1234567', pem, 1_000_000);
  const [head, body, sig] = jwt.split('.');

  assert.deepEqual(JSON.parse(fromB64url(head)), { alg: 'ES256', kid: 'KEY1234567' });
  assert.deepEqual(JSON.parse(fromB64url(body)), {
    iss: 'TEAM123456',
    iat: 1_000_000,
    exp: 1_000_300,
    aud: 'https://appleid.apple.com',
    sub: 'lol.earshot.app',
  });
  assert.equal(fromB64url(sig).length, 64, 'raw r||s, not DER');
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, fromB64url(sig), new TextEncoder().encode(`${head}.${body}`));
  assert.ok(ok);
});
