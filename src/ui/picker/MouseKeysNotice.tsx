import {Download, TriangleAlert} from 'lucide-react';
import {mouseKeyFirmware, mouseKeysOff} from '@/keycodes/mouse-keys';
import {useStudio} from '@/state/store';

const guideUrl = 'https://github.com/ozgunbakici/keyboard-studio/blob/main/firmware/README.md';

/** Warns when the selected keyboard's firmware ignores mouse keys, and offers a firmware that has them. */
export const MouseKeysNotice = () => {
  const session = useStudio((s) => (s.selectedId ? s.sessions[s.selectedId] : undefined));
  const board = session ? mouseKeysOff(session.vendorProductId, session.firmwareVersion) : null;
  if (!session || !board) return null;
  const file = mouseKeyFirmware[session.vendorProductId];
  return (
    <div role="note" className="flex items-start gap-2.5 rounded-lg border border-macro/40 bg-macro-soft px-3 py-2.5 text-[13px]">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-macro" />
      <div className="flex flex-col gap-1.5">
        <span>
          <b>{board}</b> standart firmware’inde fare tuşları kapalı: buradaki tuşlar klavyeye yazılır ama çalışmaz.
          {file ? ' Fare tuşları açık, VIA uyumlu bir firmware hazır; bir kez yüklemen yeterli.' : ' Çalışmaları için firmware’in fare tuşlarıyla yeniden derlenmesi gerekir.'}
        </span>
        {file && (
          <span className="flex flex-wrap gap-3">
            <a href={`${import.meta.env.BASE_URL}firmware/${file}`} download className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              <Download size={14} /> Firmware’i indir
            </a>
            <a href={guideUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Nasıl yüklenir?
            </a>
          </span>
        )}
      </div>
    </div>
  );
};
