import React, { type ReactNode } from "react";
import styles from "./styles.module.css";

type KbdProps = {
  children?: ReactNode;
};

export default function Kbd({ children }: KbdProps): JSX.Element {
  return <kbd className={styles.root}>{children}</kbd>;
}
