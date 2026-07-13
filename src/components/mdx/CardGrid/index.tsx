import React, { type ReactNode } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

type CardGridProps = {
  cols?: 2 | 3 | 4;
  children?: ReactNode;
};

export default function CardGrid({
  cols = 3,
  children,
}: CardGridProps): JSX.Element {
  return (
    <div className={clsx(styles.grid, styles[`cols-${cols}`])}>
      {children}
    </div>
  );
}
