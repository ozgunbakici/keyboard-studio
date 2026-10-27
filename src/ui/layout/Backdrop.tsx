import {useEffect, useState} from 'react';
import {photos} from '@/assets/backgrounds';
import {useAppearance} from '@/state/appearance';
import {useStudio} from '@/state/store';

const useSmallScreen = () => {
  const query = '(max-width: 900px)';
  const [small, setSmall] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setSmall(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return small;
};

/**
 * The picture behind the app, tinted so text stays readable. It also marks the
 * document (data-bg, data-keys) so surfaces turn translucent and keyboards take
 * the chosen keycap colours.
 */
export const Backdrop = () => {
  const background = useStudio((s) => s.settings.background);
  const dim = useStudio((s) => s.settings.backgroundDim);
  const blur = useStudio((s) => s.settings.backgroundBlur);
  const keyTheme = useStudio((s) => s.settings.keyTheme);
  const customUrl = useAppearance((s) => s.customUrl);
  const small = useSmallScreen();
  const photo = background === 'plain' || background === 'custom' ? null : photos[background];
  const url = photo ? (small ? photo.small : photo.large) : background === 'custom' ? customUrl : null;

  useEffect(() => {
    document.documentElement.dataset.bg = url ? 'image' : 'plain';
  }, [url]);
  useEffect(() => {
    document.documentElement.dataset.keys = keyTheme;
  }, [keyTheme]);

  if (!url) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" data-testid="backdrop">
      {/* Oversized so a blurred edge never shows. */}
      <div
        className="absolute -inset-6 bg-cover bg-center"
        style={{
          backgroundImage: `url("${url}")`,
          backgroundPosition: photo && small ? photo.smallPosition : undefined,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
      <div className="absolute inset-0" style={{background: 'var(--backdrop-tint)', opacity: dim}} />
    </div>
  );
};
