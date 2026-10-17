import {useMemo} from 'react';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// Import the original module directly, bypassing the public client alias.
import * as NativeDocs from '@docusaurus/plugin-content-docs/lib/client/index.js';
import type {GlobalVersion} from '@docusaurus/plugin-content-docs/lib/client/index.js';
import type {UseDataOptions} from '@docusaurus/types';

export * from '@docusaurus/plugin-content-docs/lib/client/index.js';

function useHomepageVersion(docsPluginId?: string): GlobalVersion | undefined {
  const {pathname} = useLocation();
  const {siteConfig: {baseUrl}} = useDocusaurusContext();
  const {preferredVersion} = NativeDocs.useDocsPreferredVersion(docsPluginId);
  const latestVersion = NativeDocs.useLatestVersion(docsPluginId);
  const isHomepage = pathname.replace(/\/+$/, '') === baseUrl.replace(/\/+$/, '');
  // The workbench offers stable/current. A docs plugin mounted at / otherwise
  // treats this custom page as the stable version, even after Current is chosen.
  return isHomepage
    ? preferredVersion?.name === 'current' ? preferredVersion : latestVersion
    : undefined;
}

export function useActiveDocContext(docsPluginId?: string) {
  const native = NativeDocs.useActiveDocContext(docsPluginId);
  const homeVersion = useHomepageVersion(docsPluginId);
  return useMemo(() => homeVersion ? {...native, activeVersion: homeVersion} : native,
    [native, homeVersion]);
}

export function useActivePluginAndVersion(options: UseDataOptions = {}) {
  const native = NativeDocs.useActivePluginAndVersion(options);
  const homeVersion = useHomepageVersion(native?.activePlugin.pluginId);
  return useMemo(() => native && homeVersion
    ? {...native, activeVersion: homeVersion} : native, [native, homeVersion]);
}
