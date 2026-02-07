import React from 'react';
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
import { SettingsProvider } from './context/SettingsContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { ToastProvider } from './context/ToastContext';

const AppContent: React.FC = () => {
  const { activePage, setActivePage } = useNavigation();

  return (
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
