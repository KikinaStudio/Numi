'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme } = useSettingsStore();

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);

    return <>{children}</>;
}
