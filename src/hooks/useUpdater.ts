import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { useState, useCallback, useEffect } from 'react';

export const useUpdater = () => {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    const checkUpdate = useCallback(async (silent = false) => {
        // Prevent running in browser mode without Tauri
        if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
        
        setIsChecking(true);
        try {
            const updateResult = await check();
            
            if (updateResult) {
                console.log(`Update available: ${updateResult.version}`);
                setUpdateAvailable(true);
                
                // If not silent (manual check), ask to update immediately
                if (!silent) {
                    const yes = await ask(
                        `Update to ${updateResult.version} is available!\n\nRelease notes: ${updateResult.body}`,
                        {
                            title: 'Update Available',
                            kind: 'info',
                            okLabel: 'Update',
                            cancelLabel: 'Cancel',
                        }
                    );

                    if (yes) {
                        await updateResult.downloadAndInstall();
                        await relaunch();
                    }
                }
            } else {
                setUpdateAvailable(false);
                if (!silent) {
                    await message('You are on the latest version.', { title: 'No Update Available', kind: 'info' });
                }
            }
        } catch (error) {
            console.error('Update check failed:', error);
            if (!silent) {
                await message(`Failed to check for updates.\n${error}`, { title: 'Error', kind: 'error' });
            }
        } finally {
            setIsChecking(false);
        }
    }, []);

    // Poll for updates every 15 minutes
    useEffect(() => {
        // Check at startup (silent)
        checkUpdate(true);

        const interval = setInterval(() => {
            checkUpdate(true);
        }, 15 * 60 * 1000); // 15 minutes

        return () => clearInterval(interval);
    }, [checkUpdate]);

    return { checkUpdate, isChecking, updateAvailable };
};
