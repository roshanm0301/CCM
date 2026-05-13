import type { ReactNode } from 'react';

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
    variant?: NotificationVariant;
    title?: string;
    autoHideDuration?: number;
}

export interface NotificationData {
    id: string | number;
    message: ReactNode;
    title?: string;
    variant: NotificationVariant;
}

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export const NOTIFICATION_TYPES = {
    SUCCESS: 'success' as const,
    ERROR: 'error' as const,
    WARNING: 'warning' as const,
    INFO: 'info' as const,
} as const;

export interface MuiStackedSnackbarProps {
    id: string | number;
    message: ReactNode;
    title?: string;
    variant: NotificationVariant;
    onClose: (key: string | number) => void;
}
