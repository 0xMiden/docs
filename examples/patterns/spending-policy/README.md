# Contract spending policy

A local, executable account-component example for the Patterns guide. A single
configured fungible asset has a lifetime allowance stored as a u32. Each guarded
send decrements it and moves assets to an output note. Falcon singlesig authorizes
the transaction; receipts do not reset the allowance. MockChain uses an explicitly
zero verification fee. The budget covers explicit sends; it does not count fees
paid separately by the shipped authentication component on a nonzero-fee chain.

Requires Rust 1.98.1. From the docs repository root:

```sh
cargo +1.98.1 test --locked --manifest-path examples/patterns/spending-policy/Cargo.toml
python3 examples/patterns/spending-policy/check-docs.py
```

Pins: protocol, standards, testing and transaction executor 0.17.1; processor/VM
0.35.0. The lockfile records the full dependency graph. The account's code exports
the guarded send, note creation and asset receipt; it excludes BasicWallet's
unrestricted send and generic storage/code setters.

The 11 transaction tests cover below/exact/above allowance, u32 max and above,
zero amount/allowance, cumulative calls and committed transactions, refill without
reset, missing authenticator, wrong Falcon signature, and two bypass attempts.
Tests verify output assets, vault changes, persistent storage, nonce, committed
state and exact policy/VM error variants. All assets, keys, notes and blocks are
local fixtures. No network or real transactions are required.

This educational example has no reset, recipient restriction or production
custody integration. It does not exercise nonzero fees or fee sponsorship.
Review all components before extending it:
another exported removal procedure or slot setter would bypass this policy.
