// Pacotes de paisagem (SPEC §5.2): o main lê a pasta e entrega os bytes ao
// renderer, que não toca disco. Lembra a última pasta aberta entre sessões.
import { app, dialog, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const lastFile = (): string => join(app.getPath('userData'), 'ultima-paisagem.json')

async function readPack(dir: string): Promise<RawPack> {
  const [meta, fuel, altitude, fuelsTable] = await Promise.all([
    readFile(join(dir, 'meta.json'), 'utf-8'),
    readFile(join(dir, 'fuel.bin')),
    readFile(join(dir, 'altitude.bin')),
    readFile(join(dir, 'fuels.csv'), 'utf-8')
  ])
  await writeFile(lastFile(), JSON.stringify({ dir }))
  return { dir, meta: JSON.parse(meta), fuel, altitude, fuelsTable }
}

export function registerLandscapeIpc(): void {
  ipcMain.handle('landscape:open', async () => {
    // Em dev, abre direto na saída do pipeline.
    const out = join(app.getAppPath(), 'pipeline', 'out')
    const r = await dialog.showOpenDialog({
      title: 'Abrir paisagem',
      properties: ['openDirectory'],
      defaultPath: existsSync(out) ? out : undefined
    })
    return r.canceled ? null : readPack(r.filePaths[0])
  })

  ipcMain.handle('landscape:last', async () => {
    try {
      const { dir } = JSON.parse(await readFile(lastFile(), 'utf-8'))
      return await readPack(dir)
    } catch {
      return null
    }
  })
}
