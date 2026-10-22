import {useCallback, useEffect, useMemo, useState} from 'react';
import {FileJson, Search, Trash2} from 'lucide-react';
import {deleteUserDefinition, listUserDefinitions, loadBundleIndex, type BundleIndexEntry} from '@/definitions/repository';
import {importDefinitionFile} from '@/state/actions';
import type {StoredDefinition} from '@/storage/db';
import {confirm} from '@/ui/components/Dialog';
import {Badge, EmptyState, FileButton, IconButton} from '@/ui/components/ui';

const hexId = (vpid: number) => {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  return `${hex(Math.floor(vpid / 65536))}:${hex(vpid & 0xffff)}`;
};

export const DefinitionsPane = () => {
  const [stored, setStored] = useState<StoredDefinition[]>([]);
  const [bundle, setBundle] = useState<BundleIndexEntry[]>([]);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStored(await listUserDefinitions());
    } catch {
      setStored([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadBundleIndex().then(setBundle);
  }, [refresh]);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return [];
    return bundle.filter((k) => k.name.toLocaleLowerCase('tr-TR').includes(q) || hexId(k.vendorProductId).toLowerCase().includes(q)).slice(0, 30);
  }, [bundle, query]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-5">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">VIA JSON dosyası yükle</h2>
        <p className="mt-1 text-sm text-muted">
          VIA’nın listesinde olmayan klavyeler (ör. birçok Neo ve QK modeli) için üreticinin JSON dosyasını bir kez yükle. Dosya bu tarayıcıda
          saklanır ve klavye takılınca otomatik kullanılır. Aynı klavye için yüklediğin dosya, VIA paketindekinden önceliklidir.
        </p>
        <div className="mt-3">
          <FileButton
            accept=".json,application/json"
            variant="primary"
            icon={<FileJson size={16} />}
            onFile={async (file) => {
              await importDefinitionFile(file);
              await refresh();
            }}
          >
            JSON dosyası seç
          </FileButton>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Yüklediğin tanımlar</h2>
        {stored.length ? (
          <ul>
            {stored.map((def) => (
              <li key={`${def.vendorProductId}-${def.version}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <FileJson size={18} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{def.name}</div>
                  <div className="font-mono text-xs text-faint">
                    {hexId(def.vendorProductId)} · {def.version} · {new Date(def.savedAt).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <IconButton
                  label="Sil"
                  onClick={async () => {
                    if (await confirm({title: `${def.name} silinsin mi?`, body: 'Klavye bir dahaki bağlanışta tekrar JSON isteyebilir.', confirmLabel: 'Sil', danger: true})) {
                      await deleteUserDefinition(def.vendorProductId, def.version);
                      await refresh();
                    }
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Henüz tanım yüklemedin">VIA’nın tanıdığı klavyeler için bir şey yüklemen gerekmez.</EmptyState>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">VIA tanım paketi</h2>
          <Badge>{bundle.length ? `${bundle.length} klavye` : 'paket yok'}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Klavyen burada varsa JSON yüklemene gerek yok; takınca otomatik tanınır.</p>
        <label className="relative mt-3 block">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Model ara (ör. QK65, Neo, Ratio)"
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        {query && (
          <ul className="mt-3 flex flex-col gap-1">
            {matches.length ? (
              matches.map((k) => (
                <li key={k.vendorProductId} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span>{k.name}</span>
                  <span className="font-mono text-xs text-faint">
                    {hexId(k.vendorProductId)} · {k.versions.join('/')}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-faint">Bulunamadı: üreticinin JSON dosyasını yüklemen gerekecek.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
};
