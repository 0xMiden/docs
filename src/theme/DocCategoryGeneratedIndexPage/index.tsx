import React, { type ReactNode } from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import OriginalDocCategoryGeneratedIndexPage from "@theme-original/DocCategoryGeneratedIndexPage";
import type { Props } from "@theme/DocCategoryGeneratedIndexPage";
import { getDocOgDescription, getDocOgImage } from "../../utils/ogImages";

export default function DocCategoryGeneratedIndexPage(props: Props): ReactNode {
  const image =
    props.categoryGeneratedIndex.image ??
    getDocOgImage(props.categoryGeneratedIndex.permalink);
  const description =
    props.categoryGeneratedIndex.description ??
    getDocOgDescription(props.categoryGeneratedIndex.permalink);

  return (
    <>
      <OriginalDocCategoryGeneratedIndexPage {...props} />
      <PageMetadata description={description} image={image}>
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content={`${props.categoryGeneratedIndex.title} | Miden Docs`}
        />
      </PageMetadata>
    </>
  );
}
