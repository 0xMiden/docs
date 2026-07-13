import React, { type ReactNode } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

type Variant = "note" | "tip" | "info" | "warn" | "danger" | "zk";

type CalloutProps = {
  variant?: Variant;
  title?: string;
  icon?: ReactNode;
  children?: ReactNode;
};

const VARIANT_LABEL: Record<Variant, string> = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warn: "Warning",
  danger: "Danger",
  zk: "Zero knowledge",
};

const ICON_PATHS: Record<Variant, ReactNode> = {
  note: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6.5v4" />
      <circle cx="10" cy="13.5" r=".5" fill="currentColor" />
    </>
  ),
  tip: (
    <>
      <path d="M7 14v-1.5A5.5 5.5 0 1 1 13 14v1.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" />
      <path d="M8 17h4" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5" />
      <circle cx="10" cy="6.5" r=".5" fill="currentColor" />
    </>
  ),
  warn: (
    <>
      <path d="M10 2.5 18 17H2L10 2.5Z" />
      <path d="M10 8v4" />
      <circle cx="10" cy="14.5" r=".5" fill="currentColor" />
    </>
  ),
  danger: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m7 7 6 6" />
      <path d="m13 7-6 6" />
    </>
  ),
  zk: (
    <>
      <path d="M10 2.5 3 5.5v5c0 4 3 6 7 7 4-1 7-3 7-7v-5L10 2.5Z" />
      <path d="m7 10 2 2 4-4" />
    </>
  ),
};

export default function Callout({
  variant = "note",
  title,
  icon,
  children,
}: CalloutProps): JSX.Element {
  const resolvedTitle = title ?? VARIANT_LABEL[variant];

  return (
    <aside
      className={clsx(styles.root, styles[`variant-${variant}`])}
      role={variant === "danger" || variant === "warn" ? "alert" : "note"}
    >
      <div className={styles.icon} aria-hidden="true">
        {icon ?? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICON_PATHS[variant]}
          </svg>
        )}
      </div>
      <div className={styles.body}>
        {resolvedTitle ? (
          <div className={styles.title}>{resolvedTitle}</div>
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </aside>
  );
}
