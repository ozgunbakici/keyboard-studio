import {useEffect, useState} from 'react';
import {BarChart3, GraduationCap, Keyboard, Timer} from 'lucide-react';
import {loadTyping, useTyping} from '@/typing/store';
import {cx} from '@/ui/components/ui';
import {LessonsView} from '@/ui/typing/LessonsView';
import {PracticeView} from '@/ui/typing/PracticeView';
import {StatsView} from '@/ui/typing/StatsView';
import {TestView} from '@/ui/typing/TestView';

type Tab = 'lessons' | 'practice' | 'test' | 'stats';

const tabs: {id: Tab; label: string; short: string; icon: React.ReactNode}[] = [
  {id: 'lessons', label: '10 parmak dersleri', short: 'Dersler', icon: <GraduationCap size={15} />},
  {id: 'practice', label: 'Pratik', short: 'Pratik', icon: <Keyboard size={15} />},
  {id: 'test', label: 'Hız testi', short: 'Test', icon: <Timer size={15} />},
  {id: 'stats', label: 'İstatistik', short: 'İstatistik', icon: <BarChart3 size={15} />},
];

export const TypingPane = () => {
  const loaded = useTyping((s) => s.loaded);
  const [tab, setTab] = useState<Tab>('lessons');

  useEffect(() => {
    void loadTyping();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex overflow-x-auto border-b border-border px-3 py-2.5 sm:px-4">
        <div role="tablist" aria-label="Antrenman" className="flex shrink-0 rounded-lg border border-border p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium sm:px-3',
                tab === t.id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {t.icon}
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      {!loaded ? null : tab === 'lessons' ? (
        <LessonsView />
      ) : tab === 'practice' ? (
        <PracticeView />
      ) : tab === 'test' ? (
        <TestView />
      ) : (
        <StatsView onPractice={() => setTab('practice')} />
      )}
    </div>
  );
};
