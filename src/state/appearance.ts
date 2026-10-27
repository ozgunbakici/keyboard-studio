import {create} from 'zustand';
import {getSetting, setSetting} from '@/storage/db';

/**
 * The background picture the user uploaded. It is kept as a Blob in IndexedDB
 * and shown through an object URL; only this browser has it.
 */
export const useAppearance = create<{customUrl: string | null}>(() => ({customUrl: null}));

const KEY = 'customBackground';
// Large photos are scaled down so they stay light in storage and fast to paint.
const MAX_SIDE = 2560;

const show = (blob: Blob | null) => {
  const previous = useAppearance.getState().customUrl;
  if (previous) URL.revokeObjectURL(previous);
  useAppearance.setState({customUrl: blob ? URL.createObjectURL(blob) : null});
};

export const loadCustomBackground = async () => {
  const blob = await getSetting<Blob | null>(KEY, null);
  if (blob instanceof Blob) show(blob);
};

const shrink = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/webp', 0.85));
};

export const setCustomBackground = async (file: File) => {
  const blob = await shrink(file);
  await setSetting(KEY, blob);
  show(blob);
};

export const removeCustomBackground = async () => {
  await setSetting(KEY, null);
  show(null);
};
