---
title: "Network handoff"
sidebar_label: "Network handoff"
description: "Prepare the chain, accounts, endpoints, funding, and evidence needed to move from local validation to testnet."
---

# Network handoff

Move to a hosted network after [local verification](verify.md). Use the [Network guide](../tools/network.md) for environment choices and endpoints, and [Deploy your first contract](../get-started/your-first-smart-contract/deploy.md) for the client flow.

## Prepare your configuration

| Field | Record |
| --- | --- |
| Source | Repository/submodule commits, lockfiles, version tuple, and rebuilt packages |
| Target | Local node, devnet, or testnet; chain/genesis identity and RPC endpoint |
| Services | Matching prover and, for private notes, transport endpoint and delivery checks |
| Accounts | Account IDs, authentication/signing design, and registration/admission requirements |
| State | Separate store/keystore locations and existing state to preserve |
| Funding | Test asset, faucet, recipient, note ID, and resulting committed balance |
| Success | Expected state, transaction/note IDs, publication/consumption commitments, and browser assertion |
| Failure | Bounded waits and status checks before retrying |

Check client/node/prover compatibility before submission. The local counter's fee-free genesis does not establish hosted admission or funding. Never reuse insecure local fixture keys on a hosted network.

## Run the testnet counter

Inspect `project-template/integration/src/bin/increment_count.rs` and its configuration first. When you are ready to create testnet accounts, local keys/store, and submit test transactions, run from the workspace root:

```bash
MIDEN_ALLOW_TESTNET=1 bash scripts/journey.sh testnet
```

The binary prints sender and counter IDs and waits for public funding notes. Follow the network's admission process if registration is required, then fund both accounts using the current faucet. Keep each returned note ID, synchronize, consume where required, and check committed balances/state.

The public counter example is unauthenticated. Use test assets; design and verify real authorization separately for your app. The template's hosted testnet/browser journey is not covered by its local-node acceptance.

## Hand off to the browser

Copy fresh packages with the `artifacts` stage and set `VITE_MIDEN_COUNTER_ADDRESS` in the frontend's `.env.local` to the compatible counter ID on the configured chain. Match RPC, prover, and any transport settings, then restart the frontend server.

Verify the initial count and the updated count after publication and consumption commit. A faucet response or loaded page is not a completed app flow. Check wallet signers, private delivery, and account upgrades independently when your app uses them.

Keep this configuration and the results as a handoff record. Mark deployment complete only after the target network's commitments and final assertions have been observed.
