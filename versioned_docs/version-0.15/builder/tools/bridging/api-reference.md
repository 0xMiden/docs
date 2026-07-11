---
sidebar_position: 4
title: API reference
description: "Mock 1Click Bridge API endpoints used by the testnet bridge sandbox."
---

# API reference

The sandbox exposes a small `/v0/*` API shaped for 1Click-style bridge testing.
Use these endpoints from builder apps. Do not build app integrations against
local `/demo/*` helpers.

<Callout variant="info" title="Mock API">
This API is a testnet mock for app development. It is not a production bridge
API contract and does not define mainnet behavior.
</Callout>

## `GET /v0/tokens`

Returns supported assets for the active runtime profile.

```bash
curl -s http://localhost:8080/v0/tokens | jq .
```

For the Sepolia profile, assets use IDs such as:

```text
eth-sepolia:eth
miden-testnet:eth
```

## `POST /v0/quote`

Creates an inbound or outbound quote.

### Inbound quote

Sepolia native ETH to Miden testnet:

```bash
curl -s http://localhost:8080/v0/quote \
  -H 'content-type: application/json' \
  -d '{
    "dry": false,
    "depositMode": "SIMPLE",
    "swapType": "EXACT_INPUT",
    "slippageTolerance": 100.0,
    "originAsset": "eth-sepolia:eth",
    "depositType": "ORIGIN_CHAIN",
    "destinationAsset": "miden-testnet:eth",
    "amount": "1000000000000",
    "refundTo": "<sepolia-refund-address>",
    "refundType": "ORIGIN_CHAIN",
    "recipient": "<miden-recipient-address>",
    "recipientType": "DESTINATION_CHAIN",
    "deadline": "2027-01-01T00:00:00Z"
  }' | jq .
```

Important response fields:

| Field | Meaning |
| --- | --- |
| `correlationId` | Quote identifier used for evidence and flow lookup. |
| `quote.depositAddress` | Sepolia deposit address for this quote. |
| `quote.amountIn` | Required origin-chain amount. |
| `quote.amountOut` | Quoted destination amount. |

### Outbound quote

Miden testnet to Sepolia native ETH:

```bash
curl -s http://localhost:8080/v0/quote \
  -H 'content-type: application/json' \
  -d '{
    "dry": false,
    "depositMode": "SIMPLE",
    "swapType": "EXACT_INPUT",
    "slippageTolerance": 100.0,
    "originAsset": "miden-testnet:eth",
    "depositType": "ORIGIN_CHAIN",
    "destinationAsset": "eth-sepolia:eth",
    "amount": "1000000000000",
    "refundTo": "<miden-refund-address>",
    "refundType": "ORIGIN_CHAIN",
    "recipient": "<sepolia-recipient-address>",
    "recipientType": "DESTINATION_CHAIN",
    "deadline": "2027-01-01T00:00:00Z"
  }' | jq .
```

Important response fields:

| Field | Meaning |
| --- | --- |
| `correlationId` | Quote identifier used for evidence and flow lookup. |
| `quote.depositAddress` | Stable Miden bridge account for public-note deposits. |
| `quote.depositMemo` | `BridgeOutV1` instruction payload. |
| `quote.amountIn` | Required Miden asset amount. |
| `quote.amountOut` | Quoted Sepolia release amount. |

The user creates a public Miden note carrying the quoted asset and
`quote.depositMemo`, targeted to `quote.depositAddress`.

## `POST /v0/deposit/submit`

Submits a landed Sepolia transaction hash for an inbound quote.

```bash
curl -s http://localhost:8080/v0/deposit/submit \
  -H 'content-type: application/json' \
  -d '{
    "txHash": "0x...",
    "depositAddress": "<quote.depositAddress>"
  }' | jq .
```

Sepolia mode requires this explicit tx-hash submit step. The bridge verifies
that the transaction paid the quoted deposit address with the quoted amount
before it starts Miden settlement.

## `GET /v0/status`

Polls quote lifecycle status.

For inbound quotes, query by Sepolia deposit address:

```bash
curl -s "http://localhost:8080/v0/status?depositAddress=<sepolia-deposit-address>" | jq .
```

For outbound quotes, query by the Miden bridge account and memo or quote hash:

```bash
curl -G http://localhost:8080/v0/status \
  --data-urlencode "depositAddress=<miden-bridge-account-address>" \
  --data-urlencode "depositMemo=<bridge-out-v1-memo>" | jq .
```

Status responses include the current lifecycle status and, after settlement,
evidence fields such as Miden mint or consume transaction IDs and Sepolia
release transaction hashes.

## Lifecycle statuses

| Status | Meaning |
| --- | --- |
| `PENDING_DEPOSIT` | Quote exists and is waiting for a deposit. |
| `KNOWN_DEPOSIT_TX` | A deposit transaction hash was submitted and is being verified. |
| `PROCESSING` | The origin deposit is verified and destination settlement is running. |
| `SUCCESS` | Bridge-side settlement completed. |
| `REFUNDED` | Funds were returned instead of settled. |
| `FAILED` | The quote could not settle or refund. |

## Endpoint boundaries

| Endpoint family | Intended use |
| --- | --- |
| `/v0/*` | Public integration surface for builder apps. |
| `/demo/*` | Local sandbox helpers for manual demos and Anvil flows. |
| `/lab` | Local clickable UI for sandbox testing. |

Third-party apps should depend on `/v0/*` only.
