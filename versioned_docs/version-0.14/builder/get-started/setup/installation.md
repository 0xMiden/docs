---
sidebar_position: 1
title: Installation
description: Get started with Miden development by installing Miden tools using the `midenup` toolchain.
---

This guide walks you through installing the Miden development tools using the `midenup` toolchain manager.

## Prerequisites

### Install Rust

Miden development requires Rust. Install it using rustup:

```bash title=">_ Terminal"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Reload your PATH environment variable:

```bash title=">_ Terminal"
. "$HOME/.cargo/env"
```

Verify the installation:

```bash title=">_ Terminal"
rustc --version
```

<details>
<summary>Expected output</summary>

```text
rustc 1.92.0-nightly (fa3155a64 2025-09-30)
```

</details>

### Install Node.js & Yarn

For TypeScript development with the Miden Web Client, you'll need Node.js and Yarn.

**Install Node.js:**

```bash title=">_ Terminal"
# Install Node.js using the official installer or package manager
# For macOS with Homebrew:
brew install node

# For Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# For Windows, download from nodejs.org
```

**Install Yarn:**

```bash title=">_ Terminal"
# Install Yarn globally via npm
npm install -g yarn
```

**Verify installations:**

```bash title=">_ Terminal"
node --version && yarn --version
```

<details>
<summary>Expected output</summary>

```text
v22.x.x  # or higher
1.22.x   # or higher
```

</details>

### Install Miden CLI

**Install midenup**

The Miden toolchain installer makes it easy to manage Miden components:

```bash title=">_ Terminal"
cargo install midenup
```

:::info
Until published to crates.io, install using: `cargo install --git https://github.com/0xMiden/midenup.git`
:::

**Initialize midenup**

```bash title=">_ Terminal"
midenup init
```

This creates the `$MIDENUP_HOME` directory and sets up the `miden` command by creating a symlink in your Cargo bin directory (`$CARGO_HOME/bin/`, typically `~/.cargo/bin/`). Since Rust users already have this directory in their PATH, no additional PATH configuration is needed.

Verify it works:

```bash title=">_ Terminal"
which miden
```

<details>
<summary>Expected output</summary>

```text
/Users/<USERNAME>/.cargo/bin/miden    # macOS
/home/<USERNAME>/.cargo/bin/miden     # Linux
```

</details>

**Install Miden Toolchain**

Install the latest stable Miden components:

```bash title=">_ Terminal"
midenup install stable
```

:::note
You may see `No artifact found. Proceeding to install from source` during installation. This is expected — it means pre-built binaries aren't available for your platform, so midenup compiles components from source. This can take 15-30 minutes.
:::

### Verify Installation

Check that everything is working correctly:

```bash title=">_ Terminal"
midenup show active-toolchain
```

<details>
<summary>Expected output</summary>

```text
stable
```

</details>

### Troubleshooting

**"miden: command not found"**

Ensure `$CARGO_HOME/bin` (typically `~/.cargo/bin/`) is in your PATH. This should already be configured if you installed Rust via rustup. Verify with:

```bash title=">_ Terminal"
echo $PATH | tr ':' '\n' | grep cargo
```

**"config error: missing field" when running `miden client` commands**

If you have config files from a previous Miden installation, they may be incompatible with the current version. Delete the old config and database, then re-initialize:

```bash title=">_ Terminal"
rm -f miden-client.toml store.sqlite3
miden client init
```

## Set Up a Project

The Quick Start guides let you follow along in either Rust or TypeScript. Scaffold whichever language you prefer — the two tabs in every later code example map 1:1 to the files below.

### Rust Project

```bash title=">_ Terminal"
miden new my-test-project
cd my-test-project
```

If successful, you'll see a new directory with Miden project files. For each Rust code example in the following pages, add a new binary under `integration/src/bin/` and run it with `cargo run --bin <name> --release`.

### TypeScript Project

The TypeScript examples use the [`@miden-sdk/miden-sdk`](https://www.npmjs.com/package/@miden-sdk/miden-sdk) package and its `MidenClient` API. The SDK ships WebAssembly that runs in the browser, so the simplest runnable setup is a minimal Vite project:

```bash title=">_ Terminal"
npm create vite@latest miden-app -- --template vanilla-ts
cd miden-app
npm install @miden-sdk/miden-sdk
```

Open `src/main.ts` and replace its contents with a simple entry point that calls your demo:

```ts title="src/main.ts"
import { demo } from "./demo";

demo().catch(console.error);
```

For each TypeScript snippet in the following pages, save it as `src/demo.ts` (or another name imported from `main.ts`) and run:

```bash title=">_ Terminal"
npm run dev
```

The SDK initialises WebAssembly on first use; open the Vite dev server URL in your browser and watch the devtools console for output.

---
