import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useDocsPreferredVersion, useVersions} from '@docusaurus/plugin-content-docs/client';
import styles from './index.module.css';

const milestones = [
  {title: 'Set up', detail: 'Install the toolchain and check your environment.', path: '/builder/get-started/setup/installation'},
  {title: 'Write', detail: 'Create a Rust project and define your counter account.', path: '/builder/get-started/your-first-smart-contract/create'},
  {title: 'Test', detail: 'Validate the contract locally before submitting a transaction.', path: '/builder/get-started/your-first-smart-contract/test'},
  {title: 'Deploy', detail: 'Deploy your account and inspect the resulting transaction.', path: '/builder/get-started/your-first-smart-contract/deploy'},
];
const sdks = [
  ['TypeScript', 'Web SDK', 'Accounts and transactions for your web app.', '/builder/tools/clients/web-client/'],
  ['React', 'React SDK', 'Hooks and components for your application.', '/builder/tools/clients/react-sdk/'],
  ['Rust', 'Rust client', 'Native applications and backend services.', '/builder/tools/clients/rust-client/'],
];
const resources = [
  ['Tutorials & recipes', 'Build from a working example.', '/builder/tutorials/'],
  ['Protocol reference', 'Accounts, notes, transactions and proofs.', '/reference/'],
  ['Network & tools', 'Endpoints, faucets and developer tools.', '/builder/tools/network'],
  ['Migration guides', 'Update an existing project.', '/builder/migration/'],
];
const command = 'cargo install midenup && midenup init';

const transactionStages = [
  {title: 'Execute', heading: 'Your application changes an account.', description: 'Execute a transaction locally using the account state and input notes.', path: '/reference/protocol/transaction'},
  {title: 'Prove', heading: 'A proof attests to the state transition.', description: 'Prove that execution followed the account code and protocol rules.', path: '/reference/protocol/transaction'},
  {title: 'Verify', heading: 'The network verifies and settles.', description: 'Submit the transaction proof and required public data to the network.', path: '/reference/protocol/transaction'},
];

function TransactionModel({route}: {route: (path: string) => string}) {
  const [stage, setStage] = useState(0);
  const assetBase = useBaseUrl('/brand/miden/');
  const images = ['local-transactions.png', 'transaction-proof.png', 'network-verification.png'];
  return <section className={styles.model} aria-labelledby="model-heading" data-stage={stage}>
    <h2 id="model-heading">From your account to the network</h2>
    <figure className={styles.modelFigure}>
      <div className={styles.modelCanvas}>
        {images.map((image, index) => <img key={image} src={assetBase + image} width="1600" height="400" alt="" aria-hidden="true" className={stage === index ? styles.activeIllustration : styles.illustration}/>) }
      </div>
      <div className={styles.modelControls} role="group" aria-label="Transaction flow stages">
        {transactionStages.map((item, index) => <button key={item.title} aria-label={item.title} aria-pressed={stage === index} onClick={() => setStage(index)}>
          <span className={styles.stageNumber} aria-hidden="true">0{index + 1}</span>
          <span>{item.title}</span>
        </button>)}
      </div>
      <figcaption className={styles.modelExplanation}>
        <div className={styles.explanationStack}>
          {transactionStages.map((item, index) => <div key={item.title} className={styles.explanation} aria-hidden={stage !== index} inert={stage !== index}>
            <h3>{item.heading}</h3><p>{item.description}</p>
            <Link to={route(item.path)}>Read about transactions <span aria-hidden="true">↗</span></Link>
          </div>)}
        </div>
        <p className={styles.caption}>Illustrated transaction flow. No live network activity.</p>
      </figcaption>
    </figure>
  </section>;
}

function Workbench() {
  const availableVersions = useVersions(undefined);
  const {preferredVersion, savePreferredVersionName} = useDocsPreferredVersion();
  const stableVersion = availableVersions.find(version => version.isLast)!;
  const selectedVersion = preferredVersion?.name === 'current' ? preferredVersion : stableVersion;
  const current = selectedVersion.name === 'current';
  const [mode, setMode] = useState<'manual' | 'agent'>('manual');
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const route = (path: string) => `${selectedVersion.path.replace(/\/$/, '')}${path}`;
  const agentPrompt = `Use the Miden ${current ? 'current (unstable)' : stableVersion.label} documentation at https://docs.miden.xyz${current ? '/next' : ''}/builder/agentic/. Help me follow the first smart contract tutorial. Check prerequisites and version compatibility, explain each change, and validate locally before deployment. Ask before submitting a network transaction. Do not invent tools or test results.`;
  async function copy(text: string) {
    clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(text); setStatus('Copied to clipboard'); }
    catch { setStatus('Could not copy. Select the text and copy it manually.'); }
    timer.current = setTimeout(() => setStatus(''), 4000);
  }
  function selectMode(nextMode: 'manual' | 'agent') { setMode(nextMode); setStatus(''); }
  return <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.intro}>
          <p className={styles.label}>Miden documentation</p>
          <h1 id="hero-title">Build your first <br/>Miden application.</h1>
          <p className={styles.lead}>Start with a programmable account. Write your contract in Rust, prove transactions locally, and connect your application to the network.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} to={route('/builder/get-started/')}>Start manually</Link>
            <button className={styles.secondary} onClick={() => {selectMode('agent'); document.getElementById('agent-tab')?.focus();}}>Use an agent</button>
          </div>
        </div>

        <div className={styles.workbench}>
          <div className={styles.panelHeader}><strong>Your starting point</strong><label>Docs version<select aria-label="Setup documentation version" value={current ? 'current' : 'stable'} onChange={e => {savePreferredVersionName(e.target.value === 'current' ? 'current' : stableVersion.name); setStatus('');}}><option value="stable">{stableVersion.label} stable</option><option value="current">Current · unstable</option></select></label></div>
          <div className={styles.tabs} role="tablist" aria-label="Setup method">
            {(['manual', 'agent'] as const).map(item => <button key={item} id={`${item}-tab`} role="tab" aria-selected={mode === item} aria-controls={`setup-panel-${item}`} tabIndex={mode === item ? 0 : -1} onClick={() => selectMode(item)} onKeyDown={e => {if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {e.preventDefault(); const next = e.key === 'Home' ? 'manual' : e.key === 'End' ? 'agent' : mode === 'manual' ? 'agent' : 'manual'; selectMode(next); document.getElementById(`${next}-tab`)?.focus();}}}>{item === 'manual' ? 'Manual setup' : 'Agent-assisted'}</button>)}
          </div>
          <div className={styles.panelBody}>
            <div className={styles.panelStack}>
              <div id="setup-panel-manual" role="tabpanel" aria-labelledby="manual-tab" aria-hidden={mode !== 'manual'} inert={mode !== 'manual'} className={styles.panelSlot}>
                <h2>Install the Miden toolchain</h2>
                <p>Requires Rust and Cargo. Follow the versioned guide to select a compatible toolchain.</p>
                <div className={styles.code}><code>{command}</code><button onClick={() => copy(command)} aria-label="Copy installation command">Copy</button></div>
                <Link className={styles.guide} to={route('/builder/get-started/setup/installation')}>Read the installation guide <span aria-hidden="true">↗</span></Link>
                <p className={styles.note}>Then verify your installation with <code>miden --version</code>.</p>
                <div className={styles.nextStep}><Link className={styles.guide} to={route('/builder/get-started/your-first-smart-contract/create')}>Next: create your first contract <span aria-hidden="true">↗</span></Link></div>
              </div>
              <div id="setup-panel-agent" role="tabpanel" aria-labelledby="agent-tab" aria-hidden={mode !== 'agent'} inert={mode !== 'agent'} className={styles.panelSlot}>
                <h2>Bring the docs to your agent</h2>
                <p>Copy this starting prompt into your coding assistant. Review generated code and run the tutorial’s checks locally.</p>
                <div className={styles.prompt}>{agentPrompt}</div>
                <button className={styles.copyPrompt} onClick={() => copy(agentPrompt)}>Copy starting prompt</button>
                <p className={styles.note}><Link className={styles.guide} to={route('/builder/agentic/')}>Read the agent-assisted guide <span aria-hidden="true">↗</span></Link>. This prompt does not install or run an agent.</p>
              </div>
            </div>
            <div className={styles.status}><span className={styles.statusSizer} aria-hidden="true">Could not copy. Select the text and copy it manually.</span><span className={styles.statusMessage} role="status">{status}</span></div>
          </div>
        </div>
      </section>
      <TransactionModel route={route}/>
      <section className={styles.walkthrough} aria-labelledby="contract-title">
        <div className={styles.sectionHeading}><div><p className={styles.label}>One walkthrough</p><h2 id="contract-title">Your first smart contract</h2></div><Link to={route('/builder/get-started/your-first-smart-contract/')}>Open the full tutorial <span aria-hidden="true">↗</span></Link></div>
        <div className={styles.milestones} aria-label="Tutorial milestones">{milestones.map((item, i) => <button key={item.title} aria-pressed={step === i} onClick={() => setStep(i)}><span>{i + 1}</span>{item.title}</button>)}</div>
        <div className={styles.stepDetail} aria-live="polite"><p><strong>{milestones[step].title}.</strong> {milestones[step].detail}</p><Link to={route(milestones[step].path)}>Read the {milestones[step].title.toLowerCase()} guide <span aria-hidden="true">↗</span></Link></div>
      </section>
      <section className={styles.sdkSection} aria-labelledby="sdk-title"><h2 id="sdk-title">Connect your application</h2><div className={styles.sdkGrid}>{sdks.map(([language, title, detail, path]) => <Link key={title} className={styles.sdk} to={route(path)}><span className={styles.language}>{language}</span><h3>{title}<span aria-hidden="true">↗</span></h3><p>{detail}</p></Link>)}</div></section>
      <section className={styles.resources} aria-label="More documentation">{resources.map(([title, detail, path]) => <Link key={title} to={route(path)}><h3>{title}<span aria-hidden="true">↗</span></h3><p>{detail}</p></Link>)}</section>
    </main>;
}

export default function Home() {
  return <Layout wrapperClassName={styles.frame} title="Miden Docs" description="Build on Miden with versioned setup guides, smart contract tutorials, SDKs and protocol reference."><Workbench /></Layout>;
}
