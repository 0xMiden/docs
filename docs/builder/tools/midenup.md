---
title: midenup
sidebar_label: Midenup
sidebar_position: 2
description: "The Miden toolchain installer — bootstrap, pin, and switch between Miden VM / compiler / client / stdlib toolchains from a single `miden` entry point."
---

# midenup

`midenup` is the Miden toolchain installer. One install gives you a unified `miden` command that delegates to the Miden VM, compiler (`midenc` + `cargo-miden`), client, stdlib, and transaction kernel — all versioned together as a single release channel.

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
  <Card title="Standard library" eyebrow="MASM stdlib">
    `miden-stdlib` — the canonical MASM standard library.
  </Card>
  <Card title="Transaction kernel" eyebrow="Kernel library">
    `miden-base` — the transaction kernel that runs inside every account and note script.
  </Card>
  <Card title="(more coming)" eyebrow="Roadmap">
    Additional Miden components will be added to `midenup` as they ship.
  </Card>
</CardGrid>

## Toolchain management

### Install a channel

```bash
midenup install stable        # latest matching component set
midenup install 0.14          # pin to a specific release line
```

### Switch the active toolchain

```bash
midenup set 0.14              # pin for the current project (writes miden-toolchain.toml)
midenup override 0.14         # set the system-wide default
midenup show active-toolchain # which one is active right now?
```

A `miden-toolchain.toml` in the current directory always wins — otherwise the system default applies, falling back to `stable` if none is set.

### Uninstall

```bash
midenup uninstall 0.14
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
| `miden build` | `cargo miden build` | Build the project |
| `miden new-wallet` | `miden-client new-wallet --deploy` | Create and deploy a wallet account |
| `miden account` | `miden-client account` | Create or inspect a local account |
| `miden faucet` | `miden-client mint` | Fund an account from the faucet |
| `miden deploy` | `miden-client -s public --account-type regular-account-immutable-code` | Deploy a public, immutable-code contract |
| `miden call` | `miden-client account --show` | Read state from an account (view) |
| `miden send` | `miden-client send` | Send a state-changing transaction |
| `miden simulate` | `miden-client exec` | Dry-run a transaction without committing |

Everything outside the alias table is forwarded to the underlying binary — e.g., `miden exec …` goes straight through to `miden-client exec`.

## Related

<CardGrid cols={3}>
  <Card title="Installation" docId="builder/get-started/setup/installation" eyebrow="Get started">
    Full environment setup — prerequisites, node install, first account.
  </Card>
  <Card title="CLI basics" docId="builder/get-started/setup/cli-basics" eyebrow="Commands">
    Walk through `miden account`, `miden send`, `miden faucet`, and the rest.
  </Card>
  <Card title="Network" docId="builder/tools/network" eyebrow="Testnet · Services">
    Endpoints the `miden` CLI points at — RPC, faucet, remote prover, block explorer.
  </Card>
</CardGrid>
