import { sessionStore } from '@/lib/sync/session';

// There is no `app/index.tsx`: every screen lives under a tab folder
// (home/search/sell/more). A standalone build launched from the home screen
// starts at the bare root URL (`variedadesicmobile:///`), which matches no
// route and shows expo-router's "Unmatched Route" page instead of the app.
// Rewrite that root path to a real tab before routing happens.
//
// A seller's "home" tab is hidden (see app-tabs.tsx) and a hidden tab can't
// be focused, so anyone who isn't a signed-in owner starts on "sell", the
// one tab every role has. Deep links to an actual path pass through untouched.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!isRootPath(path)) return path;
  const state = sessionStore.getSnapshot();
  const isOwner = state.status === 'authenticated' && state.session.user.role === 'owner';
  return isOwner ? '/home' : '/sell';
}

function isRootPath(path: string): boolean {
  // Strip an optional `scheme://` prefix, then any slashes, query or hash.
  const rest = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[?#].*$/, '');
  return rest.replace(/\//g, '') === '';
}
