import React, { useState } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HeroVisual from "@site/src/components/HeroVisual";
import styles from "./index.module.css";

type Path = {
  eyebrow: string;
  title: string;
  desc: string;
  to: string;
  meta: string;
  primary?: boolean;
};

const INSTALL_COMMAND = "cargo install midenup && midenup init";

const PATHS: Path[] = [
  {
    eyebrow: "Recommended start",
    title: "Build your first smart contract",
    desc: "Create an account component in Rust, compile it to MASM, and prove its state transition locally before sending it to the network.",
    to: "/builder/get-started/your-first-smart-contract",
    meta: "Rust · MASM · client-side proving",
    primary: true,
  },
  {
    eyebrow: "SDK integration",
    title: "Connect an application",
    desc: "Use the Web, React, or Rust client to create accounts, move assets, and work with private notes.",
    to: "/builder/tools",
    meta: "Web · React · Rust",
  },
  {
    eyebrow: "Protocol and research",
    title: "Understand how Miden works",
    desc: "Trace execution through accounts, notes, the VM, and the recursive proof system.",
    to: "/reference",
    meta: "Protocol · VM · proofs",
  },
];

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const [commandCopied, setCommandCopied] = useState(false);

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCommandCopied(true);
      window.setTimeout(() => setCommandCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked in embedded previews.
    }
  };

  return (
    <Layout
      title={siteConfig.title}
      description="Build verifiable, private applications on Miden — a zk-first layer 2 with client-side proving and native privacy."
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
                commitments go onchain.
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
              <div className={styles.installCommand}>
                <div className={styles.installCommandHeader}>
                  <span>Install the toolchain</span>
                  <span>Rust + Cargo</span>
                </div>
                <div className={styles.installCommandBody}>
                  <code>
                    <span aria-hidden="true">$</span> {INSTALL_COMMAND}
                  </code>
                  <button
                    type="button"
                    onClick={copyInstallCommand}
                    className={styles.copyCommand}
                    aria-label="Copy the midenup install command"
                  >
                    <span aria-hidden="true">{commandCopied ? "✓" : "⎘"}</span>
                    <span aria-live="polite">
                      {commandCopied ? "Copied" : "Copy"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* ---- PATHS ---- */}
        <section className={styles.section}>
          <p className={styles.sectionEyebrow}>Start a path</p>
          <h2 className={styles.sectionTitle}>Choose what you need next.</h2>
          <div className={styles.pathGrid}>
            {PATHS.map((path) => (
              <Link
                key={path.to}
                to={path.to}
                className={`${styles.pathCard} ${
                  path.primary ? styles.pathCardPrimary : ""
                }`}
              >
                <span className={styles.pathEyebrow}>{path.eyebrow}</span>
                <h3 className={styles.pathTitle}>{path.title}</h3>
                <p className={styles.pathDesc}>{path.desc}</p>
                <span className={styles.pathMeta}>{path.meta}</span>
                <span className={styles.pathArrow} aria-hidden="true">→</span>
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
