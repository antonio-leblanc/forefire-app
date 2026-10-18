declare global {
  /** Pacote de paisagem como sai do disco (SPEC §5.2); o renderer interpreta em landscape/pack.ts. */
  interface RawPack {
    dir: string
    meta: unknown
    fuel: Uint8Array
    altitude: Uint8Array
    fuelsTable: string
  }

  interface Window {
    api: {
      openLandscape: () => Promise<RawPack | null>
      lastLandscape: () => Promise<RawPack | null>
    }
  }
}

export {}
