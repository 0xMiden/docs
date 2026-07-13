import React, { type ReactNode } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

type Tone =
  | "brand"
  | "neutral"
  | "signal"
  | "success"
  | "warn"
  | "danger";

type Variant = "solid" | "soft" | "outline";

type BadgeProps = {
  tone?: Tone;
  variant?: Variant;
  children?: ReactNode;
};

export default function Badge({
  tone = "neutral",
  variant = "soft",
  children,
}: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        styles.root,
        styles[`tone-${tone}`],
        styles[`variant-${variant}`],
      )}
    >
      {children}
    </span>
  );
}
