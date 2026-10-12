import localSearch, {validateOptions} from '@cmfcmf/docusaurus-search-local';
import type {LoadContext, Plugin} from '@docusaurus/types';

export {validateOptions};

/** With docs mounted at /, search-local misclassifies the custom homepage as
 * a doc and looks for .theme-doc-markdown. Index that route as a page instead,
 * preserving the original provider, versioned indexes and ranking settings. */
export default function docsSearch(context: LoadContext, options): Plugin {
  const docsIndexer = localSearch(context, options);
  return {
    ...docsIndexer,
    async postBuild(props) {
      const homeRoutes = props.routesPaths.filter(route =>
        route === props.baseUrl || route === props.baseUrl.replace(/\/$/, ''),
      );
      await docsIndexer.postBuild({
        ...props,
        routesPaths: props.routesPaths.filter(route => !homeRoutes.includes(route)),
      });
      const pageIndexer = localSearch(context, {
        ...options, indexDocs: false, indexBlog: false, indexPages: true,
      });
      await pageIndexer.postBuild({...props, routesPaths: homeRoutes});
    },
  };
}
