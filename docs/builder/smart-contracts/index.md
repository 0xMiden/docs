---
title: "Miden Smart Contracts"
description: "Build Miden smart contracts in Miden Assembly (MASM) for mainnet production, with the Rust SDK in active development as the long-term direction."
pagination_prev: null
---

# Miden Smart Contracts

This section covers the developer-facing paths for building smart contracts on Miden: an authoring guide for **Miden Assembly (MASM)** (the supported path for mainnet production today) and **Rust** (in active development as the long-term direction), plus the [Miden Standards](./standards/index.md) library of reusable components callable from either.

:::tip Building for mainnet?
Miden mainnet supports smart contracts authored in **Miden Assembly (MASM)** today. The Rust SDK is in active development and will become the default authoring path once it ships v1. For production deployments now, see [MASM Smart Contracts](./masm/index.md).
:::

If you're new to Miden, the hands-on [Miden Bank Tutorial](../tutorials/miden-bank/index.md) walks through the full lifecycle using the Rust SDK; the concepts (accounts, notes, transactions, components) translate directly to MASM.

## Sections

<CardGrid cols={2}>
  <Card title="Overview" docId="builder/smart-contracts/overview" eyebrow="Model">
    How accounts, notes, transactions, and components fit together. Concepts apply regardless of authoring language.
  </Card>
  <Card title="MASM" docId="builder/smart-contracts/masm/index" eyebrow="Mainnet path">
    Author production-ready smart contracts directly in Miden Assembly. The path Miden mainnet supports today.
  </Card>
  <Card title="Rust" docId="builder/smart-contracts/rust/index" eyebrow="In development">
    Build accounts, notes, transactions, and reusable logic with the Rust-first workflow. Currently in active development and not yet production-ready for mainnet.
  </Card>
  <Card title="Miden Standards" docId="builder/smart-contracts/standards/index" eyebrow="Reusable libraries">
    Standard components, note scripts, faucet policies, and MASM modules. Callable from MASM or Rust.
  </Card>
</CardGrid>

## Inside the Rust SDK

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
  <Card title="Cross-component calls" docId="builder/smart-contracts/cross-component-calls" eyebrow="Composition">
    Calling methods across account components and from note scripts.
  </Card>
  <Card title="Types" docId="builder/smart-contracts/types" eyebrow="Primitives">
    Core types: Felt, Word, AccountId, NoteId, and more.
  </Card>
  <Card title="Patterns" docId="builder/smart-contracts/patterns" eyebrow="Recipes">
    Access control, rate limiting, spending limits, and anti-patterns.
  </Card>
</CardGrid>

## Reference

<CardGrid cols={3}>
  <Card title="API reference" href="https://docs.rs/miden/latest/miden/" eyebrow="docs.rs">
    Complete API documentation for the miden crate.
  </Card>
</CardGrid>
