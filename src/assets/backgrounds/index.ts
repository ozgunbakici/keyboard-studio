import type {PhotoId} from '@/state/store';
import mordor from './mordor.webp';
import mordorSmall from './mordor-small.webp';
import mordorThumb from './mordor-thumb.webp';
import sakura from './sakura.webp';
import sakuraSmall from './sakura-small.webp';
import sakuraThumb from './sakura-thumb.webp';

type Photo = {
  label: string;
  large: string;
  small: string;
  thumb: string;
  /** Which part stays in view on a narrow screen, where the photo is cropped. */
  smallPosition: string;
  /** Darkening that suits the photo; a dark photo needs less. */
  dim: number;
};

/** Photos that come with the app; each has keycap colours of the same name. */
export const photos: Record<PhotoId, Photo> = {
  sakura: {label: 'Sakura klavye', large: sakura, small: sakuraSmall, thumb: sakuraThumb, smallPosition: 'center', dim: 0.55},
  // The tower with the Eye.
  mordor: {label: 'Mordor', large: mordor, small: mordorSmall, thumb: mordorThumb, smallPosition: '88% center', dim: 0.3},
};

export const photoIds = Object.keys(photos) as PhotoId[];
