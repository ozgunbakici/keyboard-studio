/**
 * Keyboards whose stock QMK firmware leaves mouse keys out (`mousekey: false`
 * in QMK's keyboard data, qmk_firmware keyboards/wilba_tech, 2026-10). On them
 * mouse keycodes are stored but do nothing.
 */
const stockWithoutMouseKeys: Record<number, string> = {
  0x5241006a: 'RAMA WORKS M6-A',
  0x5241006b: 'RAMA WORKS M6-B',
  0x524100ab: 'RAMA WORKS M10-B',
  0x524100ac: 'RAMA WORKS M10-C',
  0x5241050a: 'RAMA WORKS M50-A',
  0x5241060a: 'RAMA WORKS M60-A',
  0x5241065b: 'RAMA WORKS M65-B',
  0x5241080a: 'RAMA WORKS U80-A',
  0x5241150a: 'RAMA WORKS M50-AX',
  0x5241165b: 'RAMA WORKS M65-BX',
  0x52414b52: 'RAMA WORKS KARA',
  0x52414b59: 'RAMA WORKS KOYU',
  0x5a450060: 'ZealPC Zeal60',
  0x5a450065: 'ZealPC Zeal65',
  0x6582001c: 'wilba.tech WT60-XT',
  0x6582001d: 'wilba.tech WT65-XT',
  0x6582001e: 'wilba.tech WT65-XTX',
  0x6582001f: 'wilba.tech WT70-JB',
  0x65820021: 'wilba.tech WT60-G',
  0x65820022: 'wilba.tech WT65-G',
  0x65820023: 'wilba.tech WT80-G',
  0x65820024: 'wilba.tech WT60-H1',
  0x65820025: 'wilba.tech WT65-H1',
  0x6582002a: 'wilba.tech WT65-G2',
  0x6582002b: 'wilba.tech WT60-H2',
  0x6582002c: 'wilba.tech WT60-H3',
  0x6582002d: 'wilba.tech WT65-F',
  0x6582002e: 'wilba.tech WT65-FX',
  0x6582002f: 'wilba.tech WT60-G2',
  0x65820031: 'wilba.tech WT65-D',
  0x6582008a: 'wilba.tech WT8-A',
  0x6582060a: 'wilba.tech WT60-A',
  0x6582065a: 'wilba.tech WT65-A',
  0x6582065b: 'wilba.tech WT65-B',
  0x6582069a: 'wilba.tech WT69-A',
  0x6582075a: 'wilba.tech WT75-A',
  0x6582075b: 'wilba.tech WT75-B',
  0x6582075c: 'wilba.tech WT75-C',
  0x6582080a: 'wilba.tech WT80-A',
  0x658260b0: 'wilba.tech WT60-B',
  0x658260b1: 'wilba.tech WT60-BX',
  0x658260c0: 'wilba.tech WT60-C',
  0x658280b0: 'wilba.tech WT80-BC',
};

/** High half of the VIA firmware version of builds made for Klavye Stüdyo ("KS"); they have mouse keys on. */
const STUDIO_FIRMWARE_MARK = 0x4b53;

export const isStudioFirmware = (firmwareVersion?: number) => firmwareVersion !== undefined && firmwareVersion >>> 16 === STUDIO_FIRMWARE_MARK;

/** Firmware files (in public/firmware) with mouse keys on, for boards whose stock firmware has them off. */
export const mouseKeyFirmware: Record<number, string> = {
  0x65820024: 'wilba_tech_wt60_h1_via_mousekey.hex',
};

/** The board's name when its firmware is known to ignore mouse keys, otherwise null. */
export const mouseKeysOff = (vendorProductId: number, firmwareVersion?: number) =>
  isStudioFirmware(firmwareVersion) ? null : (stockWithoutMouseKeys[vendorProductId] ?? null);
