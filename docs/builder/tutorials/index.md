---
title: Tutorials
sidebar_position: 0
pagination_prev: null
---

# Tutorials

Hands-on walkthroughs for building on Miden. Every tutorial pairs with runnable Rust and TypeScript examples from the [miden-tutorials](https://github.com/0xMiden/miden-tutorials) repo and with MockChain tests so you can verify each step locally.

## Pick a path

<CardGrid cols={3}>
  <Card title="Miden Bank" href="./miden-bank/" eyebrow="Walkthrough · Rust">
    A 9-part curriculum — build a complete banking application covering components, storage, note scripts, cross-component calls, and output notes.
  </Card>
  <Card title="Recipes" href="./recipes/rust/" eyebrow="Cookbook · Rust & Web">
    Standalone how-to's for specific tasks: counter contract, create/deploy, foreign procedure invocation, React wallet, and more.
  </Card>
  <Card title="Miden node setup" href="./miden_node_setup" eyebrow="Operator">
    Run a Miden node locally or on testnet with `midenup` and the node binary.
  </Card>
  <Card title="Bridging" href="./recipes/web/bridging_with_epoch_tutorial" eyebrow="Recipe · TypeScript">
    Bridge assets between Miden and EVM chains (Sepolia testnet) with the Epoch protocol intent SDK.
  </Card>
</CardGrid>

## Development helpers

<CardGrid cols={3}>
  <Card title="Testing with MockChain" href="./helpers/testing" eyebrow="Helper">
    Test your contracts against MockChain for local simulation.
  </Card>
  <Card title="Debugging" href="./helpers/debugging" eyebrow="Helper">
    Interpret errors and debug common issues.
  </Card>
  <Card title="Common pitfalls" href="./helpers/pitfalls" eyebrow="Helper">
    Avoid known issues and limitations.
  </Card>
</CardGrid>

## Prerequisites

- [Install the Miden toolchain](../get-started/setup/installation) with `midenup`.
- Basic familiarity with Rust (or TypeScript for the client examples).
- Understanding of the [core concepts](../smart-contracts/) — accounts, notes, transactions.
