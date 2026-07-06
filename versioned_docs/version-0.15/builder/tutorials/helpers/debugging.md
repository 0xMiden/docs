---
sidebar_position: 2
title: "Debugging Guide"
description: "Learn how to debug Miden Rust contracts using assert_eq and cycle counts."
---

# Debugging Guide

Miden contracts don't support traditional debugging tools like console.log or print statements. Instead, you can use `assert_eq` statements to check values during execution.

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

## Debugging with Cycle Counts

When your code fails, the error output includes a **cycle count** indicating where execution stopped. You can use this to narrow down problems:

1. **Note the cycle count** when your code fails
2. **Place an `assert_eq`** before the code you suspect is failing
3. **Run again** and check the result:
   - If the assertion fails at an **earlier cycle count**: the value you're checking is wrong
   - If the assertion passes and fails at the **same cycle count**: the value is correct, the problem is elsewhere

### Example

```rust
pub fn withdraw(&mut self, depositor: AccountId, amount: Felt) {
    let balance = self.get_balance(depositor);

    // Debug: Check if balance is what you expect
    assert_eq(balance, felt!(1000));

    // If the above passes, the problem is below this line
    // If it fails, the balance isn't what you expected

    let new_balance = balance - amount;
    self.balances.set(key, new_balance);
}
```

By moving the `assert_eq` statement around, you can isolate which value is incorrect.

## Limitations

- No console.log or print debugging in contract code
- `assert_eq` only works with `Felt` values
- This is currently the primary debugging technique available
