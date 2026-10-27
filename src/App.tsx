import {useEffect} from 'react';
import {useSelectedSession, useStudio} from '@/state/store';
import {ConfirmHost} from '@/ui/components/Dialog';
import {Backdrop} from '@/ui/layout/Backdrop';
import {Sidebar} from '@/ui/layout/Sidebar';
import {Toasts} from '@/ui/layout/Toasts';
import {TopBar} from '@/ui/layout/TopBar';
import {BackupsPane} from '@/ui/panes/BackupsPane';
import {SessionStateScreen, WelcomeScreen} from '@/ui/panes/ConnectScreen';
import {DefinitionsPane} from '@/ui/panes/DefinitionsPane';
import {KeymapPane} from '@/ui/panes/KeymapPane';
import {LibraryPane} from '@/ui/panes/LibraryPane';
import {LightingPane} from '@/ui/panes/LightingPane';
import {MacrosPane} from '@/ui/panes/MacrosPane';
import {SettingsPane} from '@/ui/panes/SettingsPane';
import {TesterPane} from '@/ui/panes/TesterPane';
import {TypingPane} from '@/ui/panes/TypingPane';

const keyboardPanes = {
  keymap: KeymapPane,
  macros: MacrosPane,
  lighting: LightingPane,
  tester: TesterPane,
};

const useTheme = () => {
  const theme = useStudio((s) => s.settings.theme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
};

const Content = () => {
  const pane = useStudio((s) => s.pane);
  const session = useSelectedSession();
  if (pane === 'library') return <LibraryPane />;
  if (pane === 'typing') return <TypingPane />;
  if (pane === 'backups') return <BackupsPane />;
  if (pane === 'definitions') return <DefinitionsPane />;
  if (pane === 'settings') return <SettingsPane />;
  if (!session) return <WelcomeScreen />;
  if (session.status !== 'ready') return <SessionStateScreen session={session} />;
  const Pane = keyboardPanes[pane];
  return <Pane />;
};

export const App = () => {
  useTheme();
  return (
    <div className="flex h-full min-h-0">
      <Backdrop />
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col" style={{background: 'var(--main-tint)'}}>
        <TopBar />
        <div className="min-h-0 flex-1 overflow-auto">
          <Content />
        </div>
      </main>
      <Toasts />
      <ConfirmHost />
    </div>
  );
};
