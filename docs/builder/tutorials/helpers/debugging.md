---
sidebar_position: 2
title: "Debugging Guide"
description: "Learn how to debug Miden Rust contracts using debug output and assertions."
---

# Debugging Guide

Miden contracts don't provide an interactive debugger or console. Use `miden::println!` to trace
execution paths and assertions to check values during execution.

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
3. Run again and inspect the last marker and any assertion failure.

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
- `miden::println!` emits output unconditionally and adds execution work; remove debug-only calls
  from release code
- Remove only diagnostic assertions; keep assertions that enforce contract invariants
