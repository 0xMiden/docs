---
title: Tools
description: "Developer tools for building on and interacting with the Miden network — clients, note transport, bridging, playground, and the live network surface."
pagination_prev: null
---

# Tools

Developer tools for building on and interacting with the Miden network. Use the client SDKs inside your app, Note Transport to relay private notes, Bridging guides to test interoperability flows, the Playground to prototype contracts in-browser, and the Network page to find the live testnet endpoints (status, explorer, RPC, faucet, remote prover).

## Clients

<CardGrid cols={3}>
  <Card title="Rust client" href="./clients/rust-client/" eyebrow="Rust · SDK">
    Full-featured Rust library for Miden layer 2 integration — accounts, transactions, notes, proving.
  </Card>
  <Card title="Web SDK" href="./clients/web-client/" eyebrow="TypeScript · SDK">
    Browser-based client for managing accounts and transactions from a web app.
  </Card>
  <Card title="React SDK" href="./clients/react-sdk/" eyebrow="React · SDK">
    Hooks and components for Miden dApps.
  </Card>
</CardGrid>

## Toolchain + environments

<CardGrid cols={3}>
  <Card title="midenup" href="./midenup" eyebrow="Toolchain installer">
    Install and switch between Miden toolchain channels — VM, compiler, client, stdlib, kernel — from a unified `miden` command.
  </Card>
  <Card title="Playground" href="./playground" eyebrow="Browser">
    Interactive environment for writing and testing Miden Assembly programs.
  </Card>
  <Card title="Network" href="./network" eyebrow="Testnet · Services">
    Live Miden testnet endpoints — status, block explorer (MidenScan), RPC, faucet, remote prover.
  </Card>
  <Card title="Note Transport" href="./note-transport/" eyebrow="Private notes · Relay">
    Offchain relay service for delivering private note payloads between senders and recipients.
  </Card>
  <Card title="Bridging" href="./bridging/" eyebrow="Interop · Testnets">
    Testnet bridge tooling and interoperability guides, starting with the mock 1Click bridge sandbox.
  </Card>
</CardGrid>
