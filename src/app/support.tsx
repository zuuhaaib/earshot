/** Help and how to reach a person. Readable without an account. */
import React from 'react';
import type { LegalPage } from '@/legal/config';
import support from '@/legal/support.json';
import { LegalPageView } from '@/ui/LegalPage';

export default function Support() {
  return <LegalPageView page={support as LegalPage} other={{ label: 'privacy', href: '/privacy' }} />;
}
