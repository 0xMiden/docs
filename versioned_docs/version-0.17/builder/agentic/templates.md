---
title: "Choose a starter"
description: "Choose the existing full-stack, Rust or frontend template for your task."
---

# Choose a starter

| Starting point | Use it for | Context to read |
| --- | --- | --- |
| [Agentic template](https://github.com/0xMiden/agentic-template) | A full-stack Rust + React app, or source-grounded architecture and debugging questions | Root instructions plus both pinned subprojects |
| [Project template](https://github.com/0xMiden/project-template) | Rust contracts, MockChain assertions and a client counter example | Contract README, toolchain files and integration tests |
| [Frontend template](https://github.com/0xMiden/frontend-template) | A browser app consuming existing contracts | Project instructions and installed npm SDK guidance |
| [Agent tools](tools.md) | Shared ecosystem knowledge in an existing project | Selected skills and command prompt files |

For the full-stack path:

```bash
git clone --recurse-submodules https://github.com/0xMiden/agentic-template.git
cd agentic-template
git submodule status --recursive
```

For a clone missing submodules, initialize its checked-in pins with `git submodule update --init --recursive`. Avoid `--remote` during onboarding: it changes the source baseline. Compare the checkout with [Release and agent context](setup.md) before installing.

Inspect `setup.sh` before running it. The existing script can install prerequisites, fetch dependencies and build contracts; check whether its selected channel and lockfile behavior match your intended release. Use the subprojects' pinned installation instructions if they do not. A proposed release-pinned setup and stage runner are still under review; this guide does not require those unpublished commands.

Once Rust/rustup, a manifest-compatible midenup, Node 18+ and Yarn Classic 1 are available, the reviewed pins support explicit setup:

```bash
(cd project-template && midenup install 0.17.0)
(cd frontend-template && yarn install --frozen-lockfile)
```

The first command downloads the pinned channel; the checked-in project toolchain selects it. The second installs frontend dependencies without updating the lockfile and may run the package's configured preparation scripts. Verify installed SDK context afterward. If your pins differ, read their toolchain and package files before using this baseline.

For explanation or planning, ask the agent to cite source files and stop before installation or transaction execution. For implementation, use the [first-app flow](first-app.md) and record each stage's result.
