---
title: "Miden Smart Contracts"
description: "Build Miden smart contracts with Rust, Miden Assembly, and reusable Miden Standards."
pagination_prev: null
---

# Miden Smart Contracts

This section covers the developer-facing paths for building smart contracts on Miden. Start with the overview for the execution model, use Rust for account, note, and transaction development, and use Miden Standards when you want reusable account components, note scripts, faucet policies, and protocol-compatible building blocks.

If you're new to Miden, follow the hands-on [Miden Bank Tutorial](../tutorials/miden-bank/).

## Sections

<CardGrid cols={3}>
  <Card title="Overview" href="./overview" eyebrow="Model">
    Learn how accounts, notes, transactions, and components fit together.
  </Card>
  <Card title="Rust" href="./rust" eyebrow="Authoring path">
    Build accounts, notes, transactions, and reusable logic with the Rust-first workflow.
  </Card>
  <Card title="Miden Standards" href="./standards/" eyebrow="Reusable libraries">
    Use standard components, note scripts, faucet policies, and MASM modules.
  </Card>
</CardGrid>

## Inside Rust

<CardGrid cols={3}>
  <Card title="Accounts" href="./accounts/" eyebrow="State & code">
    Components, storage, custom types, operations, cryptography, and authentication.
  </Card>
  <Card title="Notes" href="./notes/" eyebrow="Programmable messages">
    Programmable UTXOs for asset transfers.
  </Card>
  <Card title="Transactions" href="./transactions/" eyebrow="Execution">
    Transaction context, scripts, and the advice provider.
  </Card>
  <Card title="Cross-component calls" href="./cross-component-calls" eyebrow="Composition">
    Calling methods across account components and from note scripts.
  </Card>
  <Card title="Types" href="./types" eyebrow="Primitives">
    Core types: Felt, Word, AccountId, NoteId, and more.
  </Card>
  <Card title="Patterns" href="./patterns" eyebrow="Recipes">
    Access control, rate limiting, spending limits, and anti-patterns.
  </Card>
</CardGrid>

## Reference

<CardGrid cols={3}>
  <Card title="API reference" href="https://docs.rs/miden/latest/miden/" eyebrow="docs.rs">
    Complete API documentation for the miden crate.
  </Card>
</CardGrid>
