import React, { useState } from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import styles from "./styles.module.css";

type Feedback = "idle" | "yes" | "no";

function formatRelativeDate(input: number | string | undefined): string | null {
  if (!input) return null;
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.round(diff / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export default function PageActions(): JSX.Element | null {
  const doc = useDoc();
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [copied, setCopied] = useState(false);

  const lastUpdate =
    doc?.metadata?.lastUpdatedAt ?? doc?.metadata?.frontMatter?.last_update;
  const updatedLabel =
    formatRelativeDate(lastUpdate as number | string | undefined);

  const editUrl = doc?.metadata?.editUrl;

  const handleCopy = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop — clipboard may be blocked in iframe previews */
    }
  };

  const handleFeedback = (v: "yes" | "no") => {
    setFeedback(v);
    /* eslint-disable-next-line no-console */
    console.log("[page-feedback]", { url: window.location.pathname, value: v });
  };

  return (
    <aside className={styles.root} aria-label="Page actions">
      <div className={styles.row}>
        <div className={styles.meta}>
          {updatedLabel ? `Updated ${updatedLabel}` : null}
        </div>
        <div className={styles.actions}>
          {editUrl ? (
            <a
              className={styles.btn}
              href={editUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span aria-hidden="true">↗</span>
              <span>Edit on GitHub</span>
            </a>
          ) : null}
          <button
            type="button"
            className={styles.btn}
            onClick={handleCopy}
            aria-label="Copy page link"
          >
            <span aria-hidden="true">{copied ? "✓" : "⎘"}</span>
            <span>{copied ? "Copied" : "Copy link"}</span>
          </button>
        </div>
      </div>

      <div className={styles.helpful}>
        {feedback === "idle" ? (
          <>
            <span className={styles.helpfulLabel}>Was this page helpful?</span>
            <button
              type="button"
              className={styles.pill}
              onClick={() => handleFeedback("yes")}
              aria-label="Yes, this page was helpful"
            >
              <span aria-hidden="true">👍</span> Yes
            </button>
            <button
              type="button"
              className={styles.pill}
              onClick={() => handleFeedback("no")}
              aria-label="No, this page was not helpful"
            >
              <span aria-hidden="true">👎</span> No
            </button>
          </>
        ) : (
          <span className={styles.thanks}>
            Thanks for the feedback.
          </span>
        )}
      </div>
    </aside>
  );
}
