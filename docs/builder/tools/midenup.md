---
title: midenup
sidebar_label: Midenup
sidebar_position: 2
description: "The Miden toolchain installer — bootstrap, pin, and switch between Miden VM, compiler, client, and package toolchains from a single `miden` entry point."
---

# midenup

`midenup` is the Miden toolchain installer. One install gives you a unified `miden` command that delegates to the Miden VM, compiler (`midenc` + `cargo-miden`), client, formatter, local package registry, and protocol packages — all versioned together as a single release channel.

<CardGrid cols={2}>
  <Card title="midenup on GitHub ↗" href="https://github.com/0xMiden/midenup" eyebrow="Source · Installer">
    The installer repo. Tracks the canonical channel manifest and publishes prebuilt toolchain releases.
  </Card>
  <Card title="Channel manifest ↗" href="https://0xmiden.github.io/midenup/channel-manifest.json" eyebrow="JSON">
    Machine-readable inventory of available toolchain channels and the component versions each one pins.
  </Card>
</CardGrid>

## Install

```bash title=">_ Install midenup"
cargo install midenup && midenup init
```

`midenup init` sets up `$MIDENUP_HOME`, writes a `miden` symlink into `$CARGO_HOME/bin`, and prepares the toolchain cache. Since most Rust users already have `$CARGO_HOME/bin` on their PATH, the `miden` command is ready immediately.

<Callout variant="tip" title="Check it worked">
Run `miden --version`. If you see "command not found," add `$CARGO_HOME/bin` (default `~/.cargo/bin`) to your PATH and re-open the shell.
</Callout>

## Components it manages

<CardGrid cols={3}>
  <Card title="Miden VM" eyebrow="Execution">
    The MASM interpreter, prover, and verifier. Used by every Miden program.
  </Card>
  <Card title="Compiler" eyebrow="Rust → MASM">
    `midenc` and `cargo-miden` — the Rust frontend that compiles `#[miden]` code to MASM.
  </Card>
  <Card title="Miden client" eyebrow="SDK + CLI">
    `miden-client` — accounts, transactions, notes, proving.
  </Card>
  <Card title="Formatter" eyebrow="MASM source">
    `miden-format` — format Miden Assembly source files.
  </Card>
  <Card title="Protocol packages" eyebrow="Kernel libraries">
    Core, protocol, standards, and transaction-kernel MASP packages used by the toolchain.
  </Card>
  <Card title="Local registry" eyebrow="Package management">
    `miden-registry` — publish and inspect packages in a filesystem-backed local registry.
  </Card>
</CardGrid>

## Toolchain management

### Install a channel

```bash
midenup install testnet       # follows the release named by the testnet manifest
midenup install 0.16.0        # pin to a specific release line
```

### Switch the active toolchain

```bash
midenup set 0.16.0            # pin for the current project (writes miden-toolchain.toml)
midenup override 0.16.0       # set the system-wide default
midenup show active-toolchain # which one is active right now?
```

A `miden-toolchain.toml` in the current directory always wins — otherwise the system default applies, falling back to `stable` if none is set.

### Uninstall

```bash
midenup uninstall 0.16.0
```

Delete `$MIDENUP_HOME` to uninstall `midenup` itself. Find its location with `midenup show home`.

<Callout variant="warning" title="Don't delete toolchain dirs by hand">
Removing toolchain directories manually corrupts the `midenup` environment. Use `midenup uninstall` so the installer updates its bookkeeping.
</Callout>

## The `miden` entry point

`miden` delegates to the right component based on the subcommand. Common aliases:

| `miden` command | Delegates to | What it does |
| --- | --- | --- |
| `miden new` | `cargo miden new` | Create a new Miden Rust project |
| `miden build` | `midenc miden-project.toml` | Build the current Miden project |
| `miden new-wallet` | `miden-client new-wallet` | Create a local wallet account |
| `miden account` | `miden-client new-account` | Create a local account |
| `miden faucet` | `miden-client mint` | Mint your own asset from a faucet account you control |
| `miden mint` | `miden-faucet-client mint` | Request native test tokens from the public faucet |
| `miden call` | `miden-client call` | Call a local account procedure |
| `miden simulate` | `miden-client exec` | Dry-run a transaction without committing |
| `miden transfer` | `miden-client transfer` | Transfer assets to another account |
| `miden format` | `miden-format` | Format MASM source (install with `--component format`) |
| `miden registry` | `miden-registry` | Manage the local registry (install with `--component local-registry`) |

Use the component name to access commands that do not have an alias. The v0.16 channel has no `miden deploy` alias. `new-wallet` and `new-account` create accounts locally; fund and publish an account through its first successful transaction. Older channel aliases that add `--deploy` cannot be used with the stable v0.16 client.

## Related

<CardGrid cols={3}>
  <Card title="Installation" href="../get-started/setup/installation" eyebrow="Get started">
    Full environment setup — prerequisites, node install, first account.
  </Card>
  <Card title="CLI basics" href="../get-started/setup/cli-basics" eyebrow="Commands">
    Walk through `miden client account`, `miden client note`, `miden client sync`, and the rest.
  </Card>
  <Card title="Network" href="./network" eyebrow="Testnet · Services">
    Endpoints the `miden` CLI points at — RPC, faucet, remote prover, block explorer.
  </Card>
</CardGrid>
