import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getCurrentWindow, PhysicalPosition, PhysicalSize, LogicalSize } from '@tauri-apps/api/window';
import { Theme, Settings, SettingsContextType } from '../types';
import { dbService } from '../services/db';
import { generatePalette, formatRgb, hexToRgb as parseHexToRgb } from '../utils/colors';
import { LATEST_VERSION } from '../constants/changelog';

// Cache for window icons to prevent redundant fetches
const iconCache: Record<string, Uint8Array> = {};

const loadIcon = async (isDark: boolean): Promise<Uint8Array | null> => {
    const iconName = isDark ? 'icon-dark.png' : 'icon-light.png';
    
    if (iconCache[iconName]) {
        return iconCache[iconName];
    }

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

                // Initial load

                useEffect(() => {

                    // Load settings from DB

                    dbService.getSettings()

                        .then(savedSettings => {

                            if (savedSettings) {

                                // Apply visual changes immediately

                                applyVisualSettings(savedSettings);

                                // Then update state

                                setSettings(prev => ({

                                    ...prev,

                                    ...savedSettings

                                }));

                            } else {

                                // First launch: save default settings

                                dbService.saveSettings(DEFAULT_SETTINGS).catch(console.error);

                            }

                            isLoadedRef.current = true;

                            

                            // Start animation after a short delay

                            setTimeout(() => {

                                setIsTransitioning(true);

                                

                                // Wait for the fade-out animation to complete (500ms)

                                setTimeout(() => {

                                    setIsInitialLoadDone(true);

                                }, 500);

                            }, 800); // Duration splash screen is visible

                        })

                        .catch(() => {

                            setIsInitialLoadDone(true);

                        });

    

            let unlistenMove: (() => void) | undefined;
        let unlistenResize: (() => void) | undefined;

        const setupWindowListeners = async () => {
            try {
                const appWindow = getCurrentWindow();
                unlistenMove = await appWindow.listen('tauri://move', async () => {
                    const position = await appWindow.innerPosition();
                    debouncedSaveWindowPosition(position.x, position.y);
                });
                unlistenResize = await appWindow.listen('tauri://resize', async () => {
                    const size = await appWindow.innerSize();
                    debouncedSaveWindowSize(size.width, size.height);
                });
            } catch (error) {}
        };

        setupWindowListeners();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e: MediaQueryListEvent) => {
            if (settings.theme === 'system') {
                document.documentElement.classList.toggle('dark', e.matches);
                updateWindowIcon(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleThemeChange);
        return () => {
            if (unlistenMove) unlistenMove();
            if (unlistenResize) unlistenResize();
            mediaQuery.removeEventListener('change', handleThemeChange);
        };
    }, []); // Empty dependency array for init, theme listener manages itself or checks current state

    // ... refs for debounce ...
    const savePositionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveSizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const updateWindowPositionRef = useRef((_x: number, _y: number) => { });
    const updateWindowSizeRef = useRef((_width: number, _height: number) => { });

    useEffect(() => {
        updateWindowPositionRef.current = updateWindowPosition;
        updateWindowSizeRef.current = updateWindowSize;
    });

    const debouncedSaveWindowPosition = (x: number, y: number) => {
        if (savePositionTimeoutRef.current) clearTimeout(savePositionTimeoutRef.current);
        savePositionTimeoutRef.current = setTimeout(() => {
            updateWindowPositionRef.current(x, y);
        }, 1000);
    };

    const debouncedSaveWindowSize = (width: number, height: number) => {
        if (saveSizeTimeoutRef.current) clearTimeout(saveSizeTimeoutRef.current);
        saveSizeTimeoutRef.current = setTimeout(() => {
            updateWindowSizeRef.current(width, height);
        }, 1000);
    };

    // Helper to update window icon non-blockingly
    const updateWindowIcon = (isDark: boolean) => {
        loadIcon(isDark).then(icon => {
            if (icon) {
                getCurrentWindow().setIcon(icon).catch(() => {});
            }
        });
    };

    const applyVisualSettings = (newSettings: Settings) => {
        const appWindow = getCurrentWindow();
        
        // 0. Re-enable resizing and decorations (was disabled for splash screen)
        appWindow.setResizable(true).catch(() => {});
        appWindow.setDecorations(true).catch(() => {});
        appWindow.setShadow(true).catch(() => {});

        // 1. Theme
        let isDark = false;
        if (newSettings.theme === 'dark') {
            document.documentElement.classList.add('dark');
            isDark = true;
        } else if (newSettings.theme === 'light') {
            document.documentElement.classList.remove('dark');
            isDark = false;
        } else {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', isDark);
        }

        // 2. Colors
        if (newSettings.primaryColor && newSettings.primaryColor !== 'default') {
            setCssVariables(newSettings.primaryColor);
        } else {
            removeCssVariables();
        }

        // 3. Window Icon (Async, non-blocking)
        updateWindowIcon(isDark);

        // 4. Window Size/Pos (Async, non-blocking)
        // Transition from 500x500 splash to app size
        setTimeout(() => {
            if (newSettings.windowSize) {
                appWindow.setSize(new PhysicalSize(newSettings.windowSize.width, newSettings.windowSize.height)).catch(() => {});
            } else {
                // Default size if no settings saved
                appWindow.setSize(new LogicalSize(1320, 790)).catch(() => {});
                appWindow.center().catch(() => {});
            }

            if (newSettings.windowPosition) {
                appWindow.setPosition(new PhysicalPosition(newSettings.windowPosition.x, newSettings.windowPosition.y)).catch(() => {});
            }
        }, 50);
    };

    const setCssVariables = (color: string) => {
        const palette = generatePalette(color);
        if (palette) {
            document.documentElement.style.setProperty('--color-primary', color);
            document.documentElement.style.setProperty('--color-primary-custom', color);
            
            const baseRgbStr = formatRgb(palette[500]);
            const baseRgbComma = baseRgbStr.replace(/ /g, ', ');
            
            document.documentElement.style.setProperty('--color-primary-rgb', baseRgbStr);
            document.documentElement.style.setProperty('--color-primary-rgb-custom', baseRgbComma);

            Object.entries(palette).forEach(([shade, rgb]) => {
                const rgbStr = formatRgb(rgb);
                document.documentElement.style.setProperty(`--color-primary-${shade}-rgb`, rgbStr);
            });
        }
    };

    const removeCssVariables = () => {
        document.documentElement.style.removeProperty('--color-primary');
        document.documentElement.style.removeProperty('--color-primary-custom');
        document.documentElement.style.removeProperty('--color-primary-rgb');
        document.documentElement.style.removeProperty('--color-primary-rgb-custom');
        
        [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(shade => {
            document.documentElement.style.removeProperty(`--color-primary-${shade}-rgb`);
        });
    };

    // Optimized update functions
    const updateTheme = (theme: Theme) => {
        const performUpdate = () => {
            // 1. Immediate visual update
            let isDark = false;
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                isDark = true;
            } else if (theme === 'light') {
                document.documentElement.classList.remove('dark');
                isDark = false;
            } else {
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', isDark);
            }
            
            // 2. Non-blocking side effects
            updateWindowIcon(isDark);

            // 3. State update & Persistence
            setSettings(prev => {
                const newSettings = { ...prev, theme };
                dbService.saveSettings(newSettings).catch(console.error);
                return newSettings;
            });
        };

        // Use View Transitions API if available for smooth cross-fade
        if (document.startViewTransition) {
            document.startViewTransition(() => performUpdate());
        } else {
            performUpdate();
        }
    };

    const updatePrimaryColor = (color: string) => {
        const performUpdate = () => {
            // 1. Immediate visual update
            if (color && color !== 'default') {
                setCssVariables(color);
            } else {
                removeCssVariables();
            }

            // 2. State update & Persistence
            setSettings(prev => {
                const newSettings = { ...prev, primaryColor: color };
                dbService.saveSettings(newSettings).catch(console.error);
                return newSettings;
            });
        };

        if (document.startViewTransition) {
            document.startViewTransition(() => performUpdate());
        } else {
            performUpdate();
        }
    };

    const updateWindowPosition = async (x: number, y: number) => {
        if (!isLoadedRef.current) return;
        setSettings(prev => {
            const newSettings = { ...prev, windowPosition: { x, y } };
            dbService.saveSettings(newSettings).catch(console.error);
            return newSettings;
        });
    };

    const updateWindowSize = async (width: number, height: number) => {
        if (!isLoadedRef.current) return;
        setSettings(prev => {
            const newSettings = { ...prev, windowSize: { width, height } };
            dbService.saveSettings(newSettings).catch(console.error);
            return newSettings;
        });
    };

    return (
        <SettingsContext.Provider
            value={{
                settings,
                updateTheme,
                updatePrimaryColor,
                updateWindowPosition,
                updateWindowSize,
                updateAccountGroup: async (accountId: string, groupName: string) => {
                    setSettings(prev => {
                        const newGroups = { ...(prev.accountGroups || {}) };
                        if (groupName) newGroups[accountId] = groupName;
                        else delete newGroups[accountId];
                        const newSettings = { ...prev, accountGroups: newGroups };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateCustomGroups: async (groups: string[]) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, customGroups: groups };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                renameCustomGroup: async (oldName: string, newName: string) => {
                    setSettings(prev => {
                        const newCustomGroups = (prev.customGroups || []).map(g => g === oldName ? newName : g);
                        const newAccountGroups = { ...(prev.accountGroups || {}) };
                        Object.keys(newAccountGroups).forEach(accountId => {
                            if (newAccountGroups[accountId] === oldName) newAccountGroups[accountId] = newName;
                        });
                        const newCustomGroupsOrder = (prev.customGroupsOrder || []).map(g => g === oldName ? newName : g);
                        const newSettings = {
                            ...prev,
                            customGroups: newCustomGroups,
                            accountGroups: newAccountGroups,
                            customGroupsOrder: newCustomGroupsOrder
                        };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateCustomGroupsOrder: async (order: string[]) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, customGroupsOrder: order };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateAccountsOrder: async (order: string[]) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, accountsOrder: order };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateComponentSpacing: async (spacing: number) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, componentSpacing: spacing };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateComponentPadding: async (padding: number) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, componentPadding: padding };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                },
                updateLastSeenVersion: async (version: string) => {
                    setSettings(prev => {
                        const newSettings = { ...prev, lastSeenVersion: version };
                        dbService.saveSettings(newSettings).catch(console.error);
                        return newSettings;
                    });
                }
            }}
        >
            <div className={`transition-opacity duration-700 ${!isInitialLoadDone ? 'opacity-0' : 'opacity-100'}`}>
                {children}
            </div>

            {!isInitialLoadDone && (
                <div 
                    className={`fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-[9999] transition-all duration-500 ease-in-out ${
                        isTransitioning ? 'opacity-0 scale-110 blur-sm' : 'opacity-100 scale-100'
                    }`}
                >
                    <div className="mb-8 relative">
                        <div className={`absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl transition-transform duration-1000 ${isTransitioning ? 'scale-150' : 'scale-100'}`}></div>
                        <img 
                            src="/logo.svg" 
                            alt="Logo" 
                            className={`w-24 h-24 relative z-10 transition-transform duration-700 ${isTransitioning ? 'rotate-12 scale-110' : 'scale-100'}`} 
                        />
                    </div>
                    <div className={`w-8 h-8 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}></div>
                    <div className={`mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-70 translate-y-0'}`}>
                        DmxMoney
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