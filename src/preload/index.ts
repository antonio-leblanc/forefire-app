import { contextBridge, ipcRenderer } from 'electron'

// API exposta pro renderer: tudo de disco passa por aqui, nunca com Node no renderer.
const api: Window['api'] = {
  openLandscape: () => ipcRenderer.invoke('landscape:open'),
  lastLandscape: () => ipcRenderer.invoke('landscape:last')
}

contextBridge.exposeInMainWorld('api', api)
