// Byte-level helpers shared by the VIA protocol layer.

export const to16 = (hi: number, lo: number): number => ((hi & 0xff) << 8) | (lo & 0xff);

export const from16 = (value: number): [number, number] => [(value >> 8) & 0xff, value & 0xff];

export const to32 = (bytes: ArrayLike<number>): number =>
  (((bytes[0] & 0xff) << 24) | ((bytes[1] & 0xff) << 16) | ((bytes[2] & 0xff) << 8) | (bytes[3] & 0xff)) >>> 0;

export const from32 = (value: number): [number, number, number, number] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

/** Splits a flat byte array of big-endian 16-bit values into numbers. */
export const bytesTo16Array = (bytes: ArrayLike<number>): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out.push(to16(bytes[i], bytes[i + 1]));
  }
  return out;
};

export const array16ToBytes = (values: number[]): number[] => values.flatMap((v) => from16(v));

export const hex = (value: number, width = 4): string => `0x${value.toString(16).padStart(width, '0')}`;

export const vendorProductId = (vendorId: number, productId: number): number =>
  // JS bit operations are 32-bit signed; multiply to stay positive.
  vendorId * 65536 + productId;

/**
 * Layout options are packed into a single 32-bit number. Each option group uses
 * the minimal number of bits needed for its choice count, groups are packed in
 * definition order with the last group in the least significant bits.
 * Mirrors VIA's bit-pack so values are interchangeable with usevia.app.
 */
const bitsFor = (choices: number): number => {
  let bits = 1;
  while (1 << bits < choices) bits++;
  return bits;
};

export const packLayoutOptions = (selections: number[], choiceCounts: number[]): number =>
  selections.reduce((acc, choice, i) => (acc << bitsFor(choiceCounts[i])) | choice, 0) >>> 0;

export const unpackLayoutOptions = (packed: number, choiceCounts: number[]): number[] => {
  const result: number[] = new Array(choiceCounts.length).fill(0);
  let bits = packed >>> 0;
  for (let i = choiceCounts.length - 1; i >= 0; i--) {
    const width = bitsFor(choiceCounts[i]);
    result[i] = bits & ((1 << width) - 1);
    bits = bits >>> width;
  }
  return result;
};
