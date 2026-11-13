/** Password hashing for tests, using Node's crypto. */
import { createHash, randomBytes } from 'node:crypto';
import type { Security } from '../../local/security';

export const nodeSecurity: Security = {
  digest: async (text) => createHash('sha256').update(text).digest('hex'),
  salt: () => randomBytes(16).toString('hex'),
};
