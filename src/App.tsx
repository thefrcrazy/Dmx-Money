import React, { useState, useEffect } from 'react';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Scheduled from './pages/Scheduled';
import Analytics from './pages/Analytics';
import Accounts from './pages/Accounts';
import Predictions from './pages/Predictions';
import Settings from './pages/Settings';
import Budget from './pages/Budget';
import Categories from './pages/Categories';
import { BankProvider } from './context/BankContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { ToastProvider } from './context/ToastContext';
import { useUpdater } from './hooks/useUpdater';
import { LATEST_VERSION } from './constants/changelog';
import ReleaseNotesModal from './components/ui/ReleaseNotesModal';

const AppContent: React.FC = () => {
  const { activePage, setActivePage } = useNavigation();
  const { settings, updateLastSeenVersion } = useSettings();
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Initialize updater polling (silent check at startup + interval)
  useUpdater();

  // Check for new version at startup
  useEffect(() => {
    if (settings.lastSeenVersion !== undefined && settings.lastSeenVersion !== LATEST_VERSION) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowReleaseNotes(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [settings.lastSeenVersion]);

  const handleCloseReleaseNotes = async () => {
    setShowReleaseNotes(false);
    await updateLastSeenVersion(LATEST_VERSION);
  };

  return (
    <>
      <Layout activePage={activePage} setActivePage={setActivePage}>
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'accounts' && <Accounts />}
        {activePage === 'transactions' && <Transactions />}
        {activePage === 'scheduled' && <Scheduled />}
        {activePage === 'analytics' && <Analytics />}
        {activePage === 'predictions' && <Predictions />}
        {activePage === 'settings' && <Settings />}
        {activePage === 'budget' && <Budget />}
        {activePage === 'categories' && <Categories />}
      </Layout>

      <ReleaseNotesModal 
        isOpen={showReleaseNotes} 
        onClose={handleCloseReleaseNotes} 
      />
    </>
  );
};

function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <BankProvider>
          <NavigationProvider>
            <AppContent />
          </NavigationProvider>
        </BankProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
