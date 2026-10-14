---
title: "Connect a mini-app to Bread"
description: "Connect a web app to Bread, request wallet-managed transactions, and handle permissions, account changes, and completion."
sidebar_position: 4
---

# Connect a mini-app to Bread

Bread exposes a wallet provider to supported web pages. The Miden wallet adapter connects your app to that provider and gives you typed connection, transaction, and private-data requests. Your app can use the same adapter inside Bread's embedded app browser when the provider is injected there.

The adapter holds no private keys, client database, or chain state. Requests go to the wallet, which can ask the user to unlock, approve, or decline. A mini-app remains a web application; provider injection does not establish a separate mini-app SDK or an app-listing API.

## Install compatible packages

For a React app, use the aggregate adapter package and its peers:

```bash
npm install @miden-sdk/miden-wallet-adapter@0.17.0 \
  @miden-sdk/miden-sdk@0.17.3 @miden-sdk/react@0.17.3 \
  react@19.1.1 react-dom@19.1.1
```

The adapter line is 0.17.0; the reviewed current Bread source pins Web SDK and React SDK 0.17.3. These are the package versions used for this example check. A deployed wallet may run a different release; verify compatibility before exchanging serialized custom requests. See [Migration](../migration/index.md).

For non-React integrations, the base and Miden packages provide types and `MidenWalletAdapter`. The React package also imports the React SDK at module initialization, so install that peer even when your app only uses `useWallet`.

## Configure the provider

Create adapters once in a browser-only module. An adapter constructed without a DOM enters `Unsupported`; constructing a new adapter on every render can disconnect the previous instance.

```tsx title="WalletRoot.tsx — client-only module"
import type { ReactNode } from "react";
import {
  AllowedPrivateData,
  MidenWalletAdapter,
  PrivateDataPermission,
  WalletAdapterNetwork,
  WalletModalProvider,
  WalletMultiButton,
  WalletProvider,
} from "@miden-sdk/miden-wallet-adapter";
import "@miden-sdk/miden-wallet-adapter/styles.css";

const wallets = [new MidenWalletAdapter({ appName: "My Miden App" })];

export function WalletRoot({ children }: { children: ReactNode }) {
  return (
    <WalletProvider
      wallets={wallets}
      network={WalletAdapterNetwork.Testnet}
      privateDataPermission={PrivateDataPermission.UponRequest}
      allowedPrivateData={AllowedPrivateData.None}
    >
      <WalletModalProvider>
        <WalletMultiButton />
        {children}
      </WalletModalProvider>
    </WalletProvider>
  );
}
```

This is a Testnet integration example. The pinned adapter exposes Testnet, Devnet and Localnet; do not invent a Mainnet enum or assume a Testnet connection grants Mainnet admission. The consumer admission policy and the temporary developer Testnet path are defined in [wallet issue 876](https://github.com/0xMiden/wallet/issues/876); a Pioneer listing still requires separate platform, route and owner readiness checks.

Set the network and private-data policy on `WalletProvider`. The React provider forwards its own props during connection; setting different values only on a button or modal does not change that policy. This example requests no private-data categories. Enable only categories your app actually needs.

| Setting | Meaning |
| --- | --- |
| `AllowedPrivateData.Assets` | Request permission to read assets through the wallet. |
| `AllowedPrivateData.Notes` | Request permission to read notes through the wallet. |
| `AllowedPrivateData.Storage` | A declared category; check the deployed provider's method support before relying on a storage-read API. |
| `PrivateDataPermission.UponRequest` | The wallet asks for private-data access as requests occur. |
| `PrivateDataPermission.Auto` | Allows access within granted categories without a confirmation for every read. It is not unlimited access to all wallet data. |

Connection does not grant access to private keys. Private-note bodies and balances returned to the page become data your application can observe; request only what you need.

## Detection and connection

The adapter detects the injected provider and reports readiness:

| `WalletReadyState` | Application behavior |
| --- | --- |
| `Unsupported` | No browser DOM was available when this adapter was constructed. Initialize in the client. |
| `NotDetected` | No injected provider detected yet. Show connection or installation guidance. |
| `Installed` | Provider detected. A user connection request can proceed. |
| `Loadable` | Supported by the generic adapter abstraction; the reviewed Bread adapter does not report this state. |

`WalletMultiButton` supplies wallet selection and connection UI. If you build your own controls, selection must happen before connection. Connection or unlocking may prompt; handle refusal without treating it as a successful session.

Use `useWallet()` to read `connected`, `address`, `connecting`, and the selected `wallet`. Treat that state as reactive. Clear account-specific balances, prepared transactions, and private-data caches when the connected address changes or the wallet disconnects. A reconnection can refresh a session after a page has been parked; do not treat a previously connected address as permanent authorization.

## Ask the wallet to send and observe the result

```tsx title="SendWithWallet.tsx"
import { useState } from "react";
import { SendTransaction, useWallet } from "@miden-sdk/miden-wallet-adapter";

export function SendWithWallet({
  recipient,
  faucetId,
  amountBaseUnits,
}: {
  recipient: string;
  faucetId: string;
  amountBaseUnits: number;
}) {
  const { connected, address, requestSend, waitForTransaction } = useWallet();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [acceptedRequestId, setAcceptedRequestId] = useState<string | null>(null);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);

  async function send() {
    if (!connected || !address || !requestSend || !waitForTransaction || pending || acceptedRequestId || submissionUncertain) return;
    if (!Number.isSafeInteger(amountBaseUnits) || amountBaseUnits <= 0) {
      setStatus("Enter a positive, safe integer amount in token base units.");
      return;
    }

    setPending(true);
    try {
      const transactionId = await requestSend(
        new SendTransaction(address, recipient, faucetId, "public", amountBaseUnits),
      );
      setAcceptedRequestId(transactionId);
      setStatus(`Wallet accepted request: ${transactionId}`);
      const result = await waitForTransaction(transactionId);
      setStatus(`Wallet reported transaction result: ${result.txHash}`);
    } catch (error) {
      setSubmissionUncertain(true);
      setStatus(error instanceof Error ? error.message : "Wallet request failed; reconcile before retrying.");
    } finally {
      setPending(false);
    }
  }

  async function reconcile() {
    if (!connected || !waitForTransaction || !acceptedRequestId || pending) return;
    setPending(true);
    try {
      const result = await waitForTransaction(acceptedRequestId);
      setStatus(`Wallet reported transaction result: ${result.txHash}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Result remains unresolved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button disabled={!connected || pending || !!acceptedRequestId || submissionUncertain} onClick={send}>
        {pending ? "Waiting for wallet" : "Send"}
      </button>
      <button disabled={!connected || pending || !acceptedRequestId} onClick={reconcile}>
        Check accepted request
      </button>
      <p role="status">{status}</p>
    </>
  );
}
```

Supply validated, matching-network account and faucet IDs. Adapter `amount` fields are `number` values in token base units; do not pass a decimal display amount, an unsafe integer, or the SDK's `bigint` value without an exact range check. The issuing faucet's decimals determine display conversion.

The returned request ID identifies wallet-accepted work. `waitForTransaction` obtains the wallet's transaction output or failure; its `txHash` is a separate result field. Confirm chain inclusion and resulting note state when your application needs settlement, rather than treating request acceptance as finality. A send creates an output note; the recipient must discover and consume it before the resulting funds are in its vault.

A timeout or lost connection does not prove that an operation was never submitted. The example blocks another send after an accepted or uncertain request and lets you check the same accepted ID. Its state is only kept while this component remains mounted: before production use, persist the request ID with its sender, network and request parameters, and restore that journal on reload. If no ID was returned, inspect wallet activity through the supported flow before authorizing another request; do not automatically retry. Clear or replace a journal entry only after reconciling its outcome. Bread's spending policy, fee balance, or Guardian requirements can also reject or delay execution.

## Choose who executes

| Integration | Use it when |
| --- | --- |
| `requestSend` / `requestConsume` | The wallet should build, sign, and submit a standard operation. |
| `requestTransaction` with a custom envelope | Your application builds a `TransactionRequest` and asks the wallet to execute it. |
| `MidenFiSignerProvider` with `MidenProvider` | Your application owns the SDK client workflow while the connected wallet supplies signing. |

For custom operations, `requestTransaction` expects a `Transaction` envelope rather than a bare `CustomTransaction` payload:

```typescript
import { Transaction } from "@miden-sdk/miden-wallet-adapter";
import type { TransactionRequest } from "@miden-sdk/miden-sdk";

export function customEnvelope(
  address: string,
  recipientAddress: string,
  request: TransactionRequest,
) {
  return Transaction.createCustomTransaction(address, recipientAddress, request);
}
```

The constructor serializes the request; the wallet deserializes it with its own SDK. Use compatible released encodings on both sides. Do not reuse stored request bytes across an incompatible upgrade.

For the wallet-as-signer provider setup, see [External signers](../tools/clients/react-sdk/signers.md). Signing an account ID does not reconstruct that account's private state. Your application's client still needs the state and notes required by its chosen workflow.

## Private reads and capability checks

`requestAssets`, `requestPrivateNotes`, and `requestConsumableNotes` read from the wallet's local store within its permission policy. They do not replace synchronization of an application-owned client. Permission refusal and disconnected-state errors remain normal outcomes.

Use the methods exposed by the deployed provider, and probe optional capabilities before calling them. A TypeScript interface alone is not implementation evidence: the reviewed Bread provider does not implement the declared `createAccount` method. Do not build onboarding around that method or assume an undocumented Quote API exists.

When constructing signatures directly, honor the supported `signBytes` kinds (`word` or `signingInputs`) and their exact encodings. Avoid opaque signatures when a wallet-managed transaction request can express the operation and display its effects.

## Embedded browser checks

Open the same web application inside Bread's app browser and wait for adapter readiness before requesting connection. An ordinary mobile browser without injection is a separate environment; opening a URL there does not make it connected to Bread.

Verify the following on every platform you claim to support:

- Provider detection with and without injection, and the connection-refusal path.
- Correct network and granted private-data categories.
- Request approval, request rejection, result retrieval, and reconciliation after interruption.
- Account changes, locking, disconnection, and returning to a parked app.
- A recipient note becoming consumable separately from the sender's request result.

Use the public adapter conformance suite against a real provider when checking a wallet's supported surface. Mock-provider tests can validate application state handling but do not prove extension, mobile, or desktop provider compatibility.

## Optional native fullscreen

Bread 1.17.3 introduced opt-in fullscreen for the native mobile dApp browser. Put the policy in the entry HTML's initial head, rather than adding it after your application bundle loads:

```html
<meta name="bread-display" content="fullscreen" />
<meta name="theme-color" content="#101010" />
```

Only the exact `fullscreen` value opts in; without it Bread retains ordinary browser presentation. Readiness is automatic at `DOMContentLoaded` unless the initial head also declares:

```html
<meta name="bread-ready" content="manual" />
```

With manual readiness, wait for the first correctly sized frame before notifying the host:

```js
if (window.bread?.version === 1) {
  await window.bread.presentation.ready();
}
```

Handle a native refusal or transport timeout without claiming the page is ready. `ready()` and `close()` return promises resolved by native acknowledgement. The API is available only in the main document of a supported native Bread WebView; extension wallet injection or an ordinary browser does not supply it. Keep a usable responsive layout when it is absent. Older Android WebViews can retain the ordinary toolbar.

Fullscreen follows the device's portrait/landscape rotation; this recipe does not establish an orientation-lock API. Size the renderer from its actual container and reserve room for the persistent, accessible Back to Bread control:

```css
.game-toolbar {
  padding-top: var(--bread-control-inset-top, 0px);
}
```

Respect physical safe areas and use the host's live inset rather than hard-coded toolbar padding. On the released v1.17.3 implementation, Back to Bread closes the page and returns to the retained browser. Later source changes that control to parking/restoring the document; test the exact target build rather than assuming either lifecycle. Programmatic closure uses the same versioned API:

```js
if (window.bread?.version === 1) {
  await window.bread.presentation.close();
}
```

Closure can reject an unanswered wallet approval and remove the page's saved session. It does not cancel an already submitted transaction: retain request context and reconcile its outcome before another submission. Wallet confirmations, alerts and locking suspend the page; test resumption, readiness failure, rotation, background/reopen and safe return on physical iOS/Android devices.

Fullscreen is optional for both games and financial apps. Presentation does not grant wallet connection, private-data access, transaction approval or registration. See the [released fullscreen adoption guide](https://github.com/0xMiden/wallet/blob/v1.17.3/docs/dapp-fullscreen.md), [current source guide](https://github.com/0xMiden/wallet/blob/main/docs/dapp-fullscreen.md) and [v1.17.3 release](https://github.com/0xMiden/wallet/releases/tag/v1.17.3) for the implementation boundary.

## Public implementation references

- [Canonical wallet adapter implementation](https://github.com/0xMiden/web-sdk/tree/main/packages/adapter).
- [Adapter conformance checks](https://github.com/0xMiden/web-sdk/blob/main/packages/adapter/miden/conformance.ts).
- [Bread embedded-provider implementation](https://github.com/0xMiden/wallet/blob/main/src/lib/dapp-browser/injection-script.ts).
