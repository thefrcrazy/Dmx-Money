import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { useState, useCallback } from 'react';

export const useUpdater = () => {
    const [isChecking, setIsChecking] = useState(false);

    const checkUpdate = useCallback(async (silent = false) => {
        if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
        
        setIsChecking(true);
        try {
            const update = await check();
            
            if (update) {
                console.log(`Update available: ${update.version}`);
                const yes = await ask(
                    `Update to ${update.version} is available!

Release notes: ${update.body}`,
                    {
                        title: 'Update Available',
                        kind: 'info',
                        okLabel: 'Update',
                        cancelLabel: 'Cancel',
                    }
                );

                if (yes) {
                    await update.downloadAndInstall();
                    // Restart the app after the update is installed
                    await relaunch();
                }
            } else if (!silent) {
                await message('You are on the latest version.', { title: 'No Update Available', kind: 'info' });
            }
        } catch (error) {
            console.error(error);
            if (!silent) {
                await message(`Failed to check for updates.
${error}`, { title: 'Error', kind: 'error' });
            }
        } finally {
            setIsChecking(false);
        }
    }, []);

    return { checkUpdate, isChecking };
};
