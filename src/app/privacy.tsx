/** The privacy page. Readable without an account, so it can be read before signing up. */
import React from 'react';
import type { LegalPage } from '@/legal/config';
import privacy from '@/legal/privacy.json';
import { LegalPageView } from '@/ui/LegalPage';

export default function Privacy() {
  return <LegalPageView page={privacy as LegalPage} other={{ label: 'help and contact', href: '/support' }} />;
}
