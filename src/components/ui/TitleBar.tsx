import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { X, Minus, Square } from 'lucide-react';

const TitleBar: React.FC = () => {
    const appWindow = getCurrentWindow();
    const [currentPlatform, setCurrentPlatform] = useState<string>('');

    useEffect(() => {
        setCurrentPlatform(platform());
    }, []);

    const minimize = () => appWindow.minimize();
    const toggleMaximize = async () => {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) appWindow.unmaximize();
        else appWindow.maximize();
    };
    const close = () => appWindow.close();

    const isMac = currentPlatform === 'macos';

    return (
        <div
            data-tauri-drag-region
            className="app-titlebar h-10 flex items-center justify-center fixed top-0 left-0 right-0 z-[100] select-none bg-transparent pointer-events-none"
        >
            {/* Zone de drag uniquement. Sur Mac, les boutons sont gérés par le système si configuré ou par le Layout */}
            
            {/* Titre centré (optionnel, souvent caché sur Mac) */}
            <div className="flex items-center justify-center text-[11px] font-medium text-gray-400 dark:text-gray-500 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                <span>DmxMoney 2025</span>
            </div>

            {/* Boutons Windows/Linux */}
            {!isMac && (
                <div className="absolute right-0 flex items-center gap-1 pr-2 pointer-events-auto">
                    <button onClick={minimize} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><Minus className="w-4 h-4" /></button>
                    <button onClick={toggleMaximize} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><Square className="w-3.5 h-3.5" /></button>
                    <button onClick={close} className="p-1.5 hover:bg-red-500 hover:text-white text-gray-500"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
};

export default TitleBar;