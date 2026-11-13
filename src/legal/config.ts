/**
 * Where people can reach whoever runs earshot. Set EXPO_PUBLIC_SUPPORT_EMAIL in
 * .env (see .env.example). It is shown on the Help and Privacy pages, so use an
 * address you are happy to make public, not a personal one.
 */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();

/** What to print where an address belongs when none has been set yet. */
export const SUPPORT_EMAIL_SHOWN = SUPPORT_EMAIL || 'the support address (not set up in this build yet)';

export type LegalPage = { title: string; updated?: string; intro: string; sections: { heading: string; points: string[] }[] };

/** Put the support address into a page's text. */
export const withEmail = (text: string) => text.split('{email}').join(SUPPORT_EMAIL_SHOWN);
