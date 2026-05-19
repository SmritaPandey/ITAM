'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, disconnectSocket } from './socket';
import type { Socket } from 'socket.io-client';

interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * React hook for real-time WebSocket events from QS Asset.
 *
 * Usage:
 * ```tsx
 * const { connected, events, on } = useRealtimeEvents();
 *
 * // Listen for specific events
 * on('device_status', (data) => { refreshDevices(); });
 * on('notification', (data) => { addNotification(data); });
 * ```
 */
export function useRealtimeEvents() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    // Also register on socket if already connected
    if (socketRef.current?.connected) {
      socketRef.current.on(event, handler);
    }

    // Return cleanup function
    return () => {
      listenersRef.current.get(event)?.delete(handler);
      socketRef.current?.off(event, handler);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Forward domain events
    socket.on('domain_event', (data: RealtimeEvent) => {
      setEvents(prev => [data, ...prev].slice(0, 100));

      // Dispatch to registered listeners by type
      const [module, eventType] = (data.type || '').split('.');
      const handlers = listenersRef.current.get(data.type);
      handlers?.forEach(h => h(data));

      // Also dispatch to module-level listeners
      const moduleHandlers = listenersRef.current.get(module);
      moduleHandlers?.forEach(h => h(data));
    });

    // Forward specific events
    ['notification', 'device_status', 'agent_heartbeat', 'scan_progress'].forEach(evt => {
      socket.on(evt, (data: any) => {
        const handlers = listenersRef.current.get(evt);
        handlers?.forEach(h => h(data));
      });
    });

    // Register any pre-registered listeners
    listenersRef.current.forEach((handlers, event) => {
      handlers.forEach(handler => {
        socket.on(event, handler);
      });
    });

    setConnected(socket.connected);

    return () => {
      // Don't disconnect — keep connection alive across page navigations
      socket.off('domain_event');
      socket.off('notification');
      socket.off('device_status');
      socket.off('agent_heartbeat');
      socket.off('scan_progress');
    };
  }, []);

  return { connected, events, on, socket: socketRef.current };
}

/**
 * Hook that auto-refreshes data when a specific event type is received.
 *
 * Usage:
 * ```tsx
 * const { data, loading } = useLiveData('/monitoring/network', ['monitoring.device_down', 'monitoring.device_recovered']);
 * ```
 */
export function useLiveRefresh(eventTypes: string[], refreshFn: () => void) {
  const { on, connected } = useRealtimeEvents();

  useEffect(() => {
    const cleanups = eventTypes.map(type => on(type, () => refreshFn()));
    return () => cleanups.forEach(c => c());
  }, [eventTypes, refreshFn, on]);

  return { connected };
}
