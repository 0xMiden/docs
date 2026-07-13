import MDXComponents from "@theme-original/MDXComponents";
import Callout from "@site/src/components/mdx/Callout";
import Steps from "@site/src/components/mdx/Steps";
import Card from "@site/src/components/mdx/Card";
import CardGrid from "@site/src/components/mdx/CardGrid";
import Badge from "@site/src/components/mdx/Badge";
import Kbd from "@site/src/components/mdx/Kbd";

/**
 * Globally-registered MDX components. These can be used in any `.md` / `.mdx`
 * file without an explicit import. Docusaurus merges these into the default
 * MDX component map at render time.
 */
export default {
  ...MDXComponents,
  Callout,
  Steps,
  Card,
  CardGrid,
  Badge,
  Kbd,
};
