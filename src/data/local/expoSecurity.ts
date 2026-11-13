import * as Crypto from 'expo-crypto';
import type { Security } from './security';

export const expoSecurity: Security = {
  digest: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  salt: () => Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join(''),
};
