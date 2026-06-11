/**
 * preload.ts
 * Runs in the renderer process (web app) but has access to Node/Electron APIs.
 * Exposes a SAFE, limited API to the web app via contextBridge.
 *
 * Web app can use:
 *   window.resortpro.isElectron        → true
 *   window.resortpro.isOnline          → boolean
 *   window.resortpro.onOnlineChange(cb)→ listen for network changes
 *   window.resortpro.getVersion()      → app version string
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('resortpro', {
  // Always true when running inside Electron (web browser won't have this)
  isElectron: true,

  // Current network status
  isOnline: (): boolean => navigator.onLine,

  // Listen for online/offline changes sent from main process
  // Returns an unsubscribe function
  onOnlineChange: (callback: (online: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, online: boolean) => {
      callback(online);
    };
    ipcRenderer.on('network-status', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('network-status', handler);
  },

  // App version (from package.json, sent by main process)
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),

  // Trigger a sync pull from the server (call after login)
  // Returns { success, syncedAt, counts, error }
  triggerSync: (token: string): Promise<{ success: boolean; syncedAt?: string; counts?: Record<string, number>; error?: string }> =>
    ipcRenderer.invoke('trigger-sync', token),

  // Main process sends this when network recovers — web app should reply with token
  onSyncTokenRequest: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('request-sync-token', handler);
    return () => ipcRenderer.removeListener('request-sync-token', handler);
  },

  // Enqueue an offline write (called when offline and user makes a change)
  enqueueWrite: (
    entity: string,
    operation: string,
    payload: Record<string, unknown>,
  ): Promise<number> => ipcRenderer.invoke('enqueue-write', entity, operation, payload),

  // Get sync queue stats (pending / failed counts)
  getQueueStats: (): Promise<{ pending: number; failed: number; total: number }> =>
    ipcRenderer.invoke('get-queue-stats'),

  // Main process sends queue stats when network recovers
  onQueueStats: (callback: (stats: { pending: number; failed: number; total: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: { pending: number; failed: number; total: number }) =>
      callback(stats);
    ipcRenderer.on('queue-stats', handler);
    return () => ipcRenderer.removeListener('queue-stats', handler);
  },

  // ── Biometric / Credential storage ──────────────────────────────────────

  // Is Touch ID / Windows Hello available on this device?
  biometricAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('biometric-available'),

  // Save credentials encrypted with OS keychain (call after successful login)
  saveCredentials: (creds: { slug: string; email: string; password: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-credentials', creds),

  // Does a saved credential file exist?
  hasSavedCredentials: (): Promise<boolean> =>
    ipcRenderer.invoke('has-saved-credentials'),

  // Prompt Touch ID / Windows Hello and return decrypted credentials
  authenticateBiometric: (): Promise<{ success: boolean; creds?: { slug: string; email: string; password: string }; error?: string }> =>
    ipcRenderer.invoke('authenticate-biometric'),

  // Remove saved credentials (disable biometric login)
  clearCredentials: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('clear-credentials'),
});
