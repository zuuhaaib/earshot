/**
 * The two cryptographic things the local store needs for passwords. The app
 * uses expo-crypto (expoSecurity.ts); the tests use Node's crypto.
 */
export interface Security {
  /** A one-way hash of the text, as a hex string. */
  digest(text: string): Promise<string>;
  /** A fresh random salt. */
  salt(): string;
}

const missing = (): never => {
  throw new Error('No password hashing has been set up for this store.');
};

export const noSecurity: Security = { digest: async () => missing(), salt: () => missing() };
