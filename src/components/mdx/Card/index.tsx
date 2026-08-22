import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import {
  useActiveDocContext,
  useLayoutDoc,
  type GlobalDoc,
  type GlobalVersion,
} from "@docusaurus/plugin-content-docs/client";
import clsx from "clsx";
import styles from "./styles.module.css";

type CardProps = {
  title: string;
  href?: string;
  docId?: string;
  hash?: string;
  icon?: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
};

type CardLinkProps = {
  href?: string;
  docId?: string;
  hash?: string;
  children: ReactNode;
};

function splitHref(href: string): { pathname: string; suffix: string } {
  const suffixIndex = href.search(/[?#]/);

  if (suffixIndex === -1) {
    return { pathname: href, suffix: "" };
  }

  return {
    pathname: href.slice(0, suffixIndex),
    suffix: href.slice(suffixIndex),
  };
}

function isRelativePath(href: string): boolean {
  return href.startsWith("./") || href.startsWith("../");
}

function normalizeDocId(pathname: string): string {
  const parts: string[] = [];

  for (const part of pathname.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return parts.join("/");
}

function getDocSourceDir(docId: string): string {
  const indexSuffix = "/index";

  if (docId.endsWith(indexSuffix)) {
    return docId.slice(0, -indexSuffix.length);
  }

  return docId.split("/").slice(0, -1).join("/");
}

function findVersionDoc(
  version: GlobalVersion,
  targetId: string,
): GlobalDoc | undefined {
  return version.docs.find(
    (doc) => doc.id === targetId || doc.id === `${targetId}/index`,
  );
}

function getVersionPath(version: GlobalVersion): string {
  return version.path === "/" ? "" : version.path.replace(/\/$/, "");
}

function resolveDocRelativeHref(
  href: string,
  activeDoc: GlobalDoc | undefined,
  activeVersion: GlobalVersion | undefined,
): string {
  if (!activeDoc || !activeVersion) {
    return href;
  }

  const { pathname, suffix } = splitHref(href);
  const sourceDir = getDocSourceDir(activeDoc.id);
  const targetId = normalizeDocId(`${sourceDir}/${pathname}`);
  const targetDoc = findVersionDoc(activeVersion, targetId);

  if (targetDoc) {
    return `${targetDoc.path}${suffix}`;
  }

  return `${getVersionPath(activeVersion)}/${targetId.replace(/\/$/, "")}/${suffix}`;
}

function DocIdCardLink({ docId, hash, children }: CardLinkProps): JSX.Element {
  const doc = useLayoutDoc(docId!);

  return (
    <Link
      to={`${doc?.path ?? "#"}${hash ?? ""}`}
      className={clsx(styles.root, styles.linked)}
    >
      {children}
    </Link>
  );
}

function RelativeCardLink({ href, children }: CardLinkProps): JSX.Element {
  const { activeDoc, activeVersion } = useActiveDocContext(undefined);
  const to = resolveDocRelativeHref(href!, activeDoc, activeVersion);

  return (
    <Link to={to} className={clsx(styles.root, styles.linked)}>
      {children}
    </Link>
  );
}

function CardLink({
  href,
  docId,
  hash,
  children,
}: CardLinkProps): JSX.Element {
  if (docId) {
    return (
      <DocIdCardLink docId={docId} hash={hash}>
        {children}
      </DocIdCardLink>
    );
  }

  if (href && isRelativePath(href)) {
    return <RelativeCardLink href={href}>{children}</RelativeCardLink>;
  }

  return (
    <Link to={href!} className={clsx(styles.root, styles.linked)}>
      {children}
    </Link>
  );
}

/**
 * `<Card>` — a standalone bordered card for MDX docs. Use inside a
 * `<CardGrid>` for grouped layouts, or drop it inline for single-link cards.
 */
export default function Card({
  title,
  href,
  docId,
  hash,
  icon,
  eyebrow,
  children,
}: CardProps): JSX.Element {
  const inner = (
    <>
      {icon ? (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <h3 className={styles.title}>{title}</h3>
      {children ? <div className={styles.body}>{children}</div> : null}
      {href || docId ? (
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );

  if (href || docId) {
    return (
      <CardLink href={href} docId={docId} hash={hash}>
        {inner}
      </CardLink>
    );
  }

  return <div className={styles.root}>{inner}</div>;
}
