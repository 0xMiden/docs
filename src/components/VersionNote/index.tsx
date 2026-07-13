import React from "react";
import styles from "./styles.module.css";

interface VersionNoteProps {
  subject?: string;
  stableVersion?: string;
}

export default function VersionNote({
  subject = "Full documentation",
  stableVersion = "v0.14",
}: VersionNoteProps): JSX.Element {
  return (
    <div className={styles.container}>
      <p className={styles.text}>
        You're viewing the <strong>development version</strong>. {subject} is
        available in released versions. Select <strong>{stableVersion}</strong>{" "}
        from the version dropdown above for the latest stable docs.
      </p>
    </div>
  );
}
