---
title: Playground
sidebar_position: 3
description: "Browser-based sandbox for building Miden smart contracts and interacting with accounts, notes, and transactions — no local tooling required."
---

# Miden Playground

An interactive browser environment for learning Miden and testing smart contracts. No installation required — create a testnet sandbox, write and compile Rust account components and scripts, inspect the generated Miden Assembly (MASM), and execute transactions.

<CardGrid cols={2}>
  <Card title="Open the Playground ↗" href="https://playground.miden.xyz/" eyebrow="External · playground.miden.xyz">
    Launch a tutorial, open an example, or create a testnet sandbox.
  </Card>
  <Card title="Miden VM reference" href="/reference" eyebrow="Reference · MASM">
    Instruction set, stack semantics, chiplets, and assembler behaviour.
  </Card>
</CardGrid>

## What you can do

<CardGrid cols={3}>
  <Card title="Build smart contracts" eyebrow="Rust editor">
    Write and compile account components, authentication components, note scripts, and transaction scripts in Rust.
  </Card>
  <Card title="Inspect generated MASM" eyebrow="Compiler output">
    Review the read-only MASM output together with package exports, dependencies, and compilation errors.
  </Card>
  <Card title="Run transactions" eyebrow="Testnet sandbox">
    Create or import accounts and notes, invoke account procedures, consume notes, and inspect transactions.
  </Card>
</CardGrid>

<Callout variant="tip" title="When to move to a local project">
The Playground is useful for guided tutorials and end-to-end experiments without local setup. Move to a `miden new` Rust project when you need source control, automated tests, or a custom build and deployment workflow. See [your first smart contract](../get-started/your-first-smart-contract) for the handoff.
</Callout>

## Related

<CardGrid cols={3}>
  <Card title="First smart contract" href="../get-started/your-first-smart-contract" eyebrow="Tutorial">
    Install the toolchain and build + deploy a counter contract in Rust.
  </Card>
  <Card title="MASM migration changes" href="../migration/masm-changes" eyebrow="Migration">
    Explicit module declarations, new import syntax, debug procedures, and other MASM-level deltas.
  </Card>
  <Card title="Smart contracts reference" href="../smart-contracts" eyebrow="Reference">
    Accounts, notes, transactions, and the Rust SDK surface.
  </Card>
</CardGrid>
