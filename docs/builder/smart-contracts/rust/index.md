---
title: "Rust Smart Contracts"
description: "Author Miden smart contracts in Rust — the long-term direction for Miden development, currently in active development."
---

# Rust Smart Contracts

The Rust SDK is the long-term direction for Miden smart-contract development: define account components, note scripts, and transaction scripts in idiomatic `#![no_std]` Rust with typed storage, attribute macros, and client-side proving. The SDK compiles to Miden Assembly (MASM) under the hood, so the same execution model and standards library apply.

The examples in this section assume protocol v0.15.3, Miden VM / Assembly v0.23, miden-crypto v0.25, and the Miden SDK v0.13 macro surface.

:::caution Currently in active development
The Rust SDK is being actively developed and is **not yet production-ready for mainnet**. For production deployments today, write contracts in [Miden Assembly (MASM)](../masm/) — the supported path Miden mainnet verifies. Use the Rust SDK for prototyping, experimentation, and exploration of the long-term direction.
:::

The pages below describe the Rust SDK's current shape: how accounts and components compose, how notes are scripted, how transactions execute, and the patterns you can already build with.

## Inside the Rust SDK

<CardGrid cols={3}>
  <Card title="Accounts" href="../accounts/" eyebrow="State & code">
    Components, storage, custom types, operations, cryptography, and authentication.
  </Card>
  <Card title="Notes" href="../notes/" eyebrow="Programmable messages">
    Programmable UTXOs for asset transfers and cross-account interaction.
  </Card>
  <Card title="Transactions" href="../transactions/" eyebrow="Execution">
    Transaction context, scripts, and the advice provider.
  </Card>
  <Card title="Cross-component calls" href="../cross-component-calls" eyebrow="Composition">
    Calling methods across account components and from note scripts.
  </Card>
  <Card title="Types" href="../types" eyebrow="Primitives">
    Core types: Felt, Word, AccountId, NoteId, and more.
  </Card>
  <Card title="Patterns" href="../patterns" eyebrow="Recipes">
    Access control, rate limiting, spending limits, and anti-patterns.
  </Card>
</CardGrid>

## When to choose Rust vs MASM today

| Concern | Rust SDK | MASM |
|---|---|---|
| **Mainnet production** | In active development | [Supported today](../masm/) |
| **Ergonomics** | Familiar Rust idioms, type-checked storage, attribute macros | Stack-based assembly, explicit control |
| **Compilation target** | Compiles via Wasm → MASM | Directly authored |
| **Use case** | Long-term default once mature; prototyping and exploration today | Production contracts for mainnet |

Both authoring paths share the same [Miden Standards](../standards/) library — standard components, notes, and faucet policies are callable from either.

## Related pages

- [MASM Smart Contracts](../masm/) — the path mainnet supports today.
- [Miden Standards](../standards/) — reusable building blocks callable from Rust or MASM.
- [Smart Contracts → Overview](../overview) — execution model and lifecycle (concepts apply to both authoring paths).
- [API reference on docs.rs](https://docs.rs/miden/latest/miden/) — full Rust SDK API documentation.
