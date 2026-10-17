import React, { type ComponentProps } from "react";
import { useDocsData, useDocsVersion } from "@docusaurus/plugin-content-docs/client";
import Card from "@site/src/components/mdx/Card";

type Props = Omit<ComponentProps<typeof Card>, "href"> & { page: string };

/** Keep guide cards in the reader's selected documentation version. */
export default function MiniAppCard({ page, ...props }: Props): React.JSX.Element {
  const { pluginId, version } = useDocsVersion();
  const { versions } = useDocsData(pluginId);
  const target = versions.find(candidate => candidate.name === version)?.docs.find(
    doc => doc.id === `builder/mini-apps/${page}`,
  );
  if (!target) throw new Error(`Missing Mini-app guide: ${page} (${version})`);
  return <Card {...props} href={target.path} />;
}
