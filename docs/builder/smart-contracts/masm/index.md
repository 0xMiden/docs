---
title: "MASM Smart Contracts"
description: "Author Miden smart contracts directly in Miden Assembly (MASM) — the supported path for mainnet production."
sidebar_position: 0
---

# MASM Smart Contracts

This section is the practical guide to authoring Miden smart contracts directly in **Miden Assembly (MASM)** — the path Miden mainnet supports for production deployments today. The Rust SDK is in active development and will become the default authoring path once it ships v1; until then, MASM is what you ship with.

:::info Audience
You're here because you want to deploy a contract to Miden mainnet. MASM is a small, stack-based assembly language — closer to assembly than Rust or Solidity, but it gives you direct, predictable control over the VM and is what the mainnet kernel verifies. The [Reference → Miden VM → Assembly](/reference/miden-vm/user_docs/assembly/) section is the full language reference; this section is the Builder-side cookbook for using it.
:::

## When to use MASM vs. the Rust SDK

| Concern | MASM | Rust SDK |
|---|---|---|
| **Mainnet production** | Supported today | In active development |
| **Performance / cycle control** | Direct control over emitted instructions | Compiles via Wasm → MASM; less predictable |
| **Learning curve** | Small instruction set, explicit stack semantics | Familiar Rust ergonomics |
| **Miden Standards** | [Standards modules](../standards/index.md) callable directly | Same standards via Rust bindings |
| **Long-term direction** | Long-lived for system-level / performance-critical code | Will become the default authoring path once mature |

For mainnet shipping today, the choice is straightforward: write MASM. Most production patterns — account components, note scripts, transaction scripts, P2ID and P2IDE flows, faucet policies — are already covered by [Miden Standards](../standards/index.md), so most contracts compose existing standards rather than rolling everything from scratch.

## Where the language reference lives

The full Miden Assembly reference — every instruction, the stack semantics, control flow, cryptographic operations, debugging instructions — lives in [Reference → Miden VM → Assembly](/reference/miden-vm/user_docs/assembly/). Treat that as the dictionary. This Builder section is the cookbook: how to structure a project, conventions for accounts, notes, and transactions, deployment, testing, and debugging in the context of building a Miden app.

## Tutorials

Practical, end-to-end tutorials are in progress in the [Miden tutorials repository](https://github.com/0xMiden/tutorials) and will land in this section as they ship:

| Tutorial | Status |
|---|---|
| Project setup and first MASM contract | In progress |
| MASM account components | In progress |
| MASM note scripts | In progress |
| MASM transaction scripts | In progress |
| Testing with MockChain | In progress |
| Debugging MASM contracts | In progress |

In the meantime, the existing [Rust-based Miden Bank tutorial](../../tutorials/miden-bank/index.md) is useful for understanding the overall transaction lifecycle and the patterns that translate to MASM. The [Reference assembly section](/reference/miden-vm/user_docs/assembly/) covers the language itself.

## See also

- [Miden Standards](../standards/index.md) — reusable account components, standard notes, faucet policies, callable from MASM.
- [Reference → Miden VM → Assembly](/reference/miden-vm/user_docs/assembly/) — full language reference (instructions, stack semantics, control flow).
- [Smart Contracts → Overview](../overview.md) — execution model and lifecycle (the concepts apply regardless of authoring language).
- [Tools → Playground](../../tools/playground.md) — interactive browser-based MASM environment for quick experiments.
