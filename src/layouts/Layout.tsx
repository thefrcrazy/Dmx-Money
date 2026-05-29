import React, { useState } from 'react';
import { Wallet, LayoutDashboard, PieChart, TrendingUp, Settings, Receipt, CalendarClock, Tag, Calculator, ChevronLeft, ChevronRight, MoreHorizontal, X, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useBank } from '../context/BankContext';
import { useUpdater } from '../hooks/useUpdater';
import MultiSelect from '../components/ui/MultiSelect';
import TitleBar from '../components/ui/TitleBar';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { formatCurrency } from '../utils/format';
import { hasTauriRuntime, isMobileCompanion } from '../utils/runtime';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage }) => {
  const { accounts, filterAccount, setFilterAccount, mobileConnectionState } = useBank();
  const { currentBalance, checkedBalance } = useFinancialMetrics();
  const { updateAvailable } = useUpdater();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number } | null>(null);
  const mainRef = React.useRef<HTMLElement>(null);
  const pullStartXRef = React.useRef(0);
  const pullStartYRef = React.useRef(0);
  const pullDistanceRef = React.useRef(0);
  const isPullingRef = React.useRef(false);
  const pullGestureModeRef = React.useRef<'pending' | 'pull' | 'ignore'>('ignore');
  const isMobileMode = isMobileCompanion();
  const showTitleBar = hasTauriRuntime();
  const pullThreshold = 78;

  React.useEffect(() => {
    if (!hasTauriRuntime()) return;
    import('@tauri-apps/api/app').then(app => {
      app.getVersion().then(setAppVersion).catch(() => { });
    });
  }, []);

  const navGroups = [
    {
      title: "Général",
      items: [
        { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'accounts', label: 'Mes Comptes', icon: Wallet },
        { id: 'transactions', label: 'Journal', icon: Receipt },
      ]
    },
    {
      title: "Finances",
      items: [
        { id: 'budget', label: 'Budget', icon: Calculator },
        { id: 'scheduled', label: 'Échéancier', icon: CalendarClock },
      ]
    },
    {
      title: "Analyses",
      items: [
        { id: 'analytics', label: 'Analyses', icon: PieChart },
        { id: 'predictions', label: 'Prédictions', icon: TrendingUp },
      ]
    }
  ];

  const desktopFooterItems = [
    { id: 'categories', label: 'Catégories', icon: Tag },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const mobilePrimaryItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'accounts', label: 'Comptes', icon: Wallet },
    { id: 'transactions', label: 'Journal', icon: Receipt },
    { id: 'budget', label: 'Budget', icon: Calculator },
  ];

  const mobileMoreItems = [
    { id: 'scheduled', label: 'Échéancier', icon: CalendarClock },
    { id: 'analytics', label: 'Analyses', icon: PieChart },
    { id: 'predictions', label: 'Prédictions', icon: TrendingUp },
    ...desktopFooterItems,
  ];

  const isMoreActive = mobileMoreItems.some(item => item.id === activePage);
  const pageTitle = [
    ...navGroups.flatMap(group => group.items),
    ...desktopFooterItems,
  ].find(item => item.id === activePage)?.label || 'DmxMoney';
  const mobileSyncLabel = mobileConnectionState === 'offline' ? 'Offline' : 'Sync';
  const MobileSyncIcon = mobileConnectionState === 'offline' ? WifiOff : Wifi;

  const navigateToPage = (page: string) => {
    setActivePage(page);
    setIsMobileMenuOpen(false);
  };

  const setPullDistanceValue = (value: number) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (isRefreshing || isMobileMenuOpen) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-no-pull-refresh="true"]')) return;
    if ((mainRef.current?.scrollTop || 0) > 0) return;

    pullStartXRef.current = event.touches[0]?.clientX || 0;
    pullStartYRef.current = event.touches[0]?.clientY || 0;
    isPullingRef.current = true;
    pullGestureModeRef.current = 'pending';
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (!isPullingRef.current || isRefreshing) return;
    if ((mainRef.current?.scrollTop || 0) > 0) {
      isPullingRef.current = false;
      pullGestureModeRef.current = 'ignore';
      setIsPulling(false);
      setPullDistanceValue(0);
      return;
    }

    const currentX = event.touches[0]?.clientX || 0;
    const currentY = event.touches[0]?.clientY || 0;
    const deltaX = currentX - pullStartXRef.current;
    const delta = currentY - pullStartYRef.current;

    if (pullGestureModeRef.current === 'pending') {
      if (Math.abs(deltaX) > Math.abs(delta) || Math.abs(deltaX) > 10) {
        pullGestureModeRef.current = 'ignore';
        isPullingRef.current = false;
        setPullDistanceValue(0);
        return;
      }
      if (delta > 8) {
        pullGestureModeRef.current = 'pull';
        setIsPulling(true);
      }
    }

    if (pullGestureModeRef.current !== 'pull') return;

    if (delta <= 0) {
      setPullDistanceValue(0);
      return;
    }

    const nextDistance = Math.min(112, Math.pow(delta, 0.86) * 1.45);
    setPullDistanceValue(nextDistance);

    if (nextDistance > 6 && event.cancelable) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    pullGestureModeRef.current = 'ignore';
    setIsPulling(false);

    if (pullDistanceRef.current < pullThreshold) {
      setPullDistanceValue(0);
      return;
    }

    setIsRefreshing(true);
    setPullDistanceValue(pullThreshold);
    window.setTimeout(() => {
      window.location.reload();
    }, 120);
  };

  const showSidebarTooltip = (label: string, element: HTMLElement) => {
    if (!isCollapsed || isMobileMode) return;

    const rect = element.getBoundingClientRect();
    setSidebarTooltip({
      label,
      top: rect.top + rect.height / 2
    });
  };

  const hideSidebarTooltip = () => setSidebarTooltip(null);

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col md:flex-row text-gray-900 dark:text-gray-100 font-sans overflow-hidden bg-[var(--color-bg-primary)] dark:bg-[var(--color-bg-primary)]">
      {showTitleBar && <TitleBar />}

      {/* Sidebar */}
      <aside className={`hidden md:flex flex-shrink-0 flex-col bg-[var(--color-bg-secondary)] dark:bg-[var(--color-bg-secondary)] border-r border-black/[0.05] dark:border-white/10 z-40 transition-all duration-300 ${isCollapsed ? 'w-[82px]' : 'w-56'}`}>
        <div className={`h-16 w-full flex-shrink-0 flex ${isCollapsed ? 'relative' : 'items-center justify-end px-4'}`} data-tauri-drag-region>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-900 text-gray-400 transition-colors ${isCollapsed ? 'absolute left-[82px] top-[32px] z-50 -translate-y-1/2' : ''}`}
            aria-label={isCollapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-hide">
          {navGroups.map((group, idx) => (
            <div key={idx} className={idx > 0 ? "mt-6" : ""}>
              <h3
                onMouseEnter={(event) => showSidebarTooltip(group.title, event.currentTarget)}
                onMouseLeave={hideSidebarTooltip}
                className={`px-4 text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2 truncate animate-in fade-in duration-300 ${isCollapsed ? 'px-1 text-center tracking-normal cursor-default' : ''}`}
              >
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      onMouseEnter={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                      onMouseLeave={hideSidebarTooltip}
                      onFocus={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                      onBlur={hideSidebarTooltip}
                      aria-label={item.label}
                      className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${isActive
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-900'
                        } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-black/[0.05] dark:border-white/10 overflow-x-hidden">
          <div className="space-y-0.5">
            {desktopFooterItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  onMouseEnter={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                  onMouseLeave={hideSidebarTooltip}
                  onFocus={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                  onBlur={hideSidebarTooltip}
                  aria-label={item.label}
                  className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer relative ${isActive ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-900'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.id === 'settings' && updateAvailable && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black animate-pulse" />
                    )}
                  </div>
                  {!isCollapsed && <div className="min-w-0 flex-1 flex justify-between items-center">
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.id === 'settings' && updateAvailable && (
                      <span className="w-2 h-2 bg-red-500 rounded-full" title="Mise à jour disponible" />
                    )}
                  </div>}
                </button>
              );
            })}
          </div>
          {!isCollapsed && (
            <div className="mt-4 text-[9px] text-gray-400 text-center font-bold uppercase tracking-widest opacity-60 animate-in fade-in duration-500">
              DmxMoney{appVersion ? ` • v${appVersion}` : ''}
            </div>
          )}
        </div>
      </aside>

      {isCollapsed && sidebarTooltip && (
        <div
          className="fixed left-[94px] z-[80] -translate-y-1/2 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 shadow-lg pointer-events-none whitespace-nowrap"
          style={{ top: sidebarTooltip.top }}
        >
          {sidebarTooltip.label}
        </div>
      )}

      {/* Main Area */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--color-bg-tertiary)] dark:bg-[var(--color-bg-tertiary)] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          isPullingRef.current = false;
          pullGestureModeRef.current = 'ignore';
          setIsPulling(false);
          setPullDistanceValue(0);
        }}
      >
        <header className="hidden min-h-16 flex-shrink-0 md:flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-3 md:py-0 bg-[var(--color-bg-tertiary)] dark:bg-[var(--color-bg-tertiary)] z-30 border-b border-black/[0.05] dark:border-white/10" data-tauri-drag-region>
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-xs font-medium text-gray-500 hidden sm:inline">Compte :</span>
            <MultiSelect
              value={filterAccount}
              onChange={setFilterAccount}
              options={accounts.map(acc => ({ id: acc.id, label: acc.name, icon: acc.icon, color: acc.color }))}
              placeholder="Tous les comptes"
              className="w-full sm:w-64"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-10">
            <div className="text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Pointé</div>
              <div className="text-sm sm:text-lg font-bold text-emerald-600">
                {formatCurrency(checkedBalance)}
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-neutral-700 opacity-50 hidden xs:block"></div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Actuel</div>
              <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(currentBalance)}
              </div>
            </div>
          </div>
        </header>

        <header className="md:hidden flex-shrink-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/10 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3 z-40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-neutral-500">DmxMoney</p>
              <h1 className="text-[24px] leading-tight font-bold tracking-tight text-gray-950 dark:text-white truncate">{pageTitle}</h1>
            </div>
            {isMobileMode && (
              <div className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mobileConnectionState === 'offline'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}>
                <MobileSyncIcon className="h-3.5 w-3.5" />
                {mobileSyncLabel}
              </div>
            )}
          </div>

          <div className="mt-3">
            <MultiSelect
              value={filterAccount}
              onChange={setFilterAccount}
              options={accounts.map(acc => ({ id: acc.id, label: acc.name, icon: acc.icon, color: acc.color }))}
              placeholder="Tous les comptes"
              className="w-full"
              size="lg"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-black/[0.05] dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-neutral-500">Pointé</div>
              <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {formatCurrency(checkedBalance)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.05] dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-neutral-500">Actuel</div>
              <div className="mt-1 text-lg font-bold text-gray-950 dark:text-white truncate">
                {formatCurrency(currentBalance)}
              </div>
            </div>
          </div>
        </header>

        <main
          ref={mainRef}
          className="relative flex-1 overflow-y-auto overscroll-y-contain scrollbar-thin px-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-8 md:py-4 md:pb-4"
        >
          <div
            className="pointer-events-none sticky top-2 z-30 flex h-0 justify-center md:hidden"
            style={{
              opacity: isRefreshing || pullDistance > 8 ? 1 : 0,
              transform: `translateY(${Math.min(8, pullDistance * 0.08)}px)`,
            }}
          >
            <div className="flex h-9 items-center gap-2 rounded-full border border-black/[0.06] dark:border-white/10 bg-white/95 dark:bg-neutral-950/95 px-3 text-[12px] font-semibold text-gray-500 dark:text-neutral-300 shadow-lg backdrop-blur">
              <RefreshCw
                className={`h-4 w-4 text-primary-500 ${isRefreshing ? 'animate-spin' : ''}`}
                style={!isRefreshing ? { transform: `rotate(${Math.min(180, (pullDistance / pullThreshold) * 180)}deg)` } : undefined}
              />
              {isRefreshing ? 'Actualisation' : pullDistance >= pullThreshold ? 'Relâcher' : 'Tirer'}
            </div>
          </div>

          <div
            className="w-full md:max-w-7xl md:mx-auto"
            style={{
              transform: `translateY(${isRefreshing ? 28 : Math.min(34, pullDistance * 0.38)}px)`,
              transition: isPulling ? 'none' : 'transform 200ms ease-out',
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {isMobileMenuOpen && (
        <>
          <button
            className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom)+10px)] z-[65] md:hidden">
            <div className="rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.05] dark:border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-neutral-500">Navigation</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
                  aria-label="Fermer le menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateToPage(item.id)}
                      className={`min-h-13 w-full rounded-xl px-3.5 py-3 flex items-center gap-3 text-left transition-colors ${isActive
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900'
                        }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="relative">
                        <Icon className="w-5 h-5 shrink-0" />
                        {item.id === 'settings' && updateAvailable && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black" />
                        )}
                      </div>
                      <span className="min-w-0 truncate text-sm font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <nav className="md:hidden flex-shrink-0 h-[calc(76px+env(safe-area-inset-bottom))] border-t border-black/[0.08] dark:border-white/10 bg-white/98 dark:bg-neutral-950/98 backdrop-blur-xl px-2 pt-2 pb-[env(safe-area-inset-bottom)] z-[60] shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="grid h-full grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateToPage(item.id)}
                className={`relative min-w-0 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${isActive
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                  : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="w-full px-1 truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            className={`relative min-w-0 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${isMoreActive || isMobileMenuOpen
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
              : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900'
              }`}
            aria-expanded={isMobileMenuOpen}
            aria-current={isMoreActive ? 'page' : undefined}
          >
            <div className="relative">
              <MoreHorizontal className="w-5 h-5 shrink-0" />
              {updateAvailable && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black" />
              )}
            </div>
            <span className="w-full px-1 truncate">Plus</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
