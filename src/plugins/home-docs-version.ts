import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';

/** Correct version resolution only on the custom root homepage. All other
 * client exports and actual documentation routes retain the native behavior. */
export default function homeDocsVersion(context: LoadContext): Plugin {
  return {
    name: 'miden-home-docs-version',
    configureWebpack: () => ({
      resolve: {alias: {
        '@docusaurus/plugin-content-docs/client': path.join(context.siteDir, 'src/utils/homeDocsVersion.ts'),
      }},
    }),
  };
}
