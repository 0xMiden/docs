---
title: Debugging MASM
description: Reproduce MASM compilation and runtime failures, inspect source diagnostics and stack output, and verify repairs.
sidebar_position: 6
---

# Debugging MASM

Start with a small, repeatable transaction that uses the same account, note, arguments, and libraries as the failing case. Separate compilation errors from transaction execution errors; a correct assembly program can still violate an account or kernel rule.

This walkthrough uses the **0.17.1** project and Rust **1.98.1** prerequisites from [MASM transaction scripts](./transaction-scripts). From `docs/examples/masm/transaction-lab`, run:

```bash
cargo +1.98.1 test --locked --test debugging -- --nocapture
```

Both tests pass. Each deliberately causes a failure and then checks a repair. `--nocapture` makes the compiler diagnostics and stack output visible.

## Reproduce a compiler error and a runtime assertion

```rust title="tests/debugging.rs"
use std::sync::Arc;

use miden_protocol::assembly::DefaultSourceManager;
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};

#[test]
fn assembly_error_reports_invalid_instruction() {
    let error = CodeBuilder::default()
        .compile_tx_script("@transaction_script pub proc main pus.10 end")
        .expect_err("misspelled push must fail to compile");
    let diagnostic = error.to_string();
    println!("{diagnostic}");
    assert!(diagnostic.contains("pus"), "{diagnostic}");
    CodeBuilder::default()
        .compile_tx_script("@transaction_script pub proc main push.10 drop end")
        .expect("corrected instruction must compile");
}

#[tokio::test]
async fn assertion_reports_message_and_stack_output() -> anyhow::Result<()> {
    let source_manager = Arc::new(DefaultSourceManager::default());
    let source = r#"
use miden::core::debug
@transaction_script
pub proc main
    dropw
    push.10
    exec.debug::print_stack
    eq.11 assert.err="expected expiry delta 11"
end
"#;
    let script =
        CodeBuilder::with_source_manager(source_manager.clone()).compile_tx_script(source)?;
    let mut builder = MockChain::builder();
    let wallet = builder.add_existing_wallet(Auth::IncrNonce)?;
    let chain = builder.build()?;
    let error = chain
        .build_transaction(wallet.id())
        .tx_script(script)
        .with_source_manager(source_manager.clone())
        .build()?
        .execute()
        .await
        .expect_err("10 does not equal 11");
    let diagnostic = error.to_string();
    println!("{diagnostic}");
    assert!(
        diagnostic.contains("expected expiry delta 11"),
        "{diagnostic}"
    );
    let repaired = CodeBuilder::with_source_manager(source_manager.clone())
        .compile_tx_script(source.replace("eq.11", "eq.10"))?;
    chain
        .build_transaction(wallet.id())
        .tx_script(repaired)
        .with_source_manager(source_manager)
        .build()?
        .execute()
        .await?;
    Ok(())
}
```

The first test misspells `push` as `pus`. Compilation reports ``invalid instruction `pus` or malformed operands``, with the source location `::tx_script:1:35`. Correcting the instruction makes compilation succeed. Fix parse or import errors before investigating transaction state.

The second test compiles successfully. It drops the entry argument word, pushes 10, prints the operand stack, and then compares 10 with 11. Execution fails with:

```text
assertion failed with error message: expected expiry delta 11
::tx_script:8:11
```

The diagnostic points at `assert.err` on the `eq.11` line. The repair changes the comparison to `eq.10`, recompiles the script, and executes it successfully against the same chain state.

## Keep source information attached

Share one `DefaultSourceManager` between `CodeBuilder::with_source_manager` and the transaction builder's `.with_source_manager`. Keep the compiled script's package debug information. Constructing a script manually from bare MAST parts loses the package-owned debug information needed to recover source locations and assertion messages.

Display the complete executor error with `{error}` or `error.to_string()`. For a `CodeBuilderError` with an underlying error, format the full error chain when needed, for example `{error:#}` after wrapping it with `anyhow::Error`. Preserve the original diagnostic when adding application context.

## Inspect the stack at the boundary

`exec.debug::print_stack` uses the `miden::core::debug` library. The transaction host used by MockChain renders this event. In the tested failing script, the output begins:

```text
Stack state before step 2098:
├──  0: 10
├──  1: 0
```

The step number includes the transaction prologue and can change with the account or toolchain. Stack index 0 is the top. Place a printer before the first unexpected call or assertion; compare each instruction's inputs and outputs with your stack comments. Remember that note and transaction script entrypoints receive argument words, and that `call` changes the execution context while `exec` stays in the current one.

Remove temporary printer calls after diagnosis: they emit events and add execution work. For memory output, consult the [MASM debug output reference](../../tools/clients/rust-client/debug-output).

## Escalate to interactive debugging

Use the [DAP debugging guide](../../tools/clients/rust-client/debugging) when you need breakpoints, stepping, or memory inspection across a full transaction. It covers matching compiler/client versions, package debug information, and recording a replay session. Rebuild the package after editing source; a debugger restart alone does not compile it.

Before widening a failing fixture, make the repaired case pass and retain the original rejection as a regression test. [Testing with MockChain](./testing-mockchain) shows how to verify that rejected execution leaves committed account and note state unchanged.
