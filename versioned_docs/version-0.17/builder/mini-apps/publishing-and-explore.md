---
sidebar_position: 6
title: "Register and list in Explore"
description: "Register a game or financial mini-app through wallet-config review, then verify catalog migration and visibility."
---

# Register and list in Explore

New Bread mini-app registrations target reviewed changes in [wallet-config](https://github.com/0xMiden/wallet-config). Games, financial apps and financial utilities, learning, NFTs and other tools share this process. Register the candidate and its evidence, host the app on its intended HTTPS origin, obtain review, and verify that the intended wallet/network actually loads and launches it. Hosting, registration, pilot approval and an observed listing are separate outcomes. The wallet adapter establishes no registration API.

**Current implementation gate:** released Bread 1.17.3 reads Explore catalogs from [wallet-explore](https://github.com/0xMiden/wallet-explore), as its [reader source](https://github.com/0xMiden/wallet/blob/v1.17.3/src/lib/explore-config/source.ts) and [release notes](https://github.com/0xMiden/wallet/releases/tag/v1.17.3) show. The reviewed wallet-config README describes bridge/swap/onboarding settings, not an accepted mini-app catalog layout. Confirm the catalog schema, validator, migration and released reader before adding activation data. Preserve the registration request and mark activation blocked while that work is missing; do not invent a property in the current bridge/swap document or claim an ignored field registers the app.

## Register the candidate

1. Add or update the app's entry in the team's [Miniapps record](https://app.notion.com/p/3f199411cf9081a38769e248b0f1d347). Keep a stable proposed ID, name, useful description, publisher/owner, source, support route and intended production/review URLs. Clearly label demos and unavailable integrations.
2. Declare the network, account types, exact Bread builds/platforms, required wallet/private-data capabilities, public disclosures and backend dependencies. Record ordinary/fullscreen presentation and the app release used for testing.
3. Attach core-flow, refusal and recovery evidence. Games declare scoring and any reviewed challenge protocol. Financial apps declare the asset/issuer, fees, provider/route, settlement/receiving and recovery contract; a wallet connection or provider health check is not route acceptance.
4. Prepare a wallet-config registration PR using the accepted catalog layout once its schema/migration is available. Include metadata, tests and unresolved gates in the PR; preserve unrelated dynamic configuration. If that layout is unavailable, keep the candidate and evidence ready for maintainers to review without inserting guessed runtime data.
5. Obtain the required product and engineering/security reviews and any app-specific platform/privacy review. Record who approved which deployment, origin, capabilities and network. Review does not grant a user permission or guarantee public placement.
6. After merge and the relevant reader release, verify catalog refresh, visibility, launch URL and the same permission/recovery flow on the intended build/network. Save the registration PR and final evidence in the candidate record.

## Explore groups and catalog compatibility

[Wallet issue 1452](https://github.com/0xMiden/wallet/issues/1452) confirms **All, Finance, Arcade, Others**, in that order. All is the aggregate view. Finance contains financial apps and financial utilities; Arcade contains games and a custom native Explore view; Others contains remaining utilities, NFTs and learning. Individual games launch through Bread's existing dApp browser. The earlier standalone Arcade-site proposal is superseded.

These are target visible groups, not newly accepted serialized values. The current catalog uses `tools`, `defi`, `games`, `nft` and `learn`. The native category work needs a tested mapping or coordinated migration that preserves existing entries, network selection, search, recents and platform gates. Review each financial utility's Finance/Others assignment; do not infer it from its name or change a JSON category before its parser supports it. A native Arcade view or a local submission draft is not a backend game-registration, ranking or reward contract.

## Prepare the hosted app

Use a production HTTPS URL on the intended domain. Confirm that the deployed app matches the reviewed source and package versions, starts without a local developer server and works on each Bread platform you claim. Test provider detection, explicit permission, supported transactions and interruption recovery before requesting a listing. For optional native fullscreen, include the [presentation checks](./bread-wallet-integration.md#optional-native-fullscreen); ordinary browser/extension presentation remains supported separately.

A catalog URL is an app launch target, not authority to select another user's account or read private state. Keep the network visible in the app and reject stale or mismatched request context. If the app uses a provider route, verify its actual activation and recovery behavior separately.

## Prepare registration metadata and the catalog entry

Capture the metadata below in the registration request. Before encoding it, verify wallet-config's accepted catalog layout, schema and contributor instructions. The table records the current Explore catalog contract; it does not declare a new wallet-config path or schema. Preserve unrelated bridge, market and feature configuration. Do not invent another endpoint, listing API or JSON property to get around repository validation.

The wallet's Explore catalog contract includes:

| Metadata | Requirement |
| --- | --- |
| App ID | Unique lowercase letters, digits and hyphens. Keep it stable when updating the same app. |
| Name and tagline | Literal localized text; English is required. The reviewed reader limits names to 40 and taglines to 120 characters per locale. |
| Launch URL | HTTPS, with no username/password, IP address, localhost or punycode host. |
| Category/group | Current serialized categories are `tools`, `defi`, `games`, `nft` and `learn`; also record the requested Finance, Arcade or Others view for the reviewed mapping/migration. |
| Icon | Optional repository-owned PNG. Follow its allowed path, square dimensions and byte-size validation. Without one the wallet can draw an initial. |
| Exchange classification | Set accurately for an exchange/swap app; platform feature gating can hide such entries. |
| Section placement | Use the section's app IDs in display order, without duplicate IDs. Recents and search results belong to the wallet. |

The [wallet parser](https://github.com/0xMiden/wallet/blob/main/src/lib/explore-config/schema.ts) describes the reviewed catalog limits. Use wallet-config's current contributor instructions for the accepted file layout and validation rather than copying a standalone document into an unrelated field.

## Submit a reviewable configuration PR

1. Confirm the catalog schema/migration and released-reader gate, then select the intended network and update its accepted catalog entry, localization, icon and section placement. Include the category mapping needed for issue 1452.
2. Increase the document version according to the repository's rules. Restoring older values is still a new version; wallets retain a floor against older accepted documents.
3. Run the repository's current validation/test workflow from its README. Check the catalog, icon and document limits as well as any shared configuration checks.
4. Describe the app, deployed URL, source repository, intended network/platforms and completed test evidence in the pull request. Keep secrets and private account state out of that evidence.
5. Obtain maintainer review. A PR, passing validation or a catalog merge alone does not prove that every wallet candidate has loaded the change.

After publication, allow configuration refresh and CDN caching, then verify the exact entry and launch URL on the intended wallet/network. Confirm that the app opens, the expected provider is detected and the original permission/transaction checks still apply. A wallet may initially show a bundled or previously accepted catalog.

## What listing means

Listing makes the app discoverable in Explore. It does not grant a trust badge, permission, keys, Mainnet admission, provider liquidity or route support. The wallet continues to ask its normal connection and transaction questions.

For updates, redirects, removals or rollback, use another reviewed configuration change with the required higher version and verify the resulting catalog. Removing a listing does not cancel an already submitted transaction, delete an onchain account or change the recovery responsibilities of the app and provider.
