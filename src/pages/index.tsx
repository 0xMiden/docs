import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HeroVisual from "@site/src/components/HeroVisual";
import styles from "./index.module.css";

type Role = {
  eyebrow: string;
  title: string;
  desc: string;
  to: string;
};

const ROLES: Role[] = [
  {
    eyebrow: "Smart contract dev",
    title: "Build contracts in Rust",
    desc: "Accounts, notes, and transactions with the Miden SDK — private by default, typed storage, client-side proving. Compile to MASM and deploy.",
    to: "/builder/smart-contracts",
  },
  {
    eyebrow: "Integrating Miden",
    title: "Wire Miden into your app",
    desc: "Web and React SDKs for wallet flows, private notes, and client-side proving. Signer integrations out of the box.",
    to: "/builder/tools",
  },
  {
    eyebrow: "Protocol curious",
    title: "Understand the zkVM",
    desc: "Protocol specs, VM internals, constraints, and the path from Rust → MASM → proof.",
    to: "/core-concepts",
  },
  {
    eyebrow: "zk researcher",
    title: "Dig into Miden VM",
    desc: "Execution trace, chiplets, advice provider, and the recursive proof pipeline.",
    to: "/core-concepts/miden-vm",
  },
];

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title={siteConfig.title}
      description="Build verifiable, private applications on Miden — a zk-first Layer 1 with client-side proving and native privacy."
    >
      <main className={styles.page}>
        {/* ---- HERO ---- */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowDot} aria-hidden="true" />
                Private by default · Scalable by design
              </div>
              <h1 className={styles.heroTitle}>
                Build scalable, private applications.
              </h1>
              <p className={styles.heroSub}>
                A zero-knowledge layer 2 with client-side proving.
                Accounts and notes are private by default — only
                commitments go on-chain.
              </p>
              <div className={styles.ctaRow}>
                <Link
                  to="/builder/get-started"
                  className={styles.ctaPrimary}
                >
                  Start building
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  to="/builder/tools/midenup"
                  className={styles.ctaSecondary}
                >
                  Install midenup <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* ---- ROLE CARDS ---- */}
        <section className={styles.section}>
          <p className={styles.sectionEyebrow}>Start a path</p>
          <h2 className={styles.sectionTitle}>Pick where you land.</h2>
          <div className={styles.roleGrid}>
            {ROLES.map((r) => (
              <Link key={r.to} to={r.to} className={styles.roleCard}>
                <span className={styles.roleEyebrow}>{r.eyebrow}</span>
                <h3 className={styles.roleTitle}>{r.title}</h3>
                <p className={styles.roleDesc}>{r.desc}</p>
                <span className={styles.roleArrow} aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- TRY IT NOW ---- */}
        <section className={styles.tryItNow}>
          <div className={styles.tryItNowInner}>
            <div className={styles.tryItNowCopy}>
              <p className={styles.sectionEyebrow}>Peek under the hood</p>
              <h2 className={styles.sectionTitle}>
                A counter account, in Rust.
              </h2>
              <p className={styles.heroSub}>
                Smart contracts on Miden are plain Rust crates. Storage is
                typed, functions are `#[component]`-annotated, and state
                transitions are proved client-side before submission to
                the network.
              </p>
              <div className={styles.ctaRow}>
                <Link
                  to="/builder/get-started/your-first-smart-contract/create"
                  className={styles.ctaPrimary}
                >
                  Follow the tutorial
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <div className={styles.codeShell}>
              <div className={styles.codeShellHeader}>
                <span className={styles.codeShellDot} />
                <span className={styles.codeShellDot} />
                <span className={styles.codeShellDot} />
                <span className={styles.codeShellName}>
                  contracts/counter/src/lib.rs
                </span>
              </div>
              <pre className={styles.codeShellBody}>
                <code>
                  <span className={styles.codeKw}>use</span> miden::
                  {"{"}component, Felt, StorageMap, StorageMapAccess, Word
                  {"}"};{"\n\n"}
                  #[<span className={styles.codeFn}>component</span>]{"\n"}
                  <span className={styles.codeKw}>struct</span>{" "}
                  <span className={styles.codeFn}>CounterContract</span> {"{"}
                  {"\n"}
                  {"    "}#[<span className={styles.codeFn}>storage</span>
                  (description = <span className={styles.codeStr}>
                  &quot;counter contract storage map&quot;</span>)]{"\n"}
                  {"    "}count_map: StorageMap,{"\n"}
                  {"}"}{"\n\n"}
                  #[<span className={styles.codeFn}>component</span>]{"\n"}
                  <span className={styles.codeKw}>impl</span>{" "}
                  CounterContract {"{"}{"\n"}
                  {"    "}
                  <span className={styles.codeCom}>
                    /// Increments the counter by one.
                  </span>
                  {"\n"}
                  {"    "}<span className={styles.codeKw}>pub fn</span>{" "}
                  <span className={styles.codeFn}>increment_count</span>(&
                  <span className={styles.codeKw}>mut self</span>) -&gt; Felt{" "}
                  {"{"}{"\n"}
                  {"        "}
                  <span className={styles.codeKw}>let</span> key ={" "}
                  Word::from_u64_unchecked(0, 0, 0, 1);{"\n"}
                  {"        "}
                  <span className={styles.codeKw}>let</span> next:
                  Felt = self.count_map.get(&amp;key) + Felt::
                  <span className={styles.codeFn}>from_u32</span>(1);{"\n"}
                  {"        "}self.count_map.set(key, next);{"\n"}
                  {"        "}next{"\n"}
                  {"    "}{"}"}{"\n"}
                  {"}"}
                </code>
              </pre>
              <div className={styles.codeAction}>
                <Link to="https://playground.miden.xyz">
                  Run in playground ↗
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
    </Layout>
  );
}
