import { app, BrowserWindow, shell, session, ipcMain, net, safeStorage, systemPreferences } from 'electron';
import * as path from 'path';
import { getDb, closeDb } from '../db/local-db';
import { syncPull, getLastSynced } from './sync-service';
import { flushQueue, getQueueStats } from './sync-queue';
import {
  getDeviceConfig, saveDeviceConfig, pollAttendanceDevice,
  startAttendanceDevicePolling, stopAttendanceDevicePolling,
} from './attendance-device';

// ─── Config ───────────────────────────────────────────────────────────────────
const WEB_URL    = process.env.RESORTPRO_WEB_URL || 'https://app.resortpro.site';
const START_PAGE = `${WEB_URL}/dashboard`;
// Logged in  → dashboard
// Not logged → Next.js middleware redirects to /auth/login

// ─── Network monitor ─────────────────────────────────────────────────────────
// Checks real connectivity every 10s and notifies the renderer
let networkPollTimer: NodeJS.Timeout | null = null;
let lastOnlineState: boolean | null = null;

function startNetworkMonitor(win: BrowserWindow) {
  const check = async () => {
    const online = net.isOnline();
    if (online !== lastOnlineState) {
      lastOnlineState = online;
      if (!win.isDestroyed()) {
        win.webContents.send('network-status', online);
      }

      // When network comes back — ask the renderer for the auth token
      // then trigger flush + incremental sync automatically
      if (online && !win.isDestroyed()) {
        win.webContents.send('request-sync-token');

        // Notify renderer about pending queue items
        const stats = getQueueStats();
        if (stats.pending > 0) {
          win.webContents.send('queue-stats', stats);
        }
      }
    }
  };

  check(); // immediate first check
  networkPollTimer = setInterval(check, 10_000);
}

function stopNetworkMonitor() {
  if (networkPollTimer) {
    clearInterval(networkPollTimer);
    networkPollTimer = null;
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────
function registerIpcHandlers() {
  // web app can call: window.resortpro.getVersion()
  ipcMain.handle('get-version', () => app.getVersion());

  // web app calls this after login to trigger initial sync
  // window.resortpro.triggerSync(token)
  ipcMain.handle('trigger-sync', async (_event, token: string) => {
    const since = getLastSynced('guests') ?? undefined;
    // 1. Flush any pending offline writes first
    const flush = await flushQueue(token);
    // 2. Then pull latest from server
    const pull = await syncPull(token, since);
    return { ...pull, flush };
  });

  // web app can enqueue an offline write
  // window.resortpro.enqueueWrite(entity, operation, payload)
  ipcMain.handle('enqueue-write', (_event, entity: string, operation: string, payload: Record<string, unknown>) => {
    const { enqueue } = require('./sync-queue');
    return enqueue(entity, operation, payload);
  });

  // web app can get queue stats
  // window.resortpro.getQueueStats()
  ipcMain.handle('get-queue-stats', () => {
    return getQueueStats();
  });

  // ── Biometric / Credential storage ────────────────────────────────────
  // Credentials stored in: userData/saved-credentials (encrypted via OS keychain)
  const credPath = () => require('path').join(app.getPath('userData'), 'saved-creds.bin');

  // Check if biometric auth is available on this device
  ipcMain.handle('biometric-available', () => {
    if (process.platform === 'darwin') {
      return systemPreferences.canPromptTouchID();
    }
    // Windows Hello — check via safeStorage availability
    if (process.platform === 'win32') {
      return safeStorage.isEncryptionAvailable();
    }
    return false;
  });

  // Save credentials encrypted with OS keychain
  // window.resortpro.saveCredentials({ slug, email, password })
  ipcMain.handle('save-credentials', async (_event, creds: { slug: string; email: string; password: string }) => {
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'Encryption not available' };
    try {
      const fs = require('fs');
      const encrypted = safeStorage.encryptString(JSON.stringify(creds));
      fs.writeFileSync(credPath(), encrypted);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Check if saved credentials exist (doesn't return them — just a flag)
  ipcMain.handle('has-saved-credentials', () => {
    const fs = require('fs');
    return fs.existsSync(credPath()) && safeStorage.isEncryptionAvailable();
  });

  // Authenticate with biometrics and return decrypted credentials
  // window.resortpro.authenticateBiometric()
  ipcMain.handle('authenticate-biometric', async () => {
    const fs = require('fs');

    if (!fs.existsSync(credPath())) return { success: false, error: 'No saved credentials' };
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'Encryption not available' };

    try {
      // macOS — Touch ID prompt
      if (process.platform === 'darwin' && systemPreferences.canPromptTouchID()) {
        await systemPreferences.promptTouchID('Login to ResortPro');
      }
      // Windows — safeStorage handles Windows Hello automatically when decrypting

      const encrypted = fs.readFileSync(credPath()) as Buffer;
      const decrypted = safeStorage.decryptString(encrypted);
      const creds = JSON.parse(decrypted) as { slug: string; email: string; password: string };
      return { success: true, creds };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Remove saved credentials (logout from biometric)
  ipcMain.handle('clear-credentials', () => {
    const fs = require('fs');
    try {
      if (fs.existsSync(credPath())) fs.unlinkSync(credPath());
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Fingerprint attendance device ─────────────────────────────────────
  // window.resortpro.getAttendanceDeviceConfig()
  ipcMain.handle('get-attendance-device-config', () => getDeviceConfig());

  // window.resortpro.saveAttendanceDeviceConfig({ ip, port, deviceKey, apiBase })
  ipcMain.handle('save-attendance-device-config', (_event, config: { ip: string; port: number; deviceKey: string; apiBase: string; pollIntervalMs?: number }) => {
    saveDeviceConfig(config);
    startAttendanceDevicePolling();
    return { success: true };
  });

  // window.resortpro.pollAttendanceDeviceNow() — manual "sync now" button
  ipcMain.handle('poll-attendance-device-now', () => pollAttendanceDevice());
}

// ─── Create Window ────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    title:     'ResortPro',
    icon:      path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // Persistent session — cookies + localStorage survive app restarts
      partition:        'persist:resortpro',
    },
  });

  // Load dashboard (or login if not authenticated)
  win.loadURL(START_PAGE);

  // External links open in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(WEB_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Start watching network after page loads
  win.webContents.once('did-finish-load', () => {
    startNetworkMonitor(win);
  });

  win.on('closed', () => {
    stopNetworkMonitor();
  });

  return win;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Open SQLite local database (creates it if first run)
  getDb();

  // Persistent session config
  const ses = session.fromPartition('persist:resortpro');
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'notifications');
  });

  registerIpcHandlers();
  createWindow();

  // No-op if no device has been configured yet (attendance-device.ts checks internally)
  startAttendanceDevicePolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopAttendanceDevicePolling();
  closeDb();
});
