import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';
const WS_URL = API_BASE.replace('/api/v1', '');

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  if (socket?.connected) return socket;

  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(`${WS_URL}/realtime`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
    console.log('🔌 WebSocket connected');
  });

  socket.on('connected', (data: any) => {
    console.log('✅ QS Asset real-time:', data.message);
  });

  socket.on('auth_error', (data: any) => {
    console.warn('⚠️ WebSocket auth error:', data.message);
    socket?.disconnect();
    socket = null;
  });

  socket.on('disconnect', (reason: string) => {
    console.log('❌ WebSocket disconnected:', reason);
  });

  socket.on('reconnect_attempt', (attempt: number) => {
    reconnectAttempts = attempt;
    console.log(`🔄 Reconnecting (${attempt}/${MAX_RECONNECT})...`);
  });

  socket.on('reconnect_failed', () => {
    console.warn('⚠️ WebSocket reconnection failed');
    socket = null;
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
