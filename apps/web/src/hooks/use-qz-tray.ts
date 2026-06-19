'use client';

/**
 * QZ Tray WebSocket hook
 *
 * QZ Tray is a desktop middleware that bridges the browser to local printers.
 * It listens on ws://localhost:8181 and accepts JSON print jobs.
 *
 * States:
 *   disconnected — QZ Tray not running / not installed
 *   connecting   — WebSocket handshake in progress
 *   connected    — ready to print
 *   error        — connection failed
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type QZStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrintJob {
  printer: string;
  data: string[]; // array of ESC/POS command strings or raw text lines
  type?: 'raw' | 'html' | 'pdf';
}

interface QZMessage {
  uid: string;
  type: string;
  [key: string]: unknown;
}

const QZ_URL = 'wss://localhost:8181';
const CONNECT_TIMEOUT_MS = 3000;

let messageId = 0;
function nextUid() {
  return `rp_${++messageId}_${Date.now()}`;
}

export function useQZTray() {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map());
  const [status, setStatus] = useState<QZStatus>('disconnected');
  const [printers, setPrinters] = useState<string[]>([]);

  // ── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');

    const ws = new WebSocket(QZ_URL);
    wsRef.current = ws;

    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        setStatus('error');
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(timeout);
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: QZMessage = JSON.parse(event.data as string);
        const pending = pendingRef.current.get(msg.uid);
        if (pending) {
          pendingRef.current.delete(msg.uid);
          if (msg.type === 'ERROR') {
            pending.reject(new Error(String(msg.message ?? 'QZ Tray error')));
          } else {
            pending.resolve(msg);
          }
        }
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      setStatus('disconnected');
      // reject all pending
      pendingRef.current.forEach(p => p.reject(new Error('QZ Tray disconnected')));
      pendingRef.current.clear();
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      setStatus('error');
    };
  }, []);

  // ── Send a message, await reply ──────────────────────────────────────────────
  const send = useCallback((payload: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('QZ Tray not connected'));
        return;
      }
      const uid = nextUid();
      pendingRef.current.set(uid, { resolve, reject });
      ws.send(JSON.stringify({ ...payload, uid }));
    });
  }, []);

  // ── List printers ────────────────────────────────────────────────────────────
  const listPrinters = useCallback(async (): Promise<string[]> => {
    const result = await send({ type: 'printers' }) as { printers?: string[] };
    const list = result.printers ?? [];
    setPrinters(list);
    return list;
  }, [send]);

  // ── Print raw ESC/POS ────────────────────────────────────────────────────────
  const print = useCallback(async (job: PrintJob): Promise<void> => {
    await send({
      type: 'print',
      printer: job.printer,
      options: { language: job.type ?? 'raw', copies: 1 },
      data: job.data,
    });
  }, [send]);

  // ── Disconnect on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { status, printers, connect, listPrinters, print };
}
