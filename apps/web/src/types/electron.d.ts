/**
 * electron.d.ts
 * Global type declarations for the Electron IPC bridge.
 * Exposed via preload.ts → contextBridge.exposeInMainWorld('resortpro', {...})
 */

interface ResortProElectronBridge {
  isElectron: boolean;

  // Network
  isOnline: () => boolean;
  onOnlineChange: (cb: (online: boolean) => void) => () => void;

  // Sync
  triggerSync: (token: string) => Promise<{
    success: boolean;
    syncedAt?: string;
    counts?: Record<string, number>;
    error?: string;
  }>;
  onSyncTokenRequest: (cb: () => void) => () => void;
  getVersion: () => Promise<string>;

  // Offline write queue
  enqueueWrite: (entity: string, operation: string, payload: Record<string, unknown>) => Promise<number>;
  getQueueStats: () => Promise<{ pending: number; failed: number; total: number }>;
  onQueueStats: (cb: (stats: { pending: number; failed: number; total: number }) => void) => () => void;

  // Biometric / Credential storage
  biometricAvailable: () => Promise<boolean>;
  hasSavedCredentials: () => Promise<boolean>;
  authenticateBiometric: () => Promise<{
    success: boolean;
    creds?: { slug: string; email: string; password: string };
    error?: string;
  }>;
  saveCredentials: (creds: { slug: string; email: string; password: string }) => Promise<{ success: boolean }>;
  clearCredentials: () => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    resortpro?: ResortProElectronBridge;
  }
}

export {};
