/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ValocoreProvider, useValocore } from './context/ValocoreContext';
import { AppShell } from './components/AppShell';
import { QuickMatchModal } from './components/QuickMatchModal';
import { CommandCenterView } from './features/dashboard/CommandCenterView';
import { ValoSenseViews } from './features/analytics/ValoSenseViews';
import { ClutchIQViews } from './features/coach/ClutchIQViews';
import { StrataViews } from './features/strategy/StrataViews';
import { TrainingViews } from './features/training/TrainingViews';
import { SystemViews } from './features/system/SystemViews';

const MainWorkspace: React.FC = () => {
  const { activePage } = useValocore();
  const [quickMatchOpen, setQuickMatchOpen] = useState(false);

  const renderContent = () => {
    switch (activePage) {
      case 'command-center':
        return <CommandCenterView />;
      case 'match-history':
      case 'performance-analytics':
      case 'agent-statistics':
      case 'map-statistics':
        return (
          <ValoSenseViews
            subView={activePage}
            onOpenQuickMatch={() => setQuickMatchOpen(true)}
          />
        );
      case 'ai-coach':
      case 'round-analysis':
      case 'mistake-tracker':
        return <ClutchIQViews subView={activePage} />;
      case 'strategy-planner':
      case 'map-library':
      case 'agent-lineups':
        return <StrataViews subView={activePage} />;
      case 'aim-trainer':
      case 'reaction-tests':
      case 'training-history':
        return <TrainingViews subView={activePage} />;
      case 'data-import':
      case 'settings':
        return (
          <SystemViews
            subView={activePage}
            onOpenQuickMatch={() => setQuickMatchOpen(true)}
          />
        );
      default:
        return <CommandCenterView />;
    }
  };

  return (
    <>
      <AppShell onOpenQuickMatchModal={() => setQuickMatchOpen(true)}>
        {renderContent()}
      </AppShell>
      <QuickMatchModal
        isOpen={quickMatchOpen}
        onClose={() => setQuickMatchOpen(false)}
      />
    </>
  );
};

export default function App() {
  return (
    <ValocoreProvider>
      <MainWorkspace />
    </ValocoreProvider>
  );
}
