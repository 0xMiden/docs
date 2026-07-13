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
v20.11.0
1.22.19
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

This creates the `$MIDENUP_HOME` directory and sets up symlinks for the `miden` command.

**Configure PATH**

Add the midenup bin directory to your PATH. First, check your current `$MIDENUP_HOME`:

```bash title=">_ Terminal"
midenup show home
```

Then add it to your shell configuration:

**For Zsh (macOS default):**

```bash title="~/.zshrc"
export PATH="/Users/$(whoami)/Library/Application Support/midenup/bin:$PATH"
source ~/.zshrc
```

**For Bash:**

```bash title="~/.bashrc"
export PATH="$XDG_DATA_DIR/midenup/bin:$PATH"
source ~/.bashrc
```

**Install Miden Toolchain**

Install the latest stable Miden components:

```bash title=">_ Terminal"
midenup install stable
```

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

```bash title=">_ Terminal"
which miden
```

<details>
<summary>Expected output</summary>

```text
/Users/<USERNAME>/Library/Application Support/midenup/bin/miden
```

</details>

Test by creating a new project:

```bash title=">_ Terminal"
miden new my-test-project
cd my-test-project
```

If successful, you'll see a new directory with Miden project files. The `cd` command enters the project directory, which you'll need for the following guides.

### Troubleshooting

**"miden: command not found"**

This means the PATH isn't configured correctly. Verify midenup's bin directory is in your PATH:

```bash title=">_ Terminal"
echo $PATH | grep midenup
```

If missing, re-add the export command to your shell configuration and reload it.

---
