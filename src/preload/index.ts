import { contextBridge } from 'electron'

// API exposta pro renderer. Vazia no M1: filesystem e downloads entram no M2,
// sempre por aqui, nunca com Node no renderer.
const api = {}

contextBridge.exposeInMainWorld('api', api)
