import React, { Children, isValidElement, type ReactNode } from "react";
import styles from "./styles.module.css";

type StepsProps = {
  children?: ReactNode;
};

/**
 * `<Steps>` wraps any number of direct children (ideally `<Step>` or ordered
 * list items). Each child is decorated with a monospaced 01 / 02 badge and
 * a vertical connector rail to the next step.
 */
export default function Steps({ children }: StepsProps): JSX.Element {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <ol className={styles.list}>
      {items.map((child, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.index} aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className={styles.body}>{child}</div>
        </li>
      ))}
    </ol>
  );
}
