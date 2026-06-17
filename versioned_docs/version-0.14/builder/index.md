---
sidebar_label: Introduction
sidebar_position: 0
pagination_next: null
---

# Build on Miden

Accounts, notes, and transactions — authored in Rust, compiled to MASM, proved client-side.

## Start here

<CardGrid cols={2}>
  <Card title="Get started" href="./get-started" eyebrow="Install & run">
    Install midenup, create a wallet, and send your first transaction — in under ten minutes.
  </Card>
  <Card title="Your first smart contract" href="./get-started/your-first-smart-contract" eyebrow="Tutorial">
    Walk through writing, proving, and deploying a counter contract in Rust.
  </Card>
</CardGrid>

## Build

<CardGrid cols={2}>
  <Card title="Smart contracts" href="./smart-contracts" eyebrow="Reference">
    Accounts, notes, storage, components, transactions — the full Rust SDK surface.
  </Card>
  <Card title="Tutorials" href="./tutorials" eyebrow="Walkthroughs">
    Real-world examples: the Miden Bank, private multisig, custom note scripts.
  </Card>
  <Card title="Development helpers" href="./tutorials#development-helpers" eyebrow="How-to">
    Testing, debugging, and common pitfalls when writing Miden programs.
  </Card>
  <Card title="Tools" href="./tools" eyebrow="Clients & CLI">
    Rust, Web, and React SDKs · playground · block explorer · CLI.
  </Card>
</CardGrid>

## Ship

<CardGrid cols={2}>
  <Card title="Migration" href="./migration" eyebrow="v0.13 → v0.14">
    Breaking changes, renames, and new features across accounts, notes, transactions, MASM, and the client.
  </Card>
  <Card title="Miden Guardian" href="./miden-guardian" eyebrow="Account state">
    Backup, sync, and coordinate private account state across devices.
  </Card>
  <Card title="Private multisig" href="./private-multisig" eyebrow="Solutions">
    Multi-party threshold signature workflows built on Miden.
  </Card>
</CardGrid>

## Reference

<CardGrid cols={2}>
  <Card title="FAQ" href="./faq" eyebrow="Questions">
    Frequently asked questions about Miden.
  </Card>
  <Card title="Glossary" href="./glossary" eyebrow="Terminology">
    Key terms and definitions used throughout the docs.
  </Card>
</CardGrid>

## Community

- [Telegram](https://t.me/BuildOnMiden) — technical discussion
- [GitHub](https://github.com/0xMiden) — source code
- [Roadmap](https://miden.xyz/roadmap) — what's coming next

import SectionLinks from '@site/src/components/SectionLinks';

<SectionLinks
  title="Explore the reference"
  links={[
    { href: '../reference', label: 'Architecture overview', description: 'Actor model, state design, and protocol fundamentals' },
    { href: '../reference#protocol', label: 'Protocol reference', description: 'Accounts, notes, state model, and transaction semantics' },
    { href: '../reference#virtual-machine-miden-vm', label: 'Virtual machine', description: 'STARK-based VM, chiplets, and Miden Assembly' },
  ]}
/>

---

Licensed under the [MIT License](http://opensource.org/licenses/MIT).
