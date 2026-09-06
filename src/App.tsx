/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import LandingPage from './components/LandingPage';
import ClientPortal from './components/ClientPortal';

export default function App() {
  const [view, setView] = useState<'landing' | 'portal'>('landing');

  if (view === 'portal') {
    return <ClientPortal onLogout={() => setView('landing')} />;
  }

  return <LandingPage onEnterPortal={() => setView('portal')} />;
}
