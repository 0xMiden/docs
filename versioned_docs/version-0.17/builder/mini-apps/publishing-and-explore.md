---
sidebar_position: 9
title: "Register and list in Explore"
description: "Register Arcade, Finance and other mini-apps through a validated wallet-config catalog PR, then verify activation."
---

# Register and list in Explore

New Bread mini-app registrations target reviewed changes in [wallet-config](https://github.com/0xMiden/wallet-config). Games, financial apps and financial utilities, learning, NFTs and other tools share this process. Register the candidate and its evidence, host the app on its intended HTTPS origin, obtain review, and verify that the intended wallet/network actually loads and launches it. Hosting, registration, pilot approval and an observed listing are separate outcomes. The wallet adapter establishes no registration API.

**Rollout status, 17 October 2026:** [wallet-config PR10](https://github.com/0xMiden/wallet-config/pull/10) implements the catalogs, icons, schema, validator and registration process; [wallet PR1512](https://github.com/0xMiden/wallet/pull/1512) implements the matching reader and native Arcade UI. Both are unmerged. These instructions describe that implemented contract, not a claim of released availability. Merge the config before shipping the reader, then verify its bundled snapshots against publication and complete platform acceptance. Bread 1.17.3's [reader](https://github.com/0xMiden/wallet/blob/v1.17.3/src/lib/explore-config/source.ts) continues to use [wallet-explore](https://github.com/0xMiden/wallet-explore).

## Register the candidate

1. Add or update the app's entry in the team's [Miniapps record](https://app.notion.com/p/3f199411cf9081a38769e248b0f1d347). Keep a stable proposed ID, name, useful description, publisher/owner, source, support route and intended production/review URLs. Clearly label demos and unavailable integrations.
2. Declare the network, account types, exact Bread builds/platforms, required wallet/private-data capabilities, public disclosures and backend dependencies. Record ordinary/fullscreen presentation and the app release used for testing.
3. Attach core-flow, refusal and recovery evidence. Games declare scoring and any reviewed challenge protocol. Financial apps declare the asset/issuer, fees, provider/route, settlement/receiving and recovery contract; a wallet connection or provider health check is not route acceptance.
4. Prepare a wallet-config registration PR against `main`: edit the appropriate `explore/<network>.json`, add any `explore/icons/` PNG, update section references and increase the catalog version. Include metadata, tests and unresolved gates; leave root bridge/swap/onboarding documents alone.
5. Obtain the required product and engineering/security reviews and any app-specific platform/privacy review. Record who approved which deployment, origin, capabilities and network. Review does not grant a user permission or guarantee public placement.
6. After merge and the relevant reader release, verify catalog refresh, visibility, launch URL and the same permission/recovery flow on the intended build/network. Save the registration PR and final evidence in the candidate record.

## Explore groups and catalog compatibility

[Wallet issue 1452](https://github.com/0xMiden/wallet/issues/1452) confirms **All, Finance, Arcade, Others**, in that order. All is the aggregate view. Finance contains financial apps and financial utilities; Arcade contains games and a custom native Explore view; Others contains remaining utilities, NFTs and learning. Individual games launch through Bread's existing dApp browser. The earlier standalone Arcade-site proposal is superseded.

New catalogs use exactly `finance`, `arcade` and `others`. The publication validator rejects `all`, legacy names and unsupported categories. All is aggregate-only. Only the matching wallet's persisted-cache parser converts old `tools`/`defi`, `games` and `nft`/`learn` values; new fetched catalogs and bundled snapshots use the direct categories. Financial helpers use Finance; other utilities use Others. Older supported wallets retain the legacy wallet-explore schema until they upgrade.

A catalog registers app discovery and launch metadata. Native Home → Arcade, Rankings, Game Coins and My activity are wallet routes, not extra catalog URL fields. The catalog does not supply live GC balance verification, leaderboard submission, challenge links or reward contracts. Follow the [Arcade](./arcade.md), [Finance](./finance.md) or [Others](./others.md) acceptance guide for the app's actual behavior.

## Prepare the hosted app

Use a production HTTPS URL on the intended domain. Confirm that the deployed app matches the reviewed source and package versions, starts without a local developer server and works on each Bread platform you claim. Test provider detection, explicit permission, supported transactions and interruption recovery before requesting a listing. For optional native fullscreen, include the [presentation checks](./bread-wallet-integration.md#optional-native-fullscreen); ordinary browser/extension presentation remains supported separately.

A catalog URL is an app launch target, not authority to select another user's account or read private state. Keep the network visible in the app and reject stale or mismatched request context. If the app uses a provider route, verify its actual activation and recovery behavior separately.

## Prepare registration metadata and the catalog entry

Use a separate `explore/<network>.json` document with `network`, positive safe-integer `version`, `items` and `sections`. Icons resolve relative to `explore/`. The root `<network>.json` files configure bridges, swaps and onboarding independently; adding an `apps` field there does not register anything. The initial migration supplies devnet and testnet catalogs, not a mainnet catalog. Confirm supported network publication before claiming Mainnet visibility.

Use the [implemented catalog guide](https://github.com/BrianSeong99/wallet-config/blob/ba067b30a1137cc6b191255d5f092f1749614f18/docs/explore-catalog.md) and [registration guide](https://github.com/BrianSeong99/wallet-config/blob/ba067b30a1137cc6b191255d5f092f1749614f18/docs/mini-app-registration.md) for exact repository rules. Recheck the accepted revision at submission time.

The wallet's Explore catalog contract includes:

| Metadata | Requirement |
| --- | --- |
| App ID | Unique lowercase letters, digits and hyphens. Keep it stable when updating the same app. |
| Name and tagline | Literal localized text; English is required. The reviewed reader limits names to 40 and taglines to 120 characters per locale. |
| Launch URL | `url`: HTTPS, with no username/password, IP address, localhost or punycode host. Query and fragment are preserved exactly. |
| Category/group | `category`: exactly `finance`, `arcade` or `others`. Never publish `all` or a legacy category name. |
| Icon | Optional `icon`: `icons/<name>.png`, with lowercase letters, digits and hyphens in the name. A regular, non-symlink square PNG, at most 256×256 and 32 KiB. Without one the wallet can draw an initial. |
| Brand color | Optional `brandColor`: `#RRGGBB`. |
| Exchange classification | Required boolean `isExchange`. Set accurately; platform feature gating can hide such entries. |
| Section placement | `sections[]` has a unique `id`, `kind` (`featured` or `list`), localized `title` and ordered `itemIds` referencing existing apps without duplicates. `recents` and `search-results` are reserved. |

The entire catalog must fit in 32 KiB. Localized text is literal strings keyed by supported locale, with `en` required. The [matching wallet parser](https://github.com/0xMiden/wallet/blob/b09b93074a72c75d82d039a7ae52a821ce7e63c7/src/lib/explore-config/schema.ts) and validator define the runtime/publication boundaries.

For example, this existing Testnet item in the config migration is a financial utility, not a new registration to add again:

```json
{
  "id": "faucet",
  "name": { "en": "Faucet" },
  "tagline": { "en": "Get testnet tokens" },
  "url": "https://faucet.testnet.miden.io/",
  "category": "finance",
  "icon": "icons/faucet.png",
  "brandColor": "#778C72",
  "isExchange": false
}
```

This is an item excerpt, not a complete catalog. Preserve other entries and section references when editing the full document. Keep unavailable apps in their candidate records; never publish empty, dummy or placeholder launch URLs.

## Submit a reviewable configuration PR

1. Confirm the accepted catalog contract and matching reader-release plan, then update the intended network's entry, localization, icon and section placement using the direct category.
2. Increase the document version according to the repository's rules. Restoring older values is still a new version; wallets retain a floor against older accepted documents.
3. Run the repository's current validation/test workflow from its README. Check the catalog, icon and document limits as well as any shared configuration checks. The Explore checks below need Node 22 and no additional package dependencies.
4. Describe the app, deployed URL, source repository, intended network/platforms and completed test evidence in the pull request. Keep secrets and private account state out of that evidence.
5. Obtain maintainer review. A PR, passing validation or a catalog merge alone does not prove that every wallet candidate has loaded the change.

```bash
# From the wallet-config checkout, with origin/main fetched:
node --test scripts/validate-explore.test.mjs
BASE_REF=origin/main node scripts/validate-explore.mjs
# Or validate one catalog:
BASE_REF=origin/main node scripts/validate-explore.mjs explore/testnet.json
```

The required `validate` CI job also checks root configuration. The Explore validator does not visit the app URL, connect a wallet or prove the application works. Attach the [integration evidence](./testing-and-troubleshooting.md) separately.

After publication and the matching reader release, catalogs are checked hourly and on foreground return when older than 15 minutes, with bounded failure retries. Verify the exact entry and launch URL on the intended wallet/network. Confirm that the app opens, the expected provider is detected and the original permission/transaction checks still apply. A wallet may initially show a bundled or previously accepted catalog; invalid, unavailable or lower-version responses retain validated cached/bundled data.

## Preserve upgrades and removals

Recheck wallet-explore for intervening metadata/version changes before the source migration. Keep new catalog versions ahead of previously accepted legacy versions, preserve one immutable body per network/version within each source, and verify bundled snapshots against the published config. Keep wallet-explore available for older supported readers and mirror reviewed changes using their legacy schema while needed; do not delete or redirect it as part of the migration.

An edit, revert or removal is a new higher version. A changed same-version body is rejected; resetting a version floor is not a rollback procedure. Remove an app and its section references together. Deleting the file or returning 404 does not clear the last accepted catalog. To intentionally clear a catalog, publish higher-version `items: []` and `sections: []`.

## What listing means

Listing makes the app discoverable in Explore. It does not grant a trust badge, permission, keys, Mainnet admission, provider liquidity or route support. The wallet continues to ask its normal connection and transaction questions.

For updates, redirects, removals or rollback, use another reviewed configuration change with the required higher version and verify the resulting catalog. Removing a listing does not cancel an already submitted transaction, delete an onchain account or change the recovery responsibilities of the app and provider.
