---
title: "Rust Smart Contracts"
description: "Author Miden smart contracts in Rust — the long-term direction for Miden development, currently in active development."
---

# Rust Smart Contracts

The Rust SDK is the long-term direction for Miden smart-contract development: define account components, note scripts, and transaction scripts in idiomatic `#![no_std]` Rust with typed storage, attribute macros, and client-side proving. The SDK compiles to Miden Assembly (MASM) under the hood, so the same execution model and standards library apply.

:::caution Currently in active development
The Rust SDK is being actively developed and is **not yet production-ready for mainnet**. For production deployments today, write contracts in [Miden Assembly (MASM)](../masm/index.md) — the supported path Miden mainnet verifies. Use the Rust SDK for prototyping, experimentation, and exploration of the long-term direction.
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

## When to choose Rust vs MASM today

| Concern | Rust SDK | MASM |
|---|---|---|
| **Mainnet production** | In active development | [Supported today](../masm/index.md) |
| **Ergonomics** | Familiar Rust idioms, type-checked storage, attribute macros | Stack-based assembly, explicit control |
| **Compilation target** | Compiles via Wasm → MASM | Directly authored |
| **Use case** | Long-term default once mature; prototyping and exploration today | Production contracts for mainnet |

Both authoring paths share the same [Miden Standards](../standards/index.md) library — standard components, notes, and faucet policies are callable from either.

## Related pages

- [MASM Smart Contracts](../masm/index.md) — the path mainnet supports today.
- [Miden Standards](../standards/index.md) — reusable building blocks callable from Rust or MASM.
- [Smart Contracts → Overview](../overview.md) — execution model and lifecycle (concepts apply to both authoring paths).
- [API reference on docs.rs](https://docs.rs/miden/latest/miden/) — full Rust SDK API documentation.
