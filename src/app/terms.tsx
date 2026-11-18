/** The terms of use. Readable without an account, since you agree to them while making one. */
import React from 'react';
import type { LegalPage } from '@/legal/config';
import terms from '@/legal/terms.json';
import { LegalPageView } from '@/ui/LegalPage';

export default function Terms() {
  return <LegalPageView page={terms as LegalPage} other={{ label: 'privacy', href: '/privacy' }} />;
}
