---
title: Playground
sidebar_position: 3
description: "Browser-based environment to write, compile, and execute Miden Assembly programs — no local tooling required."
---

# Miden Playground

An interactive browser environment for writing, compiling, and executing Miden Assembly (MASM) programs. No installation required — prototype account code, test note scripts, and experiment with VM instructions straight from a URL.

<CardGrid cols={2}>
  <Card title="Open the Playground ↗" href="https://playground.miden.xyz/" eyebrow="External · playground.miden.xyz">
    Launch the browser IDE and start writing MASM immediately.
  </Card>
  <Card title="Miden VM reference" href="/reference" eyebrow="Reference · MASM">
    Instruction set, stack semantics, chiplets, and assembler behaviour.
  </Card>
</CardGrid>

## What you can do

<CardGrid cols={3}>
  <Card title="Write MASM" eyebrow="Editor">
    Syntax-highlighted editor with inline error reporting for the Miden assembler.
  </Card>
  <Card title="Execute programs" eyebrow="VM">
    Run programs against the Miden VM in-browser and inspect the resulting stack and memory.
  </Card>
  <Card title="Share snippets" eyebrow="Workflow">
    Shareable URLs with embedded code for reproducing bugs or teaching examples.
  </Card>
</CardGrid>

<Callout variant="tip" title="When to graduate from the Playground">
The Playground shines for learning MASM and for quick prototyping. For anything bigger than a snippet — components, storage, note dispatch, transaction flows — move to a `miden new` Rust project locally. See [your first smart contract](../get-started/your-first-smart-contract/index.md) for the handoff.
</Callout>

## Related

<CardGrid cols={3}>
  <Card title="First smart contract" docId="builder/get-started/your-first-smart-contract/index" eyebrow="Tutorial">
    Install the toolchain and build + deploy a counter contract in Rust.
  </Card>
  <Card title="MASM in v0.14" docId="builder/migration/masm-changes" eyebrow="v0.14">
    New `word(...)` / `event(...)` constants, `std::math::u128`, and other MASM-level deltas.
  </Card>
  <Card title="Smart contracts reference" docId="builder/smart-contracts/index" eyebrow="Reference">
    Accounts, notes, transactions, and the Rust SDK surface.
  </Card>
</CardGrid>
