---
title: "Installation"
sidebar_position: 1
---

<!-- markdownlint-disable MD033 MD041 -->

import Tabs from "@theme/Tabs"; import TabItem from "@theme/TabItem";

# Installation

The Miden node can be installed as a native binary, or as a Docker image.

<Tabs groupId="full-node-runtime" defaultValue="native">
  <TabItem value="native" label="Native binary">

Install the node release pinned by this v0.16 snapshot:

```bash
cargo install miden-node --version 0.16.0 --locked
```

Check the installed binary:

```bash
miden-node --help
```

You can also install directly from a repository revision when you need an unreleased version:

```bash
cargo install miden-node --git https://github.com/0xMiden/node.git --rev d6ce8b14d4680e0187b877c1de5c1cdeea16e7e2 --locked
```

Create a data directory for node state:

```bash
mkdir -p full-node-data
```

  </TabItem>
  <TabItem value="docker" label="Docker image">

Pull the published image:

```bash
docker pull ghcr.io/0xmiden/miden-node:0.16.0
```

Check the image:

```bash
docker run --rm ghcr.io/0xmiden/miden-node:0.16.0 miden-node --help
```

Create a Docker volume for node state:

```bash
docker volume create miden-full-node-data
```

  </TabItem>
</Tabs>

<!-- markdownlint-enable MD033 MD041 -->
