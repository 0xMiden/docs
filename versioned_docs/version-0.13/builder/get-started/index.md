---
sidebar_position: 0
title: Quick Start
description: Get started with Miden by installing Miden tools using the `midenup` toolchain, creating your first wallet, performing basic operations, and building your first smart contract!
---

# Quick Start

Welcome to Miden! This guide will get you up and running with the Miden blockchain by walking you through the essential setup and core operations.

## What is Miden?

Miden is a privacy-focused, ZK-based blockchain that uses an actor model where each account is a smart contract. Unlike traditional blockchains where accounts simply hold balances, Miden accounts are programmable entities that can execute custom logic, store data, and manage assets autonomously.

Key concepts you'll encounter:

- **Accounts**: Smart contracts that hold assets and execute code
- **Notes**: Messages that exchange data and assets between accounts - also programmable
- **Assets**: Tokens that can be fungible or non-fungible
- **Privacy**: Every transaction, note and account in Miden is private by default — only the involved parties can view asset amounts or transfer details, offering strong confidentiality guarantees.

## Getting Started

Follow these guides in order to get started with Miden:

import DocCard from '@theme/DocCard';

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './setup/installation',
        label: 'Installation',
        description: 'Get started with Miden development by installing Miden tools using the midenup toolchain.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './setup/cli-basics',
        label: 'CLI Basics',
        description: 'Learn essential Miden CLI commands to create your wallet and mint your first tokens.',
      }}
    />
  </div>
</div>

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './accounts',
        label: 'Accounts',
        description: 'Learn how to create and manage Miden accounts programmatically using Rust and TypeScript.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './notes',
        label: 'Notes & Transactions',
        description: 'Learn Miden\'s unique note-based transaction model for private asset transfers.',
      }}
    />
  </div>
</div>

<div className="row">
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './read-storage',
        label: 'Read Storage Values',
        description: 'Learn how to query account storage data and interact with deployed smart contracts.',
      }}
    />
  </div>
  <div className="col col--6">
    <DocCard
      item={{
        type: 'link',
        href: './your-first-smart-contract',
        label: 'Your First Smart Contract',
        description: 'Learn to build, test, and deploy smart contracts on Miden using Rust.',
      }}
    />
  </div>
</div>
