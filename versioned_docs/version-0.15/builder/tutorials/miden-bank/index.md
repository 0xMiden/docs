---
sidebar_position: 4
title: "Building a Bank with Miden Rust"
description: "Learn Miden Rust compiler fundamentals by building a complete banking application with deposits, withdrawals, and asset management."
---

# Building a Bank with Miden Rust

Welcome to the **Miden Rust Compiler Tutorial**! This hands-on guide teaches you how to build smart contracts on Miden using Rust by walking through a complete banking application.

## What You'll Build

You'll create a **banking system** consisting of:

- **Bank Account Component**: A smart contract that manages depositor balances and vault operations
- **Deposit Note**: A note script that processes deposits into the bank
- **Withdraw Request Note**: A note script that requests withdrawals from the bank
- **Initialization Script**: A transaction script to deploy and initialize the bank

The tutorial includes runnable tests where appropriate — some parts are setup-only or conceptual, with the first runnable test in Part 4.

## Tutorial Structure

This tutorial is designed for hands-on learning. Each part builds on the previous one, and every part includes:

- **What You'll Build** - Clear objectives for the section
- **Step-by-step code** - Progressively building functionality
- **Verification steps** - Runnable tests, build checks, or code review
- **Complete code** - Full code listing for reference

### Parts Overview

<CardGrid cols={2}>
  <Card title="Project Setup" href="./project-setup" eyebrow="Part 0">
    Create your project with <code>miden new</code> and understand the workspace structure.
  </Card>
  <Card title="Account Components" href="./account-components" eyebrow="Part 1">
    Learn <code>#[component]</code>, Value storage, and StorageMap for managing state.
  </Card>
  <Card title="Constants & Constraints" href="./constants-constraints" eyebrow="Part 2">
    Define business rules with constants and validate with assertions.
  </Card>
  <Card title="Asset Management" href="./asset-management" eyebrow="Part 3">
    Handle fungible assets with vault operations and balance tracking.
  </Card>
  <Card title="Note Scripts" href="./note-scripts" eyebrow="Part 4">
    Write scripts that execute when notes are consumed.
  </Card>
  <Card title="Cross-Component Calls" href="./cross-component-calls" eyebrow="Part 5">
    Call account methods from note scripts via bindings.
  </Card>
  <Card title="Transaction Scripts" href="./transaction-scripts" eyebrow="Part 6">
    Write scripts for account initialization and owner operations.
  </Card>
  <Card title="Creating Output Notes" href="./output-notes" eyebrow="Part 7">
    Create P2ID notes programmatically for withdrawals.
  </Card>
  <Card title="Complete Flows" href="./complete-flows" eyebrow="Part 8">
    Walk through end-to-end deposit and withdraw operations.
  </Card>
</CardGrid>

## Prerequisites

Before starting this tutorial, ensure you have:

- Completed the [Get Started guide](https://docs.miden.xyz/builder/get-started/) (familiarity with `midenup`, `miden new`, basic tooling)
- Basic understanding of Miden concepts (accounts, notes, transactions)
- Rust programming experience

:::tip No Miden Rust Experience Required
This tutorial assumes no prior experience with the Miden Rust compiler. We'll explain each concept as we encounter it.
:::

## Concepts Covered

This tutorial covers the following Miden Rust compiler features:

| Concept                      | Description                                                | Part |
| ---------------------------- | ---------------------------------------------------------- | ---- |
| `#[component]`               | Define account components with storage                     | 1    |
| Storage Types                | `Value` for single values, `StorageMap` for key-value data | 1    |
| Constants                    | Define compile-time business rules                         | 2    |
| Assertions                   | Validate conditions and handle errors                      | 2    |
| Asset Handling               | Add and remove assets from account vaults                  | 3    |
| `#[note]` + `#[note_script]` | Note struct/impl pattern for scripts consumed by accounts  | 4    |
| Cross-Component Calls        | Call account methods from note scripts                     | 5    |
| `#[tx_script]`               | Transaction scripts for account operations                 | 6    |
| Output Notes                 | Create notes programmatically                              | 7    |

## Source Code

The complete source code for this tutorial is available in the [examples/miden-bank](https://github.com/0xMiden/miden-tutorials/tree/main/examples/miden-bank) directory of this repository:

```bash title=">_ Terminal"
git clone https://github.com/0xMiden/miden-tutorials.git
cd miden-tutorials/examples/miden-bank
```

## Getting Help

If you get stuck during this tutorial:

- Check the [Miden Docs](https://docs.miden.xyz) for detailed technical references
- Join the [Build On Miden](https://t.me/BuildOnMiden) Telegram community for support
- Review the complete code in the [examples/miden-bank](https://github.com/0xMiden/miden-tutorials/tree/main/examples/miden-bank) directory

Ready to build your first Miden banking application? Let's get started with [Part 0: Project Setup](./00-project-setup.md)!
