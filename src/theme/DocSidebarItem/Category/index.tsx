import React, { type ReactNode } from "react";
import Category from "@theme-original/DocSidebarItem/Category";
import type CategoryType from "@theme/DocSidebarItem/Category";
import type { WrapperProps } from "@docusaurus/types";

type Props = WrapperProps<typeof CategoryType>;

/**
 * Slugify a category label into a CSS class suffix (e.g. "Smart Contracts"
 * → "smart-contracts"). CSS in _sidebar.css uses these class suffixes to
 * inject a level-1 icon before the category label via a mask-image URL.
 */
function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoryWrapper(props: Props): ReactNode {
  // @ts-ignore — upstream type doesn't surface `level`, but it is present at runtime.
  const level: number | undefined = props.level;
  const label: string | undefined = props?.item?.label;

  // Only decorate top-level categories; deeper categories stay clean.
  if (level !== 1 || !label) {
    return <Category {...props} />;
  }

  const slug = slugifyLabel(label);
  const existingClass = props.item.className ?? "";
  const iconClass = `sidebar-cat sidebar-cat--${slug}`;
  const className = existingClass.includes("sidebar-cat")
    ? existingClass
    : `${existingClass} ${iconClass}`.trim();

  const decorated = {
    ...props,
    item: {
      ...props.item,
      className,
    },
  };

  return <Category {...decorated} />;
}
