import React, { type ReactNode } from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { getDocOgDescription, getDocOgImage } from "../../../utils/ogImages";

export default function DocItemMetadata(): ReactNode {
  const { metadata, frontMatter, assets } = useDoc();
  const image = assets.image ?? frontMatter.image ?? getDocOgImage(metadata.permalink);
  const description = metadata.description || getDocOgDescription(metadata.permalink);

  return (
    <PageMetadata
      title={metadata.title}
      description={description}
      keywords={frontMatter.keywords}
      image={image}
    >
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${metadata.title} | Miden Docs`} />
    </PageMetadata>
  );
}
