---
sidebar_label: Introduction
sidebar_position: 0
---

# Miden Documentation

![Miden Docs Background](/img/docs-background.png)

Miden is a zero-knowledge rollup for high-throughput, private applications. Build payments, DeFi, and asset management apps secured by Ethereum and Agglayer.

:::note
Miden is currently on **v0.13** – approaching mainnet readiness for the 2026 launch. Breaking changes may still occur in some components.
:::

### Why Miden?

- **Privacy by default** – Accounts and notes are private, with the network only storing cryptographic commitments
- **Client-side execution** – Transactions are executed and proven locally, enabling parallel processing and lower fees
- **Programmable everything** – Accounts are smart contracts, and notes can contain arbitrary logic
- **Ethereum security** – Settled on Ethereum with validity proofs via the Agglayer

### Key Concepts

- **Accounts** – Smart contracts that hold assets and execute custom logic
- **Notes** – Programmable messages that transfer assets between accounts
- **Transactions** – State changes proven locally using zero-knowledge proofs

import DocCard from '@theme/DocCard';

## Getting Started

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './get-started',
        label: 'Get Started',
        description: 'Install Miden tools, create your first wallet, and build your first transaction.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './get-started/setup/installation',
        label: 'Installation',
        description: 'Set up your development environment with the midenup toolchain.',
      }}
    />
  </div>
</div>

## Build on Miden

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './tutorials',
        label: 'Tutorials',
        description: 'Step-by-step guides for building applications on Miden.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './tools',
        label: 'Tools',
        description: 'Miden Client libraries, CLI, and developer tooling.',
      }}
    />
  </div>
</div>

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './migration',
        label: 'Migration',
        description: 'Upgrade guides for migrating between Miden versions.',
      }}
    />
  </div>
</div>

## Resources

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './faq',
        label: 'FAQ',
        description: 'Frequently asked questions about Miden.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './glossary',
        label: 'Glossary',
        description: 'Key terms and definitions used in Miden.',
      }}
    />
  </div>
</div>

### Community

- [Telegram](https://t.me/BuildOnMiden) – Join the technical discussion
- [GitHub](https://github.com/0xMiden) – Explore the source code
- [Roadmap](https://miden.xyz/roadmap) – See what's coming next

---

Licensed under the [MIT License](http://opensource.org/licenses/MIT).
