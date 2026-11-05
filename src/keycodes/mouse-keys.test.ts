import {describe, expect, it} from 'vitest';
import {vendorProductId} from '@/lib/bytes';
import {isStudioFirmware, mouseKeyFirmware, mouseKeysOff} from './mouse-keys';

describe('mouse key support', () => {
  const wt60h1 = vendorProductId(0x6582, 0x0024);

  it('knows boards whose stock firmware has no mouse keys', () => {
    expect(mouseKeysOff(wt60h1)).toBe('wilba.tech WT60-H1');
    expect(mouseKeysOff(wt60h1, 0)).toBe('wilba.tech WT60-H1');
    expect(mouseKeysOff(vendorProductId(0x4f53, 0x514b))).toBeNull();
  });

  it('trusts Klavye Stüdyo builds, which turn mouse keys on', () => {
    expect(isStudioFirmware(0x4b530001)).toBe(true);
    expect(isStudioFirmware(0x00000001)).toBe(false);
    expect(mouseKeysOff(wt60h1, 0x4b530001)).toBeNull();
    expect(mouseKeyFirmware[wt60h1]).toMatch(/\.hex$/);
  });
});
