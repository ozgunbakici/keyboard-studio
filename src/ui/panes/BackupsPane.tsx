import {useCallback, useEffect, useState} from 'react';
import {Archive, Download, FileUp, RotateCcw, Trash2} from 'lucide-react';
import {isBackupFile, isViaSaveFile, toViaSaveFile} from '@/state/backup';
import {restoreBackup, saveBackup, snapshot} from '@/state/actions';
import {toast, useSelectedData, useSelectedSession} from '@/state/store';
import {db, type StoredBackup} from '@/storage/db';
import {confirm} from '@/ui/components/Dialog';
import {Badge, Button, EmptyState, FileButton, IconButton, downloadJson, slug} from '@/ui/components/ui';

const dateText = (time: number) =>
  new Intl.DateTimeFormat('tr-TR', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(time);

export const BackupsPane = () => {
  const session = useSelectedSession();
  const data = useSelectedData();
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [label, setLabel] = useState('');
  const ready = session?.status === 'ready' && !!data;

  const refresh = useCallback(async () => {
    try {
      setBackups(await db.backups.orderBy('createdAt').reverse().toArray());
    } catch {
      setBackups([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const forThisKeyboard = backups.filter((b) => b.vendorProductId === session?.vendorProductId);
  const others = backups.filter((b) => b.vendorProductId !== session?.vendorProductId);

  const restore = async (file: unknown, name: string) => {
    if (!ready) {
      toast('Geri yüklemek için önce klavyeyi bağla.', 'error');
      return;
    }
    if (!isBackupFile(file) && !isViaSaveFile(file)) {
      toast('Bu dosya tanınan bir yedek değil (Klavye Stüdyo yedeği ya da VIA .layout.json bekleniyor).', 'error');
      return;
    }
    if (
      await confirm({
        title: 'Yedek geri yüklensin mi?',
        body: `“${name}” klavyeye yazılacak: tuş haritası, knob, makrolar${isBackupFile(file) ? ', dizilim ve ışık ayarları' : ''}. Mevcut hâl önce otomatik yedeklenir.`,
        confirmLabel: 'Geri yükle',
      })
    ) {
      await restoreBackup(file);
      await refresh();
    }
  };

  const row = (backup: StoredBackup) => (
    <li key={backup.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{backup.label || 'Yedek'}</span>
          {backup.automatic && <Badge>otomatik</Badge>}
        </div>
        <div className="text-xs text-faint">
          {backup.deviceName} · {dateText(backup.createdAt)} · {backup.data.layers.length} katman
          {backup.data.macros ? ` · ${backup.data.macros.expressions.filter(Boolean).length} makro` : ''}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {backup.vendorProductId === session?.vendorProductId && (
          <Button size="sm" icon={<RotateCcw size={14} />} disabled={!ready} onClick={() => void restore(backup.data, backup.label)}>
            Geri yükle
          </Button>
        )}
        <IconButton label="JSON olarak indir" onClick={() => downloadJson(`${slug(backup.deviceName)}-${slug(backup.label || 'yedek')}.klavye.json`, backup.data)}>
          <Download size={15} />
        </IconButton>
        <IconButton
          label="VIA formatında indir (.layout.json)"
          onClick={() => downloadJson(`${slug(backup.deviceName)}.layout.json`, toViaSaveFile(backup.data))}
        >
          <span className="text-[10px] font-bold">VIA</span>
        </IconButton>
        <IconButton
          label="Sil"
          onClick={async () => {
            if (await confirm({title: 'Yedek silinsin mi?', body: 'Bu işlem geri alınamaz.', confirmLabel: 'Sil', danger: true})) {
              await db.backups.delete(backup.id!);
              await refresh();
            }
          }}
        >
          <Trash2 size={15} />
        </IconButton>
      </div>
    </li>
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-5">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Yeni yedek</h2>
        <p className="mt-1 text-sm text-muted">
          Tuş haritası, knob, dizilim seçenekleri, makrolar ve ışık ayarları birlikte kaydedilir. Klavye her bağlandığında da günde iki kez otomatik
          yedek alınır.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Yedek adı (ör. Kod düzeni)"
            className="h-9 min-w-56 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
          <Button
            variant="primary"
            icon={<Archive size={15} />}
            disabled={!ready}
            onClick={async () => {
              if (!session) return;
              const id = await saveBackup(session.id, label.trim() || 'Elle alınan yedek');
              if (id) {
                toast('Yedek alındı.', 'success');
                setLabel('');
                await refresh();
              }
            }}
          >
            Yedek al
          </Button>
          <Button
            icon={<Download size={15} />}
            disabled={!ready}
            onClick={() => {
              if (!session) return;
              const file = snapshot(session.id);
              if (file) downloadJson(`${slug(file.keyboard.name)}.layout.json`, toViaSaveFile(file));
            }}
          >
            VIA dosyası indir
          </Button>
          <FileButton
            accept=".json,application/json"
            icon={<FileUp size={15} />}
            onFile={async (file) => {
              try {
                await restore(JSON.parse(await file.text()), file.name);
              } catch {
                toast(`${file.name} okunamadı.`, 'error');
              }
            }}
          >
            Dosyadan geri yükle
          </FileButton>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
          {session ? `${data?.name ?? session.productName} yedekleri` : 'Bu klavyenin yedekleri'}
        </h2>
        {forThisKeyboard.length ? (
          <ul>{forThisKeyboard.map(row)}</ul>
        ) : (
          <EmptyState title="Henüz yedek yok">{session ? 'İlk yedeği yukarıdan alabilirsin.' : 'Bir klavye bağlayınca yedekleri burada görünür.'}</EmptyState>
        )}
      </section>

      {others.length > 0 && (
        <section className="rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Diğer klavyeler</h2>
          <ul>{others.map(row)}</ul>
        </section>
      )}
    </div>
  );
};
