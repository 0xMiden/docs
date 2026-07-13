import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "static", "img", "og");

const width = 1200;
const height = 630;

const images = [
  {
    id: "miden-docs",
    eyebrow: "Miden Docs",
    title: "Miden Docs",
    description: "Documentation for building, integrating, and understanding Miden.",
    accent: "#ff5500",
    panel: "DOCS",
  },
  {
    id: "build",
    eyebrow: "Build",
    title: "Build on Miden",
    description: "Start building private, verifiable applications on the Miden rollup.",
    accent: "#ff5500",
    panel: "BUILD",
  },
  {
    id: "get-started",
    eyebrow: "Build",
    title: "Get Started",
    description: "Install the tools, create accounts, move notes, and read account state.",
    accent: "#ff5500",
    panel: "START",
  },
  {
    id: "first-smart-contract",
    eyebrow: "Get Started",
    title: "Your First Smart Contract",
    description: "Create, test, and deploy a minimal Miden account component.",
    accent: "#ff5500",
    panel: "FIRST",
  },
  {
    id: "smart-contracts",
    eyebrow: "Build",
    title: "Smart Contracts",
    description: "Write Miden account logic and notes in Rust or MASM.",
    accent: "#ff5500",
    panel: "CONTRACT",
  },
  {
    id: "smart-contract-accounts",
    eyebrow: "Smart Contracts",
    title: "Accounts",
    description: "Account components, storage, authentication, and account operations.",
    accent: "#ff5500",
    panel: "ACCOUNTS",
  },
  {
    id: "smart-contract-notes",
    eyebrow: "Smart Contracts",
    title: "Notes",
    description: "Programmable messages that carry assets, scripts, and execution context.",
    accent: "#ff5500",
    panel: "NOTES",
  },
  {
    id: "smart-contract-transactions",
    eyebrow: "Smart Contracts",
    title: "Transactions",
    description: "Scripts, context, advice data, and execution patterns on Miden.",
    accent: "#ff5500",
    panel: "TX",
  },
  {
    id: "miden-standards",
    eyebrow: "Smart Contracts",
    title: "Miden Standards",
    description: "Reusable account components, note scripts, faucets, and policy modules.",
    accent: "#ff5500",
    panel: "STD",
  },
  {
    id: "tutorials",
    eyebrow: "Build",
    title: "Tutorials",
    description: "Runnable walkthroughs for client apps, contracts, and local development.",
    accent: "#ff5500",
    panel: "RUN",
  },
  {
    id: "miden-bank",
    eyebrow: "Tutorials",
    title: "Miden Bank",
    description: "A complete contract tutorial covering components, notes, and flows.",
    accent: "#ff5500",
    panel: "BANK",
  },
  {
    id: "rust-recipes",
    eyebrow: "Recipes",
    title: "Rust Recipes",
    description: "Runnable Rust client examples for common Miden development flows.",
    accent: "#ff5500",
    panel: "RUST",
  },
  {
    id: "typescript-recipes",
    eyebrow: "Recipes",
    title: "TypeScript Recipes",
    description: "Browser and React examples for Miden applications.",
    accent: "#ff5500",
    panel: "TS",
  },
  {
    id: "tools",
    eyebrow: "Build",
    title: "Tools",
    description: "Clients, SDKs, CLIs, transport services, and development utilities.",
    accent: "#ff5500",
    panel: "TOOLS",
  },
  {
    id: "clients",
    eyebrow: "Tools",
    title: "Clients",
    description: "Rust, TypeScript, and React interfaces for Miden applications.",
    accent: "#ff5500",
    panel: "CLIENT",
  },
  {
    id: "react-sdk",
    eyebrow: "Clients",
    title: "React SDK",
    description: "Hooks and provider patterns for browser-based Miden applications.",
    accent: "#ff5500",
    panel: "REACT",
  },
  {
    id: "rust-client",
    eyebrow: "Clients",
    title: "Rust Client",
    description: "Programmatic accounts, notes, transactions, and local client state.",
    accent: "#ff5500",
    panel: "RUST",
  },
  {
    id: "rust-client-get-started",
    eyebrow: "Rust Client",
    title: "Get Started",
    description: "Create accounts, use faucets, and move assets with the Rust client.",
    accent: "#ff5500",
    panel: "RUST",
  },
  {
    id: "rust-client-cli",
    eyebrow: "Rust Client",
    title: "CLI",
    description: "Configure and operate the Miden client command-line interface.",
    accent: "#ff5500",
    panel: "CLI",
  },
  {
    id: "typescript-client",
    eyebrow: "Clients",
    title: "TypeScript Client",
    description: "Browser and React flows for Miden apps using the TypeScript SDK.",
    accent: "#ff5500",
    panel: "TS",
  },
  {
    id: "note-transport",
    eyebrow: "Tools",
    title: "Note Transport",
    description: "Transport public notes across clients without taking custody of assets.",
    accent: "#ff5500",
    panel: "NOTES",
  },
  {
    id: "miden-guardian",
    eyebrow: "Build",
    title: "Miden Guardian",
    description: "Assisted self-custody flows for safer account recovery and operation.",
    accent: "#ff5500",
    panel: "GUARD",
  },
  {
    id: "migration",
    eyebrow: "Build",
    title: "Migration",
    description: "Version-to-version changes for Miden builders and client integrations.",
    accent: "#ff5500",
    panel: "MIGRATE",
  },
  {
    id: "reference",
    eyebrow: "Build",
    title: "Reference",
    description: "Glossary, FAQ, and supporting reference material for Miden builders.",
    accent: "#ff5500",
    panel: "REF",
  },
  {
    id: "core-concepts",
    eyebrow: "Reference",
    title: "Reference",
    description: "Technical foundations for the protocol, node, VM, and compiler.",
    accent: "#ff5500",
    panel: "SPEC",
  },
  {
    id: "protocol",
    eyebrow: "Reference",
    title: "Protocol",
    description: "Accounts, notes, transactions, proving, and state transition rules.",
    accent: "#ff5500",
    panel: "PROTO",
  },
  {
    id: "protocol-accounts",
    eyebrow: "Protocol",
    title: "Accounts",
    description: "Account identifiers, code, storage, vaults, and authentication rules.",
    accent: "#ff5500",
    panel: "ACCOUNT",
  },
  {
    id: "node",
    eyebrow: "Reference",
    title: "Node",
    description: "Network components, transaction flow, block production, and sync.",
    accent: "#ff5500",
    panel: "NODE",
  },
  {
    id: "node-operator",
    eyebrow: "Node",
    title: "Operator Guide",
    description: "Run, configure, and observe Miden node infrastructure.",
    accent: "#ff5500",
    panel: "OPS",
  },
  {
    id: "miden-vm",
    eyebrow: "Reference",
    title: "Miden VM",
    description: "The STARK-based virtual machine that executes Miden programs.",
    accent: "#ff5500",
    panel: "VM",
  },
  {
    id: "vm-user-docs",
    eyebrow: "Miden VM",
    title: "User Docs",
    description: "Assembly, standard libraries, debugging, and VM-facing developer flows.",
    accent: "#ff5500",
    panel: "VM",
  },
  {
    id: "miden-assembly",
    eyebrow: "Miden VM",
    title: "Miden Assembly",
    description: "Instruction-level programming and MASM module structure.",
    accent: "#ff5500",
    panel: "MASM",
  },
  {
    id: "core-library",
    eyebrow: "Miden VM",
    title: "Core Library",
    description: "Standard MASM modules and reusable VM procedures.",
    accent: "#ff5500",
    panel: "LIB",
  },
  {
    id: "vm-design",
    eyebrow: "Miden VM",
    title: "VM Design",
    description: "Execution traces, stack model, chiplets, lookups, and constraints.",
    accent: "#ff5500",
    panel: "TRACE",
  },
  {
    id: "vm-stack",
    eyebrow: "Miden VM",
    title: "Stack",
    description: "Operand stack semantics, execution state, and stack constraints.",
    accent: "#ff5500",
    panel: "STACK",
  },
  {
    id: "compiler",
    eyebrow: "Reference",
    title: "Compiler",
    description: "Compile Rust components into Miden Assembly and executable artifacts.",
    accent: "#ff5500",
    panel: "MIDENC",
  },
  {
    id: "compiler-usage",
    eyebrow: "Compiler",
    title: "Usage",
    description: "Compile, inspect, and integrate Rust components with midenc.",
    accent: "#ff5500",
    panel: "USE",
  },
  {
    id: "compiler-guides",
    eyebrow: "Compiler",
    title: "Guides",
    description: "Practical compiler workflows for Miden builders.",
    accent: "#ff5500",
    panel: "GUIDE",
  },
  {
    id: "compiler-appendix",
    eyebrow: "Compiler",
    title: "Appendix",
    description: "Compiler reference material and lower-level implementation details.",
    accent: "#ff5500",
    panel: "APPENDIX",
  },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleLines(title) {
  if (title.length <= 17) {
    return [title];
  }

  const words = title.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 17 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

function wrapText(text, maxLength, maxLines = 3) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines);
  const lastLine = visibleLines[maxLines - 1];
  visibleLines[maxLines - 1] =
    lastLine.length > maxLength - 1
      ? `${lastLine.slice(0, maxLength - 1)}...`
      : `${lastLine}...`;

  return visibleLines;
}

function svgFor(image) {
  const [lineOne, lineTwo] = titleLines(image.title);
  const descriptionLines = wrapText(image.description, 38, 3);
  const hasSecondLine = Boolean(lineTwo);
  const titleOneY = hasSecondLine ? 254 : 284;
  const titleTwoY = 324;
  const descriptionY = hasSecondLine ? 382 : 356;
  const ctaY = hasSecondLine ? 492 : 472;
  const badgeWidth = Math.max(150, Math.min(270, image.eyebrow.length * 12 + 48));
  const escapedTitleOne = escapeHtml(lineOne);
  const escapedTitleTwo = lineTwo ? escapeHtml(lineTwo) : "";
  const descriptionSvg = descriptionLines
    .map(
      (line, index) =>
        `<text x="524" y="${descriptionY + index * 32}" fill="#d5cbbf" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" letter-spacing="0">${escapeHtml(line)}</text>`,
    )
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f8f7f2"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#23201d"/>
  <path d="M0 0H408V630H0V0Z" fill="#f7f2ea"/>
  <path d="M408 0H1200V630H408V0Z" fill="#25221f"/>
  <path d="M442 80H1124" stroke="#514a43" stroke-width="1"/>
  <path d="M442 550H1124" stroke="#514a43" stroke-width="1"/>
  <path d="M474 112V520" stroke="#403a34" stroke-width="1"/>
  <path d="M1092 112V520" stroke="#403a34" stroke-width="1"/>
  <path d="M0 0H408V630H0V0Z" fill="${image.accent}" opacity="0.08"/>
  <path d="M86 138H320" stroke="#ded5c8" stroke-width="1"/>
  <path d="M86 492H320" stroke="#ded5c8" stroke-width="1"/>
  <path d="M100 156H306V474H100V156Z" fill="#fffaf4" stroke="#2b2824" stroke-width="2"/>
  <path d="M100 214H306" stroke="#2b2824" stroke-width="2"/>
  <path d="M126 184H186" stroke="${image.accent}" stroke-width="12" stroke-linecap="square"/>
  <path d="M206 184H258" stroke="#2b2824" stroke-width="12" stroke-linecap="square"/>
  <path d="M128 260H278" stroke="#2b2824" stroke-width="9" stroke-linecap="square"/>
  <path d="M128 294H252" stroke="#6d665d" stroke-width="9" stroke-linecap="square"/>
  <path d="M128 328H280" stroke="#2b2824" stroke-width="9" stroke-linecap="square"/>
  <path d="M128 362H232" stroke="#6d665d" stroke-width="9" stroke-linecap="square"/>
  <path d="M128 420H194" stroke="${image.accent}" stroke-width="12" stroke-linecap="square"/>
  <circle cx="306" cy="156" r="28" fill="${image.accent}"/>
  <path d="M294 156H318M306 144V168" stroke="#fffaf4" stroke-width="4" stroke-linecap="square"/>
  <text x="84" y="84" fill="#2b2824" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="0">Miden Docs</text>
  <text x="86" y="552" fill="#6d665d" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${escapeHtml(image.panel)}</text>
  <rect x="520" y="138" width="${badgeWidth}" height="38" fill="${image.accent}"/>
  <text x="544" y="164" fill="#fffaf4" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">${escapeHtml(image.eyebrow.toUpperCase())}</text>
  <text x="520" y="${titleOneY}" fill="#fffaf4" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="800" letter-spacing="0">${escapedTitleOne}</text>
  ${hasSecondLine ? `<text x="520" y="${titleTwoY}" fill="#fffaf4" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="800" letter-spacing="0">${escapedTitleTwo}</text>` : ""}
  ${descriptionSvg}
  <rect x="520" y="${ctaY}" width="214" height="46" fill="${image.accent}"/>
  <text x="544" y="${ctaY + 30}" fill="#fffaf4" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="1.4">READ THE DOCS</text>
  <text x="760" y="${ctaY + 30}" fill="#d5cbbf" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="0">docs.miden.xyz</text>
  <g opacity="0.16">
    <path d="M1030 118H1092V180H1030V118Z" stroke="#fffaf4" stroke-width="2"/>
    <path d="M999 149H1123" stroke="#fffaf4" stroke-width="2"/>
    <path d="M1061 87V211" stroke="#fffaf4" stroke-width="2"/>
  </g>
</svg>`;
}

await mkdir(outputDir, { recursive: true });

for (const image of images) {
  const svg = svgFor(image);
  await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, `${image.id}.png`));
}

console.log(`Generated ${images.length} OG PNGs in ${path.relative(rootDir, outputDir)}`);
