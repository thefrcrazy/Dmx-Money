import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getCurrentWindow, PhysicalPosition, PhysicalSize, LogicalSize } from '@tauri-apps/api/window';
import { Settings, SettingsContextType } from '../types';
import { dbService } from '../services/db';
import { generatePalette, formatRgb } from '../utils/colors';
import { LATEST_VERSION } from '../constants/changelog';

const iconCache: Record<string, Uint8Array> = {};

const loadIcon = async (isDark: boolean): Promise<Uint8Array | null> => {
    const iconName = isDark ? 'icon-dark.png' : 'icon-light.png';
    if (iconCache[iconName]) return iconCache[iconName];
    try {
        const response = await fetch(`/icons/${iconName}`);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        iconCache[iconName] = uint8Array;
        return uint8Array;
    } catch (error) {
        console.error('Failed to load icon:', error);
        return null;
    }
};

const DEFAULT_SETTINGS: Settings = {
    theme: 'system',
    primaryColor: 'default',
    windowPosition: null,
    windowSize: null,
    componentSpacing: 6,
    componentPadding: 6,
    lastSeenVersion: LATEST_VERSION
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isLoadedRef = useRef(false);
    const isRestoringRef = useRef(false);
    const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

    const [isSystemDark] = useState(() => {
        try {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            return false;
        }
    });

    useEffect(() => {
        if (isSystemDark && !isLoadedRef.current) {
            document.documentElement.classList.add('dark');
        }
    }, [isSystemDark]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const updateWindowIcon = (isDark: boolean) => {
        loadIcon(isDark).then(icon => {
            if (icon) getCurrentWindow().setIcon(icon).catch(() => { });
        });
    };

    const setCssVariables = (color: string) => {
        const palette = generatePalette(color);
        if (palette) {
            document.documentElement.style.setProperty('--color-primary', color);
            document.documentElement.style.setProperty('--color-primary-custom', color);

            // For legacy Safari (Catalina), we NEED commas for rgba() to work in Tailwind 3
            // But Tailwind 4 (Modern) also accepts them.
            const rgbStr = formatRgb(palette[500]);
            const rgbWithCommas = rgbStr.replace(/ /g, ', ');

            document.documentElement.style.setProperty('--color-primary-rgb', rgbWithCommas);
            document.documentElement.style.setProperty('--color-primary-rgb-custom', rgbWithCommas);

            Object.entries(palette).forEach(([shade, rgb]) => {
                const shadeRgb = formatRgb(rgb).replace(/ /g, ', ');
                document.documentElement.style.setProperty(`--color-primary-${shade}-rgb`, shadeRgb);
            });
        }
    };

    const removeCssVariables = () => {
        const props = ['--color-primary', '--color-primary-custom', '--color-primary-rgb', '--color-primary-rgb-custom'];
        props.forEach(p => document.documentElement.style.removeProperty(p));
        [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(shade => {
            document.documentElement.style.removeProperty(`--color-primary-${shade}-rgb`);
        });
    };

    const applyVisualSettings = (s: Settings) => {
        let isDark = false;
        if (s.theme === 'dark') {
            document.documentElement.classList.add('dark');
            isDark = true;
        } else if (s.theme === 'light') {
            document.documentElement.classList.remove('dark');
            isDark = false;
        } else {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', isDark);
        }

        if (s.primaryColor && s.primaryColor !== 'default') {
            setCssVariables(s.primaryColor);
        } else {
            removeCssVariables();
        }
        updateWindowIcon(isDark);
    };

    const restoreWindow = async (currentSettings: Settings) => {
        if (isRestoringRef.current) return;
        isRestoringRef.current = true;
        try {
            const appWindow = getCurrentWindow();
            await appWindow.setResizable(true);
            await appWindow.setDecorations(true);
            await appWindow.setShadow(true);

            if (currentSettings.windowSize && currentSettings.windowSize.width > 500) {
                await appWindow.setSize(new PhysicalSize(currentSettings.windowSize.width, currentSettings.windowSize.height));
            } else {
                await appWindow.setSize(new LogicalSize(1320, 790));
            }

            if (currentSettings.windowPosition) {
                await appWindow.setPosition(new PhysicalPosition(currentSettings.windowPosition.x, currentSettings.windowPosition.y));
            } else {
                await appWindow.center();
            }
        } catch (error) {
            console.error('Failed to restore window:', error);
        } finally {
            setTimeout(() => {
                isRestoringRef.current = false;
            }, 1000);
        }
    };

    useEffect(() => {
        dbService.getSettings()
            .then(savedSettings => {
                const initial = savedSettings || DEFAULT_SETTINGS;
                applyVisualSettings(initial);
                setSettings(initial);
                isLoadedRef.current = true;

                setTimeout(() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setIsInitialLoadDone(true);
                    }, 500);
                }, 1500);
            })
            .catch(() => {
                setIsInitialLoadDone(true);
            });
    }, []);

    useEffect(() => {
        if (isInitialLoadDone && isLoadedRef.current) {
            setTimeout(() => {
                restoreWindow(settingsRef.current);
            }, 500);
        }
    }, [isInitialLoadDone]);

    useEffect(() => {
        let unlistenMove: (() => void) | undefined;
        let unlistenResize: (() => void) | undefined;
        const setupListeners = async () => {
            const appWindow = getCurrentWindow();
            unlistenMove = await appWindow.listen('tauri://move', async () => {
                if (isRestoringRef.current) return;
                const pos = await appWindow.innerPosition();
                debouncedSaveWindowPosition(pos.x, pos.y);
            });
            unlistenResize = await appWindow.listen('tauri://resize', async () => {
                if (isRestoringRef.current) return;
                const size = await appWindow.innerSize();
                if (size.width > 500 && size.height > 500) {
                    debouncedSaveWindowSize(size.width, size.height);
                }
            });
        };
        setupListeners();
        return () => {
            if (unlistenMove) unlistenMove();
            if (unlistenResize) unlistenResize();
        };
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            if (settingsRef.current.theme === 'system') {
                document.documentElement.classList.toggle('dark', e.matches);
                updateWindowIcon(e.matches);
            }
        };
        try {
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        } catch (e) {
            mq.addListener(handler);
            return () => mq.removeListener(handler);
        }
    }, []);

    const savePositionTimeoutRef = useRef<any>(null);
    const saveSizeTimeoutRef = useRef<any>(null);

    const debouncedSaveWindowPosition = (x: number, y: number) => {
        if (savePositionTimeoutRef.current) clearTimeout(savePositionTimeoutRef.current);
        savePositionTimeoutRef.current = setTimeout(() => {
            setSettings(prev => {
                const updated = { ...prev, windowPosition: { x, y } };
                dbService.saveSettings(updated).catch(() => { });
                return updated;
            });
        }, 1000);
    };

    const debouncedSaveWindowSize = (width: number, height: number) => {
        if (saveSizeTimeoutRef.current) clearTimeout(saveSizeTimeoutRef.current);
        saveSizeTimeoutRef.current = setTimeout(() => {
            setSettings(prev => {
                const updated = { ...prev, windowSize: { width, height } };
                dbService.saveSettings(updated).catch(() => { });
                return updated;
            });
        }, 1000);
    };

    return (
        <SettingsContext.Provider value={{
            settings,
            updateTheme: async (theme) => {
                setSettings(prev => {
                    const next = { ...prev, theme };
                    applyVisualSettings(next);
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updatePrimaryColor: async (color) => {
                setSettings(prev => {
                    const next = { ...prev, primaryColor: color };
                    applyVisualSettings(next);
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateWindowPosition: async (x, y) => {
                setSettings(prev => {
                    const next = { ...prev, windowPosition: { x, y } };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateWindowSize: async (width, height) => {
                setSettings(prev => {
                    const next = { ...prev, windowSize: { width, height } };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateAccountGroup: async (id, group) => {
                setSettings(prev => {
                    const groups = { ...(prev.accountGroups || {}) };
                    if (group) groups[id] = group; else delete groups[id];
                    const next = { ...prev, accountGroups: groups };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateCustomGroups: async (groups) => {
                setSettings(prev => {
                    const next = { ...prev, customGroups: groups };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            renameCustomGroup: async (oldName, newName) => {
                setSettings(prev => {
                    const customGroups = (prev.customGroups || []).map(g => g === oldName ? newName : g);
                    const accountGroups = { ...(prev.accountGroups || {}) };
                    Object.keys(accountGroups).forEach(id => { if (accountGroups[id] === oldName) accountGroups[id] = newName; });
                    const next = { ...prev, customGroups, accountGroups };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateCustomGroupsOrder: async (order) => {
                setSettings(prev => {
                    const next = { ...prev, customGroupsOrder: order };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateAccountsOrder: async (order) => {
                setSettings(prev => {
                    const next = { ...prev, accountsOrder: order };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateComponentSpacing: async (spacing) => {
                setSettings(prev => {
                    const next = { ...prev, componentSpacing: spacing };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateComponentPadding: async (padding) => {
                setSettings(prev => {
                    const next = { ...prev, componentPadding: padding };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            },
            updateLastSeenVersion: async (version) => {
                setSettings(prev => {
                    const next = { ...prev, lastSeenVersion: version };
                    dbService.saveSettings(next).catch(() => { });
                    return next;
                });
            }
        }}>
            <div className={`transition-opacity duration-700 ${!isInitialLoadDone ? 'opacity-0' : 'opacity-100'}`}>
                {children}
            </div>
            {!isInitialLoadDone && (
                <div className={`fixed inset-0 w-full h-full flex flex-col items-center justify-center z-[9999] transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-110 blur-sm' : 'opacity-100'} ${isSystemDark ? 'bg-black' : 'bg-white'} dark:bg-black`}>
                    <div className="flex flex-col items-center justify-center space-y-12">
                        <img src="/logo.webp" alt="Logo" className={`w-32 h-32 transition-transform duration-700 ${isTransitioning ? 'rotate-12 scale-110' : ''}`} />
                        <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                </div>
            )}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};