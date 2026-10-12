---
title: "Choose a template"
sidebar_label: "Choose a template"
description: "Choose a full-stack, Rust, or frontend starting point and install its pinned dependencies."
---

# Choose a template

Choose the smallest starting point that includes the code you need. Each template carries project instructions; browser SDK guidance comes from its installed npm packages.

## Templates

<CardGrid cols={3}>
  <Card title="Agentic template" href="https://github.com/0xMiden/agentic-template" eyebrow="Full stack · Agent workflow">
    Rust contracts, a React frontend, and explicit build, test, and local-node stages in one workspace.
  </Card>
  <Card title="Project template" href="https://github.com/0xMiden/project-template" eyebrow="Rust · Contracts">
    Contract packages, MockChain tests, and a client counter example.
  </Card>
  <Card title="Frontend template" href="https://github.com/0xMiden/frontend-template" eyebrow="React · Browser">
    Build a browser app around existing contracts with installed SDK guidance.
  </Card>
</CardGrid>

For an existing project, [install selected agent skills](tools.md) rather than copying a new app template over it.

## Set up the full-stack workspace

Install Rust/rustup, a manifest-compatible midenup, Node.js 20.19.0+ within the 20.x line, Yarn Classic 1, and Python 3.11+. Check package engines before choosing another Node release. Docker with Compose is needed for local-node validation.

```bash
git clone --recurse-submodules https://github.com/0xMiden/agentic-template.git
cd agentic-template
bash scripts/journey.sh doctor
bash setup.sh
```

`doctor` checks prerequisites and source pins. `setup.sh` can install missing prerequisites, downloads the checked-in Miden channel, installs locked frontend dependencies, explicitly syncs SDK skills, and builds the contracts. Inspect it before running if your environment already has toolchains you need to preserve.

If you cloned without submodules, initialize the checked-in pins with `git submodule update --init --recursive`. Avoid `--remote` during setup: it changes the source baseline.

After setup, [verify the installed context](verify.md). SDK skill sync does not necessarily create the frontend's root package-guide pointers; initialize and check them before relying on agent discovery.

For architecture or source questions, you can use the workspace without executing the build flow. For implementation, continue to [Build your first app](first-app.md).
