---
title: "Agentic"
sidebar_label: "Agentic"
description: "Build Miden apps with coding agents, version-matched skills, reusable templates, and a verified contract-to-frontend workflow."
pagination_prev: null
---

# Agentic

Build and test Miden apps with a coding agent. Give it context that matches your installed tools, choose a template, and verify the contract and frontend before connecting to a network.

## Start here

<CardGrid cols={3}>
  <Card title="Set up your agent" href="./setup" eyebrow="Context · Versions">
    Match your toolchain, SDK packages, and project instructions before making changes.
  </Card>
  <Card title="Choose a template" href="./templates" eyebrow="Rust · React">
    Start with a full-stack workspace, a Rust contract project, or a browser app.
  </Card>
  <Card title="Install agent skills" href="./tools" eyebrow="Rust · MASM · Protocol">
    Discover and install the knowledge your agent needs while preserving existing project context.
  </Card>
</CardGrid>

## Build and verify

<CardGrid cols={2}>
  <Card title="Build your first app" href="./first-app" eyebrow="Counter walkthrough">
    Build the Rust counter, test it with MockChain, and validate it on a disposable local node.
  </Card>
  <Card title="Verify your app" href="./verify" eyebrow="Checks · Evidence">
    Check installed context, generated packages, committed state, and browser behavior.
  </Card>
  <Card title="Troubleshoot" href="./recover" eyebrow="Recovery">
    Resolve setup, context, and runtime errors while preserving your keys and stores.
  </Card>
  <Card title="Network handoff" href="./network-handoff" eyebrow="Testnet · Configuration">
    Prepare accounts, endpoints, funding, and success criteria for your target network.
  </Card>
</CardGrid>

## Resources

<CardGrid cols={3}>
  <Card title="Smart Contracts" href="../smart-contracts/" eyebrow="MASM · Rust">
    Learn the account, note, and transaction model and choose an authoring language.
  </Card>
  <Card title="Tutorials" href="../tutorials/" eyebrow="Walkthroughs · Recipes">
    Extend the counter with focused contract and client examples.
  </Card>
  <Card title="Client SDKs" href="../tools/clients/" eyebrow="Rust · Web · React">
    Use the client APIs and installed package guidance for your app.
  </Card>
</CardGrid>

## Prerequisites

- [Install the Miden toolchain](../get-started/setup/installation.md) and use the project's pinned release.
- For the full-stack template: Rust/rustup, Node.js 20.19.0+ within the 20.x line, Yarn Classic 1, and Python 3.11+.
- Docker with Compose is needed for the real local-node check.

The Rust counter is a local/testnet development path. For mainnet contract authoring, follow the [Smart Contracts guidance](../smart-contracts/index.md).
