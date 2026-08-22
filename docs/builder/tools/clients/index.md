---
title: Clients
description: "Miden client SDKs — Rust, TypeScript, and React surfaces for accounts, transactions, notes, and client-side proving."
sidebar_position: 1
pagination_prev: null
---

# Clients

The Miden client manages accounts, builds and executes transactions, produces zero-knowledge proofs, and synchronises local state with the node. The same core ships across three consumer surfaces — pick the runtime that matches your application. All three share the same onchain semantics.

## SDKs

<CardGrid cols={3}>
  <Card title="Rust" href="./rust-client/" eyebrow="Rust · SDK + CLI">
    Native Rust library and CLI. Best for services, proving infrastructure, tests, scripting, and local exploration.
  </Card>
  <Card title="TypeScript" docId="builder/tools/clients/web-client/index" eyebrow="TypeScript · Browser">
    `@miden-sdk/miden-sdk` — Rust compiled to WebAssembly with a typed TypeScript API. Browser, Node, Electron, service workers.
  </Card>
  <Card title="React" docId="builder/tools/clients/react-sdk/index" eyebrow="React · Hooks">
    `@miden-sdk/react` — `MidenProvider` + hooks (`useMiden`, `useAccount`, `useSend`, …) wrapping the Web SDK.
  </Card>
</CardGrid>

## Pick a surface

<CardGrid cols={2}>
  <Card title="Rust library" eyebrow="Core · Native">
    Core state machine, transaction executor, prover, keystore abstraction, and note transport. Use it in native services, backend proving infrastructure, and integration tests.
  </Card>
  <Card title="Rust CLI" eyebrow="Scripting · Ops">
    Wraps the library as commands. Shipped in the same `miden-client` crate — good for local exploration and ops workflows.
  </Card>
  <Card title="Web SDK" eyebrow="WASM · Browser">
    Rust library compiled to WebAssembly with a typed `MidenClient` JavaScript class. Canonical TS/JS entry point for browser and Node apps.
  </Card>
  <Card title="React SDK" eyebrow="Hooks · dApps">
    `MidenProvider` + hooks wrapping the Web SDK. Drop it into a React / Next.js / React Native app for instant Miden integration.
  </Card>
</CardGrid>

## Shared topics

<CardGrid cols={2}>
  <Card title="Local node testing" docId="builder/tools/clients/local-node-testing" eyebrow="Dev loop">
    Run a local node, point Rust and web clients at localhost, import genesis accounts, and debug local transaction state.
  </Card>
  <Card title="Common errors" href="./common-errors" eyebrow="Diagnostics">
    Errors, diagnostic output, and recovery patterns shared across all surfaces.
  </Card>
  <Card title="Tutorials" docId="builder/tutorials/index" eyebrow="Walkthroughs">
    End-to-end walkthroughs using each client surface — Miden Bank, recipes, helpers.
  </Card>
</CardGrid>
