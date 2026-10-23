import {useEffect, useState} from 'react';
import {BarChart3, GraduationCap, Keyboard, Timer} from 'lucide-react';
import {loadTyping, useTyping} from '@/typing/store';
import {cx} from '@/ui/components/ui';
import {LessonsView} from '@/ui/typing/LessonsView';
import {PracticeView} from '@/ui/typing/PracticeView';
import {StatsView} from '@/ui/typing/StatsView';
import {TestView} from '@/ui/typing/TestView';

type Tab = 'lessons' | 'practice' | 'test' | 'stats';

const tabs: {id: Tab; label: string; icon: React.ReactNode}[] = [
  {id: 'lessons', label: '10 parmak dersleri', icon: <GraduationCap size={15} />},
  {id: 'practice', label: 'Pratik', icon: <Keyboard size={15} />},
  {id: 'test', label: 'Hız testi', icon: <Timer size={15} />},
  {id: 'stats', label: 'İstatistik', icon: <BarChart3 size={15} />},
];

export const TypingPane = () => {
  const loaded = useTyping((s) => s.loaded);
  const [tab, setTab] = useState<Tab>('lessons');

  useEffect(() => {
    void loadTyping();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-border px-4 py-2.5">
        <div role="tablist" aria-label="Antrenman" className="flex rounded-lg border border-border p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium', tab === t.id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
            >
              {t.icon}
              {t.label}
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
