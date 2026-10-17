---
title: "Set up agentic-template"
sidebar_label: "Set up agentic-template"
description: "Prepare prerequisites, recursively clone the official agentic-template workspace, and install its pinned toolchain and dependencies."
---

# Set up agentic-template

Use the official full-stack workspace for this journey. Complete these steps before running release checks or asking your agent to use installed SDK guidance.

## Prerequisites

| Tool | What to prepare |
| --- | --- |
| Git, Bash, curl | Needed to clone the workspace and run its installer |
| Node.js and npm | Install manually before setup. Use Node.js 20.19.0+ within the 20.x line for this pinned frontend |
| Rust/rustup | The contracts pin `nightly-2026-09-01`, including `rust-src` and `wasm32-wasip2`; setup can install missing Rust and contract builds use the checked-in override |
| midenup and `miden` | Use a manifest-compatible midenup. Setup can install missing midenup, create the `miden` entry point, and install the checked-in channel `0.17.0` |
| Yarn Classic 1 | Setup can install it through npm if missing; Yarn 2+ is rejected |
| Python 3.11+ | Install separately for the optional agent-tools context checker and the Python local-node runner |
| Docker with Compose | Needed later for the disposable local-node check; it is not started by setup |

See [Miden toolchain installation](../get-started/setup/installation.md) for toolchain setup. Keep the checked-in Rust override, Miden manifest, and lockfiles.

The installer and `doctor` only require Node 18+, but the locked frontend includes `jsdom` 28.1.0, whose Node 20 range starts at 20.19.0. A passing prerequisite check does not establish package-engine compatibility. If you use a different Node major, check every locked package's supported range before installing.

## Clone the workspace

From the directory where you keep projects:

```bash
git clone --recurse-submodules https://github.com/0xMiden/agentic-template
cd agentic-template
```

Keep this shell at the workspace root for the rest of the journey. The clone initializes `project-template` and `frontend-template` at their checked-in commits.

For an existing clone that is missing its submodules, run this from its root before setup:

```bash
git submodule update --init --recursive
```

This initializes the recorded commits. Do not advance submodules to another branch during onboarding.

## Review and run setup

Inspect the installer before letting it change an existing development environment:

```bash
sed -n '1,240p' setup.sh
```

Then run it from the workspace root:

```bash
bash setup.sh
```

Setup can install missing Rust, midenup, and Yarn; it downloads the pinned Miden channel, runs the locked frontend dependency install, explicitly syncs SDK skills, and pre-builds both contracts. It needs network access and writes toolchains, dependencies, context files, and build outputs. It does not install Node or Python for you. Yarn 2+ or an incompatible existing midenup requires a separate fix before retrying.

Wait for `setup.sh: complete`. Only then continue to [Check your setup](templates.md), where `doctor`, installed-tool checks, and package-context checks belong. A successful install or skill sync alone does not establish that your agent discovered the guides or that app tests passed.

## Other starting points (optional)

The default journey uses agentic-template. If you only need one part of the stack, [project-template](https://github.com/0xMiden/project-template) provides the Rust contract project, and [frontend-template](https://github.com/0xMiden/frontend-template) provides the browser app. Follow their own setup instructions; the root journey helpers in this guide belong to agentic-template.

For an existing app, [add selected agent skills](tools.md) without replacing its source or project instructions.
