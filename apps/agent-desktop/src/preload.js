'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentDesktop', {
  onStatus(callback) {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('agent-status', handler);
    return () => ipcRenderer.removeListener('agent-status', handler);
  },
  getStatus() {
    return ipcRenderer.invoke('get-status');
  },
  openDashboard() {
    return ipcRenderer.invoke('open-dashboard');
  },
});
