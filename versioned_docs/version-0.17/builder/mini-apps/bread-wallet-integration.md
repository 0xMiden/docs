---
sidebar_position: 4
title: "Connect to Bread"
sidebar_label: "Connect to Bread"
description: "Configure the wallet provider, connect an account and handle requests, recovery and native presentation."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Connect to Bread

Use the Miden wallet adapter to connect your frontend to Bread's injected provider. The adapter holds no private keys or chain database. Bread handles supported requests and asks the user to unlock, approve or decline.

For a working starting point, use the [wallet-managed mini-app entry](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md). It includes provider detection, explicit connection and a persisted send journal. The recipe below explains the integration boundaries.

## Install compatible packages

This React example uses adapter `0.17.0` with SDK/React SDK `0.17.3`:

```bash
npm install @miden-sdk/miden-wallet-adapter@0.17.0 \
  @miden-sdk/miden-sdk@0.17.3 @miden-sdk/react@0.17.3 \
  react@19.1.1 react-dom@19.1.1
```

Keep the installed peers compatible. The frontend starter has its own checked-in package pins; preserve those when using that checkout. A wallet can run another release, so verify serialized-request compatibility before using custom operations. See [Migration](../migration/index.md).

## Configure the provider

Construct the adapter once in a browser-only module. Creating it during server rendering reports `Unsupported`; recreating it on every render can disconnect the previous instance.

```tsx title="WalletRoot.tsx"
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

This example selects Testnet and requests no private-data categories. Set the policy on `WalletProvider`; its props are forwarded during connection. The pinned adapter exposes Testnet, Devnet and Localnet. Mainnet admission is a separate deployment policy, not an enum or permission to invent.

## Connect an account

<Steps>

<div>

### Wait for provider detection

`WalletReadyState.Installed` means the injected provider is detected. `NotDetected` needs connection/install guidance, and `Unsupported` means no browser DOM was available at construction. The reviewed Bread adapter does not report the generic `Loadable` state.

</div>
<div>

### Let the user select and connect

`WalletMultiButton` provides wallet selection and connection controls. If you build your own, select the wallet before requesting connection. Handle refusal without displaying a successful session.

</div>
<div>

### Keep account state reactive

Use `useWallet()` for `connected`, `address`, `connecting` and the selected `wallet`. After account change or disconnect, clear account-specific read caches and prepared work. Preserve accepted requests with their original sender/network for reconciliation.

</div>
</Steps>

## Request an operation and recover its result

For a public send, `requestSend` returns a **request ID**. `waitForTransaction` uses that ID to obtain the wallet result, whose **`txHash` is separate**. Track chain inclusion and recipient-note consumption when the app needs settlement.

<Callout variant="info" title="Persist before dispatch, reconcile before retry">
A timeout or lost response can occur after submission. Save the original account, network, request parameters and accepted ID. Restore that journal after reload and check the existing operation before another send. The maintained starter implements this recovery; the component below only keeps state while mounted.
</Callout>

<details>
<summary>React example: send and check an accepted request</summary>

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

Supply validated, matching-network account/faucet IDs. Amounts are positive safe-integer `number` values in token base units. The issuing faucet's decimals determine display conversion. A recipient must discover and consume the output note before its vault receives the asset.

The example conservatively blocks another send after any uncertain error. Production code needs persistent journaling and outcome-aware recovery, including errors where no request ID was returned. Never delete an unresolved operation merely to enable retry.

</details>

## Private reads and optional capabilities

| Capability | Application policy |
| --- | --- |
| `AllowedPrivateData.Assets` | Request asset-read access only when the task needs it. |
| `AllowedPrivateData.Notes` | Explain why note data is needed and how it is handled. |
| `AllowedPrivateData.Storage` | A declared category; check deployed method support before relying on storage reads. |
| `PrivateDataPermission.UponRequest` | The wallet asks as private reads occur. |
| `PrivateDataPermission.Auto` | Reuses granted categories without a prompt for every read; it does not grant all private data. |

`requestAssets`, `requestPrivateNotes` and `requestConsumableNotes` read from the wallet's local store under its policy. They do not synchronize an app-owned client. Returned balances or note bodies become data the page can observe; reading is separate from consent to publish.

Probe optional methods on the deployed provider. The reviewed Bread provider does not implement the declared `createAccount` method. Wallet connection also supplies no Quote API or mini-app registration endpoint.

## Custom execution and signing

Use a `Transaction` envelope when asking Bread to execute a compatible custom `TransactionRequest`:

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

The constructor serializes the request and the wallet deserializes it with its own SDK. Keep their encodings compatible and rebuild after an incompatible upgrade. Do not send a bare payload or reuse old serialized bytes.

For a wallet that supplies signatures to an app-managed client, follow [External signers](../tools/clients/react-sdk/signers.md). The app still needs the state and notes required by its workflow. Direct `signBytes` use must follow the supported `word` or `signingInputs` encoding; a signature does not reconstruct private account state.

## Optional native fullscreen

Bread 1.17.3 introduced fullscreen for supported native mobile WebViews. It changes presentation and keeps Back to Bread visible. Extension injection and ordinary browsers do not provide the native presentation API, so retain a usable responsive layout.

<Steps>

<div>

### Declare presentation in the initial HTML head

```html
<meta name="bread-display" content="fullscreen" />
<meta name="theme-color" content="#101010" />
```

Only the exact `fullscreen` value opts in. Adding metadata after the bundle loads is too late. Without it, Bread retains ordinary presentation.

</div>
<div>

### Signal readiness when the first frame is ready

Readiness is automatic at `DOMContentLoaded`. For manual readiness, also declare this in the initial head:

```html
<meta name="bread-ready" content="manual" />
```

After rendering a correctly sized first frame:

```js
if (window.bread?.version === 1) {
  await window.bread.presentation.ready();
}
```

Handle native refusal/transport timeout as a recoverable error. `ready()` resolves on native acknowledgement.

</div>
<div>

### Leave room for the return control

```css
.game-toolbar {
  padding-top: var(--bread-control-inset-top, 0px);
}
```

Respect physical safe areas, container size and device rotation. Do not assume an orientation-lock API. Test wallet overlays, background return and both orientations on the actual build.

</div>
</Steps>

<details>
<summary>Closing, parking and interrupted approvals</summary>

```js
if (window.bread?.version === 1) {
  await window.bread.presentation.close();
}
```

`close()` also returns a native-acknowledged promise. In released v1.17.3, Back to Bread closes the page and returns to the retained browser. Later source parks/restores the document. Verify the target build's lifecycle; older Android WebViews can keep the ordinary toolbar.

Closure can reject an unanswered approval and remove the saved page session. It does not cancel a submitted transaction. Wallet confirmations and locking suspend the page; reconcile accepted work on return.

[Released adoption guide](https://github.com/0xMiden/wallet/blob/v1.17.3/docs/dapp-fullscreen.md) · [Current source guide](https://github.com/0xMiden/wallet/blob/main/docs/dapp-fullscreen.md)

</details>

<CardGrid cols={2}>
  <MiniAppCard title="Test in Bread" page="testing-and-troubleshooting" eyebrow="Next · Real provider and device" icon={<MiniAppIcon name="test" />}>
    Check permissions, interruption, result handling and native presentation.
  </MiniAppCard>
  <MiniAppCard title="Register in Explore" page="publishing-and-explore" eyebrow="Next · Catalog review" icon={<MiniAppIcon name="publish" />}>
    Add a tested app without changing wallet approval boundaries.
  </MiniAppCard>
</CardGrid>

<details>
<summary>Implementation references</summary>

- [Canonical wallet adapter](https://github.com/0xMiden/web-sdk/tree/main/packages/adapter)
- [Adapter conformance checks](https://github.com/0xMiden/web-sdk/blob/main/packages/adapter/miden/conformance.ts)
- [Bread embedded provider](https://github.com/0xMiden/wallet/blob/main/src/lib/dapp-browser/injection-script.ts)

</details>
