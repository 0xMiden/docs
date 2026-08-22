---
sidebar_position: 0
title: Quick Start
description: Get started with Miden by installing Miden tools using the `midenup` toolchain, creating your first wallet, performing basic operations, and building your first smart contract!
pagination_prev: null
---

# Quick Start

Welcome to Miden! This guide gets you up and running with the Miden blockchain by walking through the essential setup and core operations.

## What is Miden?

Miden is a privacy-focused, ZK-based blockchain that uses an actor model where each account is a smart contract. Unlike traditional blockchains where accounts simply hold balances, Miden accounts are programmable entities that can execute custom logic, store data, and manage assets autonomously.

Key concepts you'll encounter:

- **Accounts**: smart contracts that hold assets and execute code
- **Notes**: messages that exchange data and assets between accounts — also programmable
- **Assets**: tokens that can be fungible or non-fungible
- **Privacy**: every transaction, note, and account in Miden is private by default — only the involved parties can view asset amounts or transfer details

## Getting started

Follow these guides in order:

<CardGrid cols={2}>
  <Card title="Installation" docId="builder/get-started/setup/installation" eyebrow="1. Set up">
    Install the Miden toolchain with `midenup`.
  </Card>
  <Card title="CLI basics" docId="builder/get-started/setup/cli-basics" eyebrow="2. CLI">
    Essential Miden CLI commands — create a wallet and mint your first tokens.
  </Card>
  <Card title="Accounts" docId="builder/get-started/accounts" eyebrow="3. Programmatic">
    Create and manage Miden accounts programmatically in Rust and TypeScript.
  </Card>
  <Card title="Notes & transactions" docId="builder/get-started/notes" eyebrow="4. Transfers">
    Miden's note-based transaction model for private asset transfers.
  </Card>
  <Card title="Read storage" docId="builder/get-started/read-storage" eyebrow="5. Query">
    Query account storage data and interact with deployed smart contracts.
  </Card>
  <Card title="Your first smart contract" docId="builder/get-started/your-first-smart-contract/index" eyebrow="6. Build">
    Build, test, and deploy a smart contract on Miden using Rust.
  </Card>
</CardGrid>
