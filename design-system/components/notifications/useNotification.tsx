import { createContext, useCallback, useContext, useId, useState, type ReactNode } from 'react';
import { MuiStackedSnackbar } from './MuiStackedSnackbar';
import type { NotificationVariant, NotificationOptions } from './snackbar.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationItem {
  id: string;
  message: ReactNode;
  title?: string;
  variant: NotificationVariant;
}

interface NotificationContextValue {
  showNotification: (message: ReactNode, options?: NotificationOptions) => void;
  closeNotification: (id: string) => void;
  closeAllNotifications: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const NotificationContext = createContext<NotificationContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — wrap your app root with this
// ---------------------------------------------------------------------------

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const baseId = useId();

  const showNotification = useCallback(
    (message: ReactNode, options?: NotificationOptions) => {
      const id = `${baseId}-${Date.now()}`;
      setNotifications((prev) => [
        ...prev,
        {
          id,
          message,
          title: options?.title,
          variant: options?.variant ?? 'info',
        },
      ]);
    },
    [baseId],
  );

  const closeNotification = useCallback((id: string | number) => {
    const sid = String(id);
    setNotifications((prev) => prev.filter((n) => n.id !== sid));
  }, []);

  const closeAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ showNotification, closeNotification: closeNotification as (id: string) => void, closeAllNotifications }}
    >
      {children}
      {notifications.map((n) => (
        <MuiStackedSnackbar
          key={n.id}
          id={n.id}
          message={n.message}
          title={n.title}
          variant={n.variant}
          onClose={closeNotification}
        />
      ))}
    </NotificationContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used inside <NotificationProvider>');
  }
  return ctx;
};
