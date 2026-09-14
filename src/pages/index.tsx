import React, { useEffect, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import HeroVisual from "@site/src/components/HeroVisual";
import styles from "./index.module.css";

const INSTALL_COMMAND = "cargo install midenup && midenup init";
const CLIENTS = [
  { title: "Web SDK", detail: "Accounts and transactions in TypeScript", label: "TS", to: "/builder/tools/clients/web-client/" },
  { title: "React SDK", detail: "Hooks and components for your app", label: "React", to: "/builder/tools/clients/react-sdk/" },
  { title: "Rust client", detail: "Native applications and backend services", label: "Rust", to: "/builder/tools/clients/rust-client/" },
];
const RESOURCES = [
  { title: "Tutorials & recipes", detail: "Working examples for your next feature.", to: "/builder/tutorials/" },
  { title: "Protocol reference", detail: "Accounts, notes, the VM, and the proof system.", to: "/reference/" },
  { title: "Network & tools", detail: "Testnet endpoints, faucets, and developer tools.", to: "/builder/tools/network" },
  { title: "Migration guides", detail: "Bring an existing project to the latest release.", to: "/builder/migration/" },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.arrow}>
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InstallCommand() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyCommand() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    resetTimer.current = setTimeout(() => setCopyState("idle"), 3500);
  }

  return (
    <div className={styles.install}>
      <div className={styles.installLabel}>
        <Link to="/builder/tools/midenup">Install midenup</Link>
        <span>Requires Rust + Cargo</span>
      </div>
      <div className={styles.commandRow}>
        <span className={styles.prompt} aria-hidden="true">$</span>
        <code>{INSTALL_COMMAND}</code>
        <button type="button" onClick={copyCommand} className={styles.copyButton} aria-label="Copy midenup installation command">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {copyState === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>}
          </svg>
        </button>
      </div>
      <span className={styles.copyStatus} role="status">{copyState === "copied" ? "Copied to clipboard" : copyState === "error" ? "Couldn’t copy. Select the command to copy it manually." : ""}</span>
    </div>
  );
}

export default function Home() {
  return (
    <Layout title="Miden Docs" description="Build on Miden with smart contract tutorials, client SDKs, and protocol documentation. Your starting point for private applications.">
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowMark} aria-hidden="true" />Miden documentation</p>
            <h1 id="hero-title">Build with privacy.<br /><span>Start with Miden.</span></h1>
            <p className={styles.heroDescription}>Programmable accounts. Private notes. Client-side proofs. Everything you need to build an application on Miden.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} to="/builder/get-started/">Start building <Arrow /></Link>
              <Link className={styles.textLink} to="/builder/smart-contracts/">Explore the concepts <Arrow /></Link>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className={styles.buildSection} aria-label="Start building on Miden">
          <div className={styles.firstBuild}>
            <p className={styles.eyebrow}>Start here</p>
            <Link to="/builder/get-started/your-first-smart-contract/" className={styles.featureTitle}>
              <h2>Your first smart contract</h2><Arrow />
            </Link>
            <p>Write a counter in Rust, test it locally, then deploy it to the network. One walkthrough, from setup to your first transaction.</p>
            <ol className={styles.steps} aria-label="Smart contract walkthrough">
              <li><Link to="/builder/get-started/your-first-smart-contract/create"><span>01</span>Write <Arrow /></Link></li>
              <li><Link to="/builder/get-started/your-first-smart-contract/test"><span>02</span>Test <Arrow /></Link></li>
              <li><Link to="/builder/get-started/your-first-smart-contract/deploy"><span>03</span>Deploy <Arrow /></Link></li>
            </ol>
            <InstallCommand />
          </div>

          <div className={styles.clients}>
            <p className={styles.eyebrow}>Client SDKs</p>
            <h2>Connect your application</h2>
            <p>Work with accounts, assets, and notes in your stack.</p>
            <div className={styles.clientLinks}>
              {CLIENTS.map(client => (
                <Link className={styles.clientLink} to={client.to} key={client.title}>
                  <span className={styles.clientBadge} aria-hidden="true">{client.label}</span>
                  <span><strong>{client.title}</strong><span className={styles.linkDescription}>{client.detail}</span></span>
                  <Arrow />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.resources} aria-labelledby="resources-title">
          <div className={styles.sectionHeading}>
            <h2 id="resources-title">Keep building.</h2>
            <p>Find an example, look something up, or take the next step.</p>
          </div>
          <div className={styles.resourceLinks}>
            {RESOURCES.map(resource => (
              <Link className={styles.resourceLink} to={resource.to} key={resource.title}>
                <span><h3>{resource.title}</h3><span className={styles.linkDescription}>{resource.detail}</span></span>
                <Arrow />
              </Link>
            ))}
          </div>
        </section>

        <aside className={styles.community} aria-label="Community support">
          <div><h2>Building something? We’re here to help.</h2><p>Ask a question, share what you’re working on, or help improve the docs.</p></div>
          <div className={styles.communityLinks}>
            <Link className={styles.textLink} href="https://github.com/0xMiden/">Explore GitHub <Arrow diagonal /></Link>
            <Link className={styles.textLink} href="https://t.me/BuildOnMiden">Join the community <Arrow diagonal /></Link>
          </div>
        </aside>
      </main>
    </Layout>
  );
}
