'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';

export function ThemeManager() {
    const theme = useSettingsStore((state) => state.theme);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    return null;
}
