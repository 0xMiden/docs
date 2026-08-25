---
title: "MASM Smart Contracts"
description: "Author Miden smart contracts directly in Miden Assembly (MASM) — the supported path for mainnet production."
sidebar_position: 0
---

# MASM Smart Contracts

This section is the practical guide to authoring Miden smart contracts directly in **Miden Assembly (MASM)** — the path Miden mainnet supports for production deployments today. The Rust SDK is in active development and will become the default authoring path once it ships v1; until then, MASM is what you ship with.

The examples in this section assume protocol v0.15.3 and Miden Assembly v0.23.

:::info Audience
You're here because you want to deploy a contract to Miden mainnet. MASM is a small, stack-based assembly language — closer to assembly than Rust or Solidity, but it gives you direct, predictable control over the VM and is what the mainnet kernel verifies. The [Reference → Miden VM → Assembly](/reference/miden-vm/user_docs/assembly/) section is the full language reference; this section is the Builder-side cookbook for using it.
:::

## When to use MASM vs. the Rust SDK

| Concern | MASM | Rust SDK |
|---|---|---|
| **Mainnet production** | Supported today | In active development |
| **Performance / cycle control** | Direct control over emitted instructions | Compiles via Wasm → MASM; less predictable |
| **Learning curve** | Small instruction set, explicit stack semantics | Familiar Rust ergonomics |
| **Miden Standards** | [Standards modules](../standards/) callable directly | Same standards via Rust bindings |
| **Long-term direction** | Long-lived for system-level / performance-critical code | Will become the default authoring path once mature |

For mainnet shipping today, the choice is straightforward: write MASM. Most production patterns — account components, note scripts, transaction scripts, P2ID and P2IDE flows, faucet policies — are already covered by [Miden Standards](../standards/), so most contracts compose existing standards rather than rolling everything from scratch.

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

In the meantime, the existing [Rust-based Miden Bank tutorial](../../tutorials/miden-bank/) is useful for understanding the overall transaction lifecycle and the patterns that translate to MASM. The [Reference assembly section](/reference/miden-vm/user_docs/assembly/) covers the language itself.

## See also

- [Miden Standards](../standards/) — reusable account components, standard notes, faucet policies, callable from MASM.
- [Reference → Miden VM → Assembly](/reference/miden-vm/user_docs/assembly/) — full language reference (instructions, stack semantics, control flow).
- [Smart Contracts → Overview](../overview) — execution model and lifecycle (the concepts apply regardless of authoring language).
- [Tools → Playground](../../tools/playground) — interactive browser-based MASM environment for quick experiments.

## Common Pitfalls

### Procedure Hash Byte Order in `call.0xHEX`

The MASP inspector displays procedure hashes in big-endian order per 8-byte chunk,
but `call.0x<HEX>` requires little-endian order per chunk. Using the hash directly
from the inspector will silently invoke a wrong or non-existent procedure, with no
helpful error message.

Convert the hash before use:

```python
masp = "1f92867d5acabdfdece9a4eb6d0c2ae19359c1a7ae1fa54e1fc16cc6ab2d94c0"
chunks = [masp[i:i+16] for i in range(0, 64, 16)]
call_hex = "".join(bytes.fromhex(c)[::-1].hex() for c in chunks)
# Result: fdbdca5a7d86921fe12a0c6deba4e9ec4ea51faea7c15993c0942dabc66cc11f
# Use: call.0xfdbdca5a7d86921fe12a0c6deba4e9ec4ea51faea7c15993c0942dabc66cc11f
```

---

### Calling Procedures That Return Values (`call` vs `exec`)

Using `call.0x<PROC_HASH>` to invoke a procedure that returns a `Felt` triggers
`InvalidStackDepthOnReturn { depth: 17 }`. The component-model wrapper pushes the
return value after `truncate_stack`, leaving the stack one element too deep.

**Workaround:** Use `exec.0x<PROC_HASH>` instead, or redesign the procedure as void
(no return value).
