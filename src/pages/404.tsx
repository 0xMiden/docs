import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./404.module.css";

export default function NotFound(): JSX.Element {
  return (
    <Layout
      title="Page not found"
      description="The page you were looking for doesn't exist on docs.miden.xyz."
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowCode}>404</span>
              <span className={styles.eyebrowDivider}>·</span>
              <span>Not found</span>
            </div>
            <h1 className={styles.title}>This page is a ghost.</h1>
            <p className={styles.sub}>
              The page you tried to reach doesn&apos;t exist — it may have
              moved in the v0.14 docs reshuffle, or the URL was mistyped.
              Try one of these instead:
            </p>

            <div className={styles.ctaRow}>
              <Link to="/builder" className={styles.ctaPrimary}>
                Go to Builder docs
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/" className={styles.ctaSecondary}>
                Back to home
              </Link>
            </div>

            <div className={styles.suggested}>
              <p className={styles.suggestedLabel}>Popular pages</p>
              <ul className={styles.suggestedList}>
                <li>
                  <Link to="/builder/get-started">Get started</Link>
                  <span>Install midenup and run your first transaction.</span>
                </li>
                <li>
                  <Link to="/builder/smart-contracts">Smart contracts</Link>
                  <span>Reference for building contracts in Rust.</span>
                </li>
                <li>
                  <Link to="/builder/migration">v0.14 migration guide</Link>
                  <span>Breaking changes and renames since v0.13.</span>
                </li>
                <li>
                  <Link to="/reference">Reference</Link>
                  <span>Protocol, VM, compiler, and node architecture.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
