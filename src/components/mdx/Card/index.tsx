import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import clsx from "clsx";
import styles from "./styles.module.css";

type CardProps = {
  title: string;
  href?: string;
  icon?: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
};

/**
 * `<Card>` — a standalone bordered card for MDX docs. Use inside a
 * `<CardGrid>` for grouped layouts, or drop it inline for single-link cards.
 */
export default function Card({
  title,
  href,
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
      {href ? (
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={clsx(styles.root, styles.linked)}>
        {inner}
      </Link>
    );
  }

  return <div className={styles.root}>{inner}</div>;
}
