// VIA raw HID protocol constants. Source of truth: QMK quantum/via.h.

export const VIA_USAGE_PAGE = 0xff60;
export const VIA_USAGE = 0x61;
export const REPORT_SIZE = 32;
/** Max payload for buffer read/write commands (32 - 4 header bytes). */
export const BUFFER_CHUNK = 28;

export const Command = {
  GetProtocolVersion: 0x01,
  GetKeyboardValue: 0x02,
  SetKeyboardValue: 0x03,
  DynamicKeymapGetKeycode: 0x04,
  DynamicKeymapSetKeycode: 0x05,
  DynamicKeymapReset: 0x06,
  CustomSetValue: 0x07,
  CustomGetValue: 0x08,
  CustomSave: 0x09,
  EepromReset: 0x0a,
  BootloaderJump: 0x0b,
  MacroGetCount: 0x0c,
  MacroGetBufferSize: 0x0d,
  MacroGetBuffer: 0x0e,
  MacroSetBuffer: 0x0f,
  MacroReset: 0x10,
  DynamicKeymapGetLayerCount: 0x11,
  DynamicKeymapGetBuffer: 0x12,
  DynamicKeymapSetBuffer: 0x13,
  DynamicKeymapGetEncoder: 0x14,
  DynamicKeymapSetEncoder: 0x15,
  /** Device -> host notification asking the UI to re-read custom menu values. */
  UiSyncRequest: 0x16,
  Unhandled: 0xff,
} as const;

export const KeyboardValue = {
  Uptime: 0x01,
  LayoutOptions: 0x02,
  SwitchMatrixState: 0x03,
  FirmwareVersion: 0x04,
  DeviceIndication: 0x05,
  KeycodesVersion: 0x06,
} as const;

export const Channel = {
  Custom: 0,
  Backlight: 1,
  RgbLight: 2,
  RgbMatrix: 3,
  Audio: 4,
  LedMatrix: 5,
} as const;

/** Protocol milestones used to gate behaviour. */
export const Protocol = {
  /** Fast keymap buffer read/write + layer count. */
  Beta: 8,
  /** v3 definitions, custom menus and macro delays. */
  V3Definitions: 11,
  /** Switch matrix state takes a row offset. */
  MatrixOffset: 12,
  /** Firmware reports its QMK keycodes version. */
  KeycodesVersion: 13,
} as const;
