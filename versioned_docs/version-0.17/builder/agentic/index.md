---
title: "Agentic"
sidebar_label: "Agentic"
description: "Build a Miden app with agentic-template: clone the workspace, set it up, check agent context, then build and verify the counter."
pagination_prev: null
---

# Agentic

Start with [agentic-template](https://github.com/0xMiden/agentic-template), the default full-stack workspace for building Miden apps with a coding agent. Clone its pinned Rust and React subprojects, complete setup, check the installed context, then build and test the counter.

## Before you start

You need Git, Bash, curl, and Node.js/npm. Use Node.js 20.19.0+ within the 20.x line for the pinned frontend; the setup script's Node 18 check is less strict than its locked package requirements. The journey also uses Rust/rustup, a compatible midenup, Yarn Classic 1, and Python 3.11+. Review the [prerequisites and installer behavior](setup.md#prerequisites) first. Docker with Compose is needed for the real local-node stage.

## Start here

Follow these steps in order. The first page includes the recursive clone and working-directory commands before any project checks.

<CardGrid cols={2}>
  <Card title="Set up agentic-template" href="./setup" eyebrow="Step 1 · Clone and install">
    Clone the official workspace with its submodules, review prerequisites, and run setup.
  </Card>
  <Card title="Check your setup" href="./templates" eyebrow="Step 2 · Context and versions">
    Check the installed toolchain, source pins, package guides, and the instructions your agent reads.
  </Card>
  <Card title="Build your first app" href="./first-app" eyebrow="Step 3 · Counter walkthrough">
    Build the Rust counter, test it with MockChain, and validate it on a disposable local node.
  </Card>
  <Card title="Verify your app" href="./verify" eyebrow="Step 4 · Evidence">
    Record the contract, local-node, frontend, and browser results before moving to a network.
  </Card>
</CardGrid>

## Next steps

<CardGrid cols={3}>
  <Card title="Troubleshoot" href="./recover" eyebrow="Recovery">
    Resolve setup, context, and runtime errors while preserving your keys and stores.
  </Card>
  <Card title="Network handoff" href="./network-handoff" eyebrow="Testnet · Configuration">
    Prepare accounts, endpoints, funding, and success criteria for your target network.
  </Card>
  <Card title="Add agent skills" href="./tools" eyebrow="Optional · Rust and MASM">
    Add selected knowledge skills when the template and installed package guidance do not cover your task.
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

Smaller Rust-only and frontend-only templates are [optional starting points](setup.md#other-starting-points-optional). You can follow the default journey without choosing between them or installing extra agent skills.

The Rust counter is a local/testnet development path. For mainnet contract authoring, follow the [Smart Contracts guidance](../smart-contracts/index.md).
