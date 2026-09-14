---
sidebar_position: 2
title: "Debugging Guide"
description: "Learn how to debug Miden Rust contracts using debug output and assertions."
---

# Debugging Guide

Miden supports [interactive DAP debugging](../../tools/clients/rust-client/debugging).
Use assertions to check values during execution and `miden::println!` markers to trace paths
when running with a debugger host that renders them.

## Printing Debug Markers

Use a literal or string expression to mark the path taken through a contract:

```rust
miden::println!("entered withdraw");

if balance == felt!(0) {
    miden::println!("balance is empty");
}
```

`miden::println!` accepts string literals and expressions. It also supports Rust-style formatting
arguments, such as `miden::println!("balance: {}", balance)`. Formatted output requires
`extern crate alloc` and a configured global allocator; literal markers don't allocate.

:::note Where Rust markers appear
With SDK 0.14.0, `miden::println!` emits a `readonly::miden_debug::println` event.
The normal Rust client and MockChain transaction executors ignore that event. Attaching a DAP
client preserves the transaction host's handlers, so the live DAP connection alone does not
make these messages appear.

The `miden-debug` local execution and replay host handles these events. For a transaction,
[record a DAP session and replay it](../../tools/clients/rust-client/debugging#recording-a-session-for-offline-replay)
to inspect the markers in the debugger's output. MASM's
[`miden::core::debug` printers](../../tools/clients/rust-client/debug-output) use separate events
that the normal transaction executor prints by default.
:::

## Using assert_eq

The `assert_eq` function compares two `Felt` values and fails if they differ:

```rust
use miden::*;

// Check if a value equals an expected value
assert_eq(actual_value, expected_value);
```

:::note
`assert_eq` is a **function**, not a macro. Use `assert_eq(a, b)` without the exclamation mark.
:::

## Narrowing Down Failures

Execution errors include source diagnostics when debug information is available. Combine those
diagnostics with markers and assertions to isolate the failing operation:

1. Place `miden::println!` markers before and after the code you suspect.
2. Add an `assert_eq` for the value the code expects.
3. Run with a debugger host that renders Rust markers and inspect the last marker and any assertion failure.

### Example

```rust
pub fn withdraw(&mut self, depositor: AccountId, amount: Felt) {
    let balance = self.get_balance(depositor);
    miden::println!("loaded balance");

    // Check the assumption used by the code below.
    assert_eq(balance, felt!(1000));

    let new_balance = balance - amount;
    self.balances.set(depositor, new_balance);
    miden::println!("updated balance");
}
```

Move the markers and assertion through the function to narrow down which assumption or operation
fails.

## Limitations

- `assert_eq` only works with `Felt` values
- `miden::println!` emits an event and adds execution work even when the host ignores it; remove debug-only calls
  from release code
- Remove only diagnostic assertions; keep assertions that enforce contract invariants
