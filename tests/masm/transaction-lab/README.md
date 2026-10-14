# MASM transaction local validation fixture

Executable local validation fixture for the MASM transaction scripts, MockChain testing, and debugging guides.
Requires Rust 1.98.1. Protocol, standards, transaction, and testing crates are pinned to 0.17.1;
the lockfile resolves their VM dependencies to 0.35.0.

Run these checks before pushing changes to those guides or this fixture. The full
local checklist is in [the MASM fixture README](../README.md).

```bash
cargo +1.98.1 test --locked -- --nocapture
node check-guides.mjs
```

All six tests should pass. Deliberate compilation and execution failures print diagnostics and
are asserted by the tests. The debugging tests also compile and execute the repaired code.

- `expiry.masm`, `tests/transaction_scripts.rs`: expiry arguments, a signed Falcon wallet,
  successful expiration/nonce assertions, and rejection of invalid deltas.
- `tests/mock_chain.rs`: P2ID receipt, pending versus committed state, balance/nonce/nullifier
  assertions, and rejection of the wrong recipient.
- `tests/debugging.rs`: invalid instruction, source-located assertion failure, stack output,
  and repairs.

`Auth::IncrNonce` is test-only authentication. MockChain defaults to zero verification fees.
`add_pending_executed_transaction` uses a dummy transaction proof: these tests do not cover
production transaction proving, RPC submission, or live network inclusion. The transaction
script tests separately exercise real Falcon authentication.
