const OG_IMAGE_ROOT = "img/og";
const DEFAULT_OG_IMAGE = `${OG_IMAGE_ROOT}/miden-docs.png`;

type OgImageRule = {
  pathPrefix: string;
  image: string;
  description: string;
};

const OG_IMAGE_RULES: OgImageRule[] = [
  {
    pathPrefix: "/builder/get-started/your-first-smart-contract",
    image: "first-smart-contract.png",
    description: "Create, test, and deploy a minimal Miden account component.",
  },
  {
    pathPrefix: "/builder/tools/clients/react-sdk",
    image: "react-sdk.png",
    description: "Hooks and provider patterns for browser-based Miden applications.",
  },
  {
    pathPrefix: "/builder/tools/clients/rust-client/get-started",
    image: "rust-client-get-started.png",
    description: "Create accounts, use faucets, and move assets with the Rust client.",
  },
  {
    pathPrefix: "/builder/tools/clients/rust-client/cli",
    image: "rust-client-cli.png",
    description: "Configure and operate the Miden client command-line interface.",
  },
  {
    pathPrefix: "/builder/tools/clients/rust-client",
    image: "rust-client.png",
    description: "Programmatic accounts, notes, transactions, and local client state.",
  },
  {
    pathPrefix: "/builder/tools/clients/web-client",
    image: "typescript-client.png",
    description: "Browser and React flows for Miden apps using the TypeScript SDK.",
  },
  {
    pathPrefix: "/builder/tutorials/miden-bank",
    image: "miden-bank.png",
    description: "A complete contract tutorial covering components, notes, and flows.",
  },
  {
    pathPrefix: "/builder/tutorials/recipes/web",
    image: "typescript-recipes.png",
    description: "Browser and React examples for Miden applications.",
  },
  {
    pathPrefix: "/builder/tutorials/recipes/rust",
    image: "rust-recipes.png",
    description: "Runnable Rust client examples for common Miden development flows.",
  },
  {
    pathPrefix: "/builder/tools/clients",
    image: "clients.png",
    description: "Rust, TypeScript, and React interfaces for Miden applications.",
  },
  {
    pathPrefix: "/builder/tools/note-transport",
    image: "note-transport.png",
    description: "Transport public notes across clients without taking custody of assets.",
  },
  {
    pathPrefix: "/builder/tools",
    image: "tools.png",
    description: "Clients, SDKs, CLIs, transport services, and development utilities.",
  },
  {
    pathPrefix: "/builder/miden-guardian",
    image: "miden-guardian.png",
    description: "Assisted self-custody flows for safer account recovery and operation.",
  },
  {
    pathPrefix: "/builder/private-multisig",
    image: "private-multisig.png",
    description: "Account patterns for private approvals and coordinated execution.",
  },
  {
    pathPrefix: "/builder/smart-contracts/accounts",
    image: "smart-contract-accounts.png",
    description: "Account components, storage, authentication, and account operations.",
  },
  {
    pathPrefix: "/builder/smart-contracts/notes",
    image: "smart-contract-notes.png",
    description: "Programmable messages that carry assets, scripts, and execution context.",
  },
  {
    pathPrefix: "/builder/smart-contracts/transactions",
    image: "smart-contract-transactions.png",
    description: "Scripts, context, advice data, and execution patterns on Miden.",
  },
  {
    pathPrefix: "/builder/smart-contracts/standards",
    image: "miden-standards.png",
    description: "Reusable account components, note scripts, faucets, and policy modules.",
  },
  {
    pathPrefix: "/builder/smart-contracts",
    image: "smart-contracts.png",
    description: "Write Miden account logic and notes in Rust or MASM.",
  },
  {
    pathPrefix: "/builder/tutorials",
    image: "tutorials.png",
    description: "Runnable walkthroughs for client apps, contracts, and local development.",
  },
  {
    pathPrefix: "/builder/get-started",
    image: "get-started.png",
    description: "Install the tools, create accounts, move notes, and read account state.",
  },
  {
    pathPrefix: "/builder/migration",
    image: "migration.png",
    description: "Version-to-version changes for Miden builders and client integrations.",
  },
  {
    pathPrefix: "/builder/glossary",
    image: "reference.png",
    description: "Glossary, FAQ, and supporting reference material for Miden builders.",
  },
  {
    pathPrefix: "/builder/faq",
    image: "reference.png",
    description: "Glossary, FAQ, and supporting reference material for Miden builders.",
  },
  {
    pathPrefix: "/builder",
    image: "build.png",
    description: "Start building private, verifiable applications on the Miden layer 2.",
  },
  {
    pathPrefix: "/core-concepts/protocol/account",
    image: "protocol-accounts.png",
    description: "Account identifiers, code, storage, vaults, and authentication rules.",
  },
  {
    pathPrefix: "/core-concepts/protocol",
    image: "protocol.png",
    description: "Accounts, notes, transactions, proving, and state transition rules.",
  },
  {
    pathPrefix: "/core-concepts/miden-base/account",
    image: "protocol-accounts.png",
    description: "Account identifiers, code, storage, vaults, and authentication rules.",
  },
  {
    pathPrefix: "/core-concepts/miden-base",
    image: "protocol.png",
    description: "Accounts, notes, transactions, proving, and state transition rules.",
  },
  {
    pathPrefix: "/core-concepts/node/operator",
    image: "node-operator.png",
    description: "Run, configure, and observe Miden node infrastructure.",
  },
  {
    pathPrefix: "/core-concepts/node",
    image: "node.png",
    description: "Network components, transaction flow, block production, and sync.",
  },
  {
    pathPrefix: "/core-concepts/miden-node/operator",
    image: "node-operator.png",
    description: "Run, configure, and observe Miden node infrastructure.",
  },
  {
    pathPrefix: "/core-concepts/miden-node",
    image: "node.png",
    description: "Network components, transaction flow, block production, and sync.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm/user_docs/assembly",
    image: "miden-assembly.png",
    description: "Instruction-level programming and MASM module structure.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm/user_docs/core_lib",
    image: "core-library.png",
    description: "Standard MASM modules and reusable VM procedures.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm/user_docs",
    image: "vm-user-docs.png",
    description: "Assembly, standard libraries, debugging, and VM-facing developer flows.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm/design/stack",
    image: "vm-stack.png",
    description: "Operand stack semantics, execution state, and stack constraints.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm/design",
    image: "vm-design.png",
    description: "Execution traces, stack model, chiplets, lookups, and constraints.",
  },
  {
    pathPrefix: "/core-concepts/miden-vm",
    image: "miden-vm.png",
    description: "The STARK-based virtual machine that executes Miden programs.",
  },
  {
    pathPrefix: "/core-concepts/compiler/usage",
    image: "compiler-usage.png",
    description: "Compile, inspect, and integrate Rust components with midenc.",
  },
  {
    pathPrefix: "/core-concepts/compiler/guides",
    image: "compiler-guides.png",
    description: "Practical compiler workflows for Miden builders.",
  },
  {
    pathPrefix: "/core-concepts/compiler/appendix",
    image: "compiler-appendix.png",
    description: "Compiler reference material and lower-level implementation details.",
  },
  {
    pathPrefix: "/core-concepts/compiler",
    image: "compiler.png",
    description: "Compile Rust components into Miden Assembly and executable artifacts.",
  },
  {
    pathPrefix: "/core-concepts",
    image: "core-concepts.png",
    description: "Technical foundations for the protocol, node, VM, and compiler.",
  },
  {
    pathPrefix: "/quick-start/your-first-smart-contract",
    image: "first-smart-contract.png",
    description: "Create, test, and deploy a minimal Miden account component.",
  },
  {
    pathPrefix: "/quick-start",
    image: "get-started.png",
    description: "Install the tools, create accounts, move notes, and read account state.",
  },
  {
    pathPrefix: "/miden-client/rust-client",
    image: "rust-client.png",
    description: "Programmatic accounts, notes, transactions, and local client state.",
  },
  {
    pathPrefix: "/miden-client/web-client",
    image: "typescript-client.png",
    description: "Browser and React flows for Miden apps using the TypeScript SDK.",
  },
  {
    pathPrefix: "/miden-client",
    image: "clients.png",
    description: "Rust, TypeScript, and React interfaces for Miden applications.",
  },
  {
    pathPrefix: "/miden-tutorials/rust-client",
    image: "rust-recipes.png",
    description: "Runnable Rust client examples for common Miden development flows.",
  },
  {
    pathPrefix: "/miden-tutorials/web-client",
    image: "typescript-recipes.png",
    description: "Browser and React examples for Miden applications.",
  },
  {
    pathPrefix: "/miden-tutorials",
    image: "tutorials.png",
    description: "Runnable walkthroughs for client apps, contracts, and local development.",
  },
  {
    pathPrefix: "/miden-base/account",
    image: "protocol-accounts.png",
    description: "Account identifiers, code, storage, vaults, and authentication rules.",
  },
  {
    pathPrefix: "/miden-base",
    image: "protocol.png",
    description: "Accounts, notes, transactions, proving, and state transition rules.",
  },
  {
    pathPrefix: "/miden-node/operator",
    image: "node-operator.png",
    description: "Run, configure, and observe Miden node infrastructure.",
  },
  {
    pathPrefix: "/miden-node",
    image: "node.png",
    description: "Network components, transaction flow, block production, and sync.",
  },
  {
    pathPrefix: "/miden-vm/user_docs/assembly",
    image: "miden-assembly.png",
    description: "Instruction-level programming and MASM module structure.",
  },
  {
    pathPrefix: "/miden-vm/user_docs/core_lib",
    image: "core-library.png",
    description: "Standard MASM modules and reusable VM procedures.",
  },
  {
    pathPrefix: "/miden-vm/user_docs",
    image: "vm-user-docs.png",
    description: "Assembly, standard libraries, debugging, and VM-facing developer flows.",
  },
  {
    pathPrefix: "/miden-vm/design/stack",
    image: "vm-stack.png",
    description: "Operand stack semantics, execution state, and stack constraints.",
  },
  {
    pathPrefix: "/miden-vm/design",
    image: "vm-design.png",
    description: "Execution traces, stack model, chiplets, lookups, and constraints.",
  },
  {
    pathPrefix: "/miden-vm",
    image: "miden-vm.png",
    description: "The STARK-based virtual machine that executes Miden programs.",
  },
  {
    pathPrefix: "/compiler/usage",
    image: "compiler-usage.png",
    description: "Compile, inspect, and integrate Rust components with midenc.",
  },
  {
    pathPrefix: "/compiler/guides",
    image: "compiler-guides.png",
    description: "Practical compiler workflows for Miden builders.",
  },
  {
    pathPrefix: "/compiler/appendix",
    image: "compiler-appendix.png",
    description: "Compiler reference material and lower-level implementation details.",
  },
  {
    pathPrefix: "/compiler",
    image: "compiler.png",
    description: "Compile Rust components into Miden Assembly and executable artifacts.",
  },
];

function normalizeDocPath(permalink: string): string {
  const pathname = permalink.startsWith("http")
    ? new URL(permalink).pathname
    : permalink;
  const withoutTrailingSlash = pathname.replace(/\/+$/, "") || "/";

  const withoutVersionPrefix = withoutTrailingSlash.replace(
    /^\/(?:next|\d+\.\d+)(?=\/|$)/,
    "",
  );

  if (withoutVersionPrefix) {
    return withoutVersionPrefix;
  }

  return "/";
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getDocOgImage(permalink: string): string {
  const normalizedPath = normalizeDocPath(permalink);
  const rule = OG_IMAGE_RULES.find(({ pathPrefix }) =>
    matchesPathPrefix(normalizedPath, pathPrefix),
  );

  return rule ? `${OG_IMAGE_ROOT}/${rule.image}` : DEFAULT_OG_IMAGE;
}

export function getDocOgDescription(permalink: string): string {
  const normalizedPath = normalizeDocPath(permalink);
  const rule = OG_IMAGE_RULES.find(({ pathPrefix }) =>
    matchesPathPrefix(normalizedPath, pathPrefix),
  );

  return rule?.description ?? "Documentation for building, integrating, and understanding Miden.";
}
