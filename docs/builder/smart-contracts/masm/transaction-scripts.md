---
title: MASM Transaction Scripts
description: Compile and execute a MASM transaction script with explicit arguments and expiry checks.
sidebar_position: 4
---

# MASM Transaction Scripts

A transaction script runs once, after the transaction's input notes have executed. Use it to coordinate account calls, create output notes, or set transaction parameters. Account components define the callable account procedures; note scripts define the conditions for consuming each note.

This example sets an expiry delta from a four-element argument word. It accepts 1–64 blocks, executes with a signed wallet, and checks the resulting expiration block. Rust is the host harness; the contract logic is MASM.

## Run the example

You need Git and Rust **1.98.1**. The example pins `miden-protocol`, `miden-standards`, `miden-testing`, and `miden-tx` to **0.17.1**, with VM **0.35.0** dependencies recorded in `Cargo.lock`.

```bash
git clone https://github.com/0xMiden/docs.git
cd docs/tests/masm/transaction-lab
cargo +1.98.1 test --locked --test transaction_scripts -- --nocapture
```

Both tests should pass. The rejection test prints intentional errors for `0` and `65`; those errors are the expected results.

## Write the script

```masm title="expiry.masm"
use miden::protocol::tx

@transaction_script
pub proc main
    # Inputs: [delta, reserved_1, reserved_2, reserved_3]
    u32assert
    dup neq.0 assert.err="expiry delta must be positive"
    dup u32lte.64 assert.err="expiry delta exceeds 64 blocks"
    exec.tx::update_expiration_block_delta
    drop drop drop
end
```

`@transaction_script` marks the single exported entrypoint. In v0.17, compile this as a library script with `CodeBuilder::compile_tx_script`; the `begin … end` entrypoint used by standalone VM programs is a different format.

The kernel places `TX_SCRIPT_ARGS` on the operand stack. Here `Word::from([10u32, 0, 0, 0])` gives `[10, 0, 0, 0]`, with the top of the stack on the left. The script consumes the delta and drops the three unused elements. `u32assert` validates the integer representation before the range checks.

`tx::update_expiration_block_delta` sets the last permitted inclusion block relative to the transaction's reference block. A delta of 10 with reference block 100 produces expiration block 110. Later calls can tighten the delta, but cannot increase it.

This is a caller-selected transaction policy. Put mandatory account-wide restrictions in the account component or its authentication policy: a caller can choose a different transaction script.

## Compile, supply arguments, and check execution

```rust title="tests/transaction_scripts.rs"
use miden_protocol::{Felt, Word, account::auth::AuthScheme};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};
use miden_tx::TransactionExecutorError;

#[tokio::test]
async fn expiry_script_accepts_valid_arguments() -> anyhow::Result<()> {
    let mut builder = MockChain::builder();
    let wallet = builder.add_existing_wallet(Auth::BasicAuth {
        auth_scheme: AuthScheme::Falcon512Poseidon2,
    })?;
    let chain = builder.build()?;
    let script = CodeBuilder::default().compile_tx_script(include_str!("../expiry.masm"))?;
    let reference = chain.latest_block_header().block_num().as_u32();

    let executed = chain
        .build_transaction(wallet.id())
        .tx_script(script)
        .tx_script_args(Word::from([10u32, 0, 0, 0]))
        .build()?
        .execute()
        .await?;

    assert_eq!(executed.expiration_block_num().as_u32(), reference + 10);
    assert_eq!(executed.final_account().nonce(), wallet.nonce() + Felt::ONE);
    assert!(executed.output_notes().is_empty());
    Ok(())
}

#[tokio::test]
async fn expiry_script_rejects_invalid_arguments() -> anyhow::Result<()> {
    for (delta, message) in [
        (0u32, "expiry delta must be positive"),
        (65u32, "expiry delta exceeds 64 blocks"),
    ] {
        let mut builder = MockChain::builder();
        let wallet = builder.add_existing_wallet(Auth::BasicAuth {
            auth_scheme: AuthScheme::Falcon512Poseidon2,
        })?;
        let chain = builder.build()?;
        let script = CodeBuilder::default().compile_tx_script(include_str!("../expiry.masm"))?;
        let error = chain
            .build_transaction(wallet.id())
            .tx_script(script)
            .tx_script_args(Word::from([delta, 0, 0, 0]))
            .build()?
            .execute()
            .await
            .expect_err("invalid expiry delta must fail");
        assert!(matches!(
            error,
            TransactionExecutorError::TransactionProgramExecutionFailed(_)
        ));
        let diagnostic = error.to_string();
        assert!(diagnostic.contains(message), "{diagnostic}");
        println!("{diagnostic}");
        assert_eq!(
            chain.committed_account(wallet.id())?.nonce(),
            wallet.nonce()
        );
    }
    Ok(())
}
```

`CodeBuilder::default()` links the protocol and standards libraries. `tx_script` attaches the compiled script; `tx_script_args` supplies its argument word. `MockChain` creates the wallet's Falcon key and provides its authenticator, so the successful transaction also exercises authentication and increments the nonce.

The successful test checks expiration, nonce, and the absence of output notes. It executes locally without submitting a transaction. The rejection test requires an execution error containing the intended message, so an unrelated setup error cannot satisfy it.

For larger inputs, place data in the advice map and pass its key in the argument word. Validate advice data in MASM before using it; an advice value alone does not enforce an application invariant.

## Next steps

- [Testing with MockChain](./testing-mockchain): distinguish executed effects from committed chain state.
- [Debugging MASM](./debugging): inspect source diagnostics and the operand stack.
- [Miden Standards](../standards/): reuse standard account procedures and note flows.
