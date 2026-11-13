/**
 * Where earshot's backend lives. Both values come from the .env file (see
 * .env.example), copied from your Supabase project (Project Settings → API).
 *
 * Both are public: they are built into the app, and the publishable key only
 * lets the app do what the database's rules allow. NEVER put a secret key
 * (sb_secret_…, or the old "service_role" key) or the database password in
 * .env: anything named EXPO_PUBLIC_ ships inside the app.
 *
 * Leave them empty and earshot falls back to accounts kept on the phone.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const cloudConfigured = () => SUPABASE_URL.trim().length > 0 && SUPABASE_PUBLISHABLE_KEY.trim().length > 0;

/** Accounts made on the backend have a UUID for an id; ones made on the phone start with "u_". */
export const isCloudId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
