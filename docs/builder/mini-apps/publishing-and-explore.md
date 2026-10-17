---
sidebar_position: 9
title: "Register in Explore"
sidebar_label: "Register in Explore"
description: "Submit a reviewed wallet-config catalog change and verify the app's visibility and launch."
---

# Register in Explore

Register a tested, hosted mini-app through a reviewed PR in [wallet-config](https://github.com/0xMiden/wallet-config). The catalog supplies app identity, display text, launch URL and placement. Your app keeps responsibility for its behavior and support.

<Callout variant="info" title="Check the reader release before activation">
The direct-category contract is implemented in [wallet-config #10](https://github.com/0xMiden/wallet-config/pull/10) and the matching reader in [wallet #1512](https://github.com/0xMiden/wallet/pull/1512). As of 17 October 2026, both are unmerged. Publish config before shipping the reader. Older supported wallets continue using wallet-explore; adding files to wallet-config alone does not move those clients.
</Callout>

## Prepare the app record

Add or update one entry in the team's [Miniapps record](https://app.notion.com/p/3f199411cf9081a38769e248b0f1d347). Keep its title, production URL, source repository, description and owner current. Leave an unavailable production URL blank, and put the remaining facts in the entry body:

- Stable proposed app ID, publisher/support route and deployment commit.
- Network, account types, tested Bread builds/platforms and dependency/contract versions.
- Required wallet/private-data capabilities, backend origins and public disclosures.
- [Core journey and recovery evidence](./testing-and-troubleshooting.md), with app-specific game, financial-route or utility checks.
- Known limitations, operational owner and removal/recovery plan.

## Add the catalog entry

<Steps>

<div>

### Edit the network's Explore document

Use `explore/<network>.json`, with `network`, `version`, `items` and `sections`. Icons live under `explore/icons/`. Root network documents configure bridges/swaps/onboarding separately; an `apps` field there does not register a mini-app.

The initial migration provides devnet and testnet catalogs. Confirm supported publication before claiming Mainnet visibility.

</div>
<div>

### Choose the category and placement

Use exactly `finance`, `arcade` or `others`. All is aggregate-only. Financial helpers use Finance; games use Arcade; learning, NFTs and non-financial tools use Others. Update the relevant section's `itemIds` in display order.

</div>
<div>

### Add the reviewed URL, text and icon

Use the actual live HTTPS deployment, literal localized name/tagline and an optional repository-owned PNG. Keep demos and unavailable apps in candidate records until their reviewed destination exists. Do not activate dummy URLs.

</div>
<div>

### Increase the document version

A changed body requires a higher positive safe-integer version. A revert or removal also needs a new higher version. Preserve other apps and section references; do not reset the wallet's accepted version floor.

</div>
</Steps>

## Catalog fields

| Field | Requirement |
| --- | --- |
| `items[].id` | Unique lowercase letters, digits and hyphens; keep it stable for updates. |
| `name`, `tagline` | Objects of literal localized strings. `en` required; name at most 40 and tagline at most 120 Unicode characters per locale. |
| `url` | HTTPS, with no credentials, IP literal, localhost or punycode host. Query and fragment are retained exactly. |
| `category` | Exactly `finance`, `arcade` or `others`; never `all` or legacy names. |
| `icon` | Optional `icons/<name>.png`, lowercase letters/digits/hyphens; regular non-symlink square PNG at most 256×256 and 32 KiB. |
| `brandColor` | Optional `#RRGGBB`. |
| `isExchange` | Required boolean; existing platform/feature gates still apply. |
| `sections[]` | Unique `id`, `kind` of `featured` or `list`, localized `title`, and existing `itemIds` without duplicates. `recents` and `search-results` are reserved. |

The whole catalog must fit in 32 KiB. Follow the [implemented catalog guide](https://github.com/BrianSeong99/wallet-config/blob/ba067b30a1137cc6b191255d5f092f1749614f18/docs/explore-catalog.md) and the accepted repository validator at submission time.

<details>
<summary>Example: an existing Finance item</summary>

This existing Testnet faucet illustrates the item shape. It is an excerpt, not a complete catalog or another registration to add:

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

Preserve the containing document's other items and section references when editing.

</details>

## Validate and request review

From the wallet-config checkout, with `origin/main` fetched, run Node 22:

```bash
node --test scripts/validate-explore.test.mjs
BASE_REF=origin/main node scripts/validate-explore.mjs
# To check one catalog:
BASE_REF=origin/main node scripts/validate-explore.mjs explore/testnet.json
```

Open a PR against `main`. Link the app record and describe the app, live origin, source/deployment, network/platforms, completed tests and unresolved gates. Obtain the required maintainer and app-specific product/engineering/security/platform reviews.

The required `validate` CI job also retains root configuration checks. Catalog validation does not visit launch URLs, connect a wallet or verify app safety, game scoring or financial settlement. Attach that evidence separately.

## Verify publication

After the reviewed config merge and matching reader release:

1. Confirm published catalogs and bundled snapshots agree, and check the intended build/network.
2. Wait for catalog refresh, then verify category placement, search/recents and the exact launch URL.
3. Repeat provider detection, permission/refusal and recovery on each claimed build/platform, including physical devices where claimed.
4. Save the registration PR and acceptance evidence in the app record. Distinguish candidate, reviewed/pilot and observed listing status.

The matching reader checks catalogs hourly and on foreground return when older than 15 minutes, with bounded failure retries. Invalid, unavailable or lower-version data retains validated cached/bundled data. A merge alone does not prove the wallet loaded the change.

<details>
<summary>Migration, updates and removals</summary>

New fetched catalogs and bundled snapshots use direct categories. Only persisted legacy cached data is converted on upgrade. Keep wallet-explore available in its legacy schema for older supported wallets; recheck intervening metadata/version changes before migration and keep the new source ahead of previously accepted versions.

Maintain one immutable body per network/version within each source. Changed same-version bodies and lower versions are rejected. Remove an item and its section references together in a higher version. A 404 or deleted file does not clear the last accepted catalog; an intentionally empty catalog needs higher-version `items: []` and `sections: []`.

Use reviewed changes for material origin, network, permission, contract or monetization updates. Delisting does not cancel a submitted transaction or remove the app's recovery responsibilities.

</details>

<Callout variant="tip" title="A listing is discovery, not wallet authority">
Listing grants no keys, private-data access, transaction approval, trust badge, Mainnet admission or route liquidity. Native ranking/GC routes are wallet features; the catalog does not supply a leaderboard, challenge or reward API.
</Callout>
