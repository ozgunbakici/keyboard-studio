import {Lightbulb, RefreshCw, Unplug} from 'lucide-react';
import {blink, closeSession, reloadSession} from '@/state/actions';
import {useSelectedData, useSelectedSession, useStudio} from '@/state/store';
import {Badge, IconButton} from '@/ui/components/ui';

const paneTitles = {
  keymap: 'Tuş haritası',
  library: 'Eylem kütüphanesi',
  macros: 'Makrolar',
  lighting: 'Işık ve ayarlar',
  tester: 'Tuş testi',
  backups: 'Yedekler',
  definitions: 'Klavye tanımları',
  settings: 'Ayarlar',
} as const;

const sourceText = {user: 'senin yüklediğin tanım', bundle: 'VIA tanım paketi', demo: 'demo tanımı'} as const;

export const TopBar = () => {
  const session = useSelectedSession();
  const data = useSelectedData();
  const pane = useStudio((s) => s.pane);
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
      <h1 className="text-[15px] font-semibold">{paneTitles[pane]}</h1>
      {session && (
        <>
          <span className="h-4 w-px bg-border" />
          <span className="truncate text-sm text-muted">{data?.name ?? session.productName}</span>
          <span className="hidden items-center gap-1.5 lg:flex">
            {session.protocol !== undefined && <Badge>VIA v{session.protocol}</Badge>}
            <Badge>
              {hex(session.vendorId)}:{hex(session.productId)}
            </Badge>
            {data && <Badge tone={data.definitionSource === 'user' ? 'accent' : 'neutral'}>{sourceText[data.definitionSource]}</Badge>}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {session.kind === 'webhid' && (
              <IconButton label="Klavyenin ışıklarını yakıp söndür (hangisi olduğunu gör)" onClick={() => void blink(session.id)}>
                <Lightbulb size={16} />
              </IconButton>
            )}
            <IconButton label="Klavyeden yeniden oku" onClick={() => void reloadSession(session.id)}>
              <RefreshCw size={16} />
            </IconButton>
            <IconButton label="Bağlantıyı kapat" onClick={() => void closeSession(session.id)}>
              <Unplug size={16} />
            </IconButton>
          </div>
        </>
      )}
    </header>
  );
};
