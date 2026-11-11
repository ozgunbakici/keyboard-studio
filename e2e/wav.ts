/** A mono 16-bit PCM WAV with a sine tone, for upload tests. */
export const wav = (seconds: number, freq = 440, rate = 8000) => {
  const n = Math.round(seconds * rate);
  const buffer = Buffer.alloc(44 + n * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + n * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000), 44 + i * 2);
  return buffer;
};
