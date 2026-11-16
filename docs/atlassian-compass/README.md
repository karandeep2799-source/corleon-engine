# Atlassian Compass — Corleon Engine

This repository contains the initial Compass component-as-code definition at
[`/compass.yaml`](../../compass.yaml).

## Architecture decision

The initial catalog entry represents the **Corleon Engine platform boundary**
as one Tier 1 Service. The repository is a monorepo, but this initial entry
intentionally models the deployable platform as one service rather than
inventing separately deployable services for internal Next.js route handlers.
Split additional components only when a boundary has independent ownership,
deployment, lifecycle, and operational responsibility.

The initial definition deliberately leaves `ownerId` null because a valid
Atlassian Team ARI has not yet been supplied. Do not guess an owner ID. After
creating the Corleon engineering team in Atlassian, copy its owner ID and add
it to `compass.yaml`.

## What is included

- Component name and stable slug: `Corleon Engine` / `corleon-engine`
- Component type: `SERVICE`
- Service tier: `1` (highest criticality)
- Lifecycle: `Active`
- Repository and documentation links
- Labels for catalog discovery
- Monorepo flag enabled so repository-wide CI/deployment/PR activity is not incorrectly attributed as a single component's metrics
- Empty dependency relationships until real Compass component IDs/slugs exist

No credentials, API tokens, customer data, deployment secrets, or production
endpoints are stored in the component definition.

## Enable Compass config-as-code

1. An Atlassian Compass product admin installs and configures the GitHub Cloud
   app for the GitHub organization that owns this repository.
2. Grant the app access to this repository. Prefer the narrowest repository
   scope available.
3. Open the Compass component catalog and check whether a component named
   **Corleon Engine** already exists. If it does, do not create a duplicate;
   use its Config as code panel to obtain the canonical component ID.
4. If the component does not exist, merge the reviewed `compass.yaml` into
   the repository's default branch. Compass discovers new config-as-code
   components from the default branch, not from an unmerged feature branch.
5. Verify that Compass created the component and linked the repository.
6. Copy the generated component ID from Compass and add it to `compass.yaml`
   in single quotes. Commit that ID update to the default branch.
7. Create or select the Corleon engineering team, copy its owner ID, and set
   `ownerId` to that exact ARI.
8. Confirm the component's owner, tier, lifecycle, links, and repository
   association in Compass.

## Monorepo metrics

The repository is a Turborepo monorepo, so `fields.isMonorepoProject` is set to `true`. Atlassian documents that this prevents automatic build, deployment, and pull-request metric processing for the component. If component-level metrics are needed, emit appropriately scoped events and metrics through the Compass APIs rather than attributing all repository activity to the platform component.

## Security and governance

- Keep GitHub and Atlassian access least-privileged.
- Never put tokens or secrets in `compass.yaml`, issues, or commit messages.
- Use an Atlassian team as the accountable owner; do not assign ownership to
  an unverified user or team.
- Review component changes through pull requests and CI.
- Do not merge the config to the default branch until the Atlassian GitHub
  app is installed and the target Compass catalog has been checked for
  duplicates.

## Product lifecycle note

Atlassian currently states that Compass catalog and scorecard functionality
is transitioning to DX. Its migration documentation says Compass support is
planned to end on **December 31, 2027**. Treat Compass as a near-term catalog
integration and keep this repository's component metadata portable. Before
investing in custom Compass-only automation, confirm the organization's DX
migration plan, pricing, and migration timing with Atlassian.

DX migration documentation:
https://support.atlassian.com/compass/docs/migrate-from-compass-to-dx/

## Current implementation status

| Item | Status |
|---|---|
| Repository inspected | Complete |
| Initial component-as-code definition | Added on feature branch |
| Atlassian GitHub app installation | Requires Atlassian admin |
| Compass catalog duplicate check | Requires access to the Atlassian site |
| Compass component creation | Pending default-branch merge and app connection |
| Component ID binding | Pending Compass-generated ID |
| Owner team binding | Pending valid Atlassian Team ARI |
| Production deployment | Not performed |

## Official references

- What are components: https://support.atlassian.com/compass/docs/what-are-components/
- Config as code: https://developer.atlassian.com/cloud/compass/config-as-code/manage-components-with-config-as-code/
- YAML structure: https://developer.atlassian.com/cloud/compass/config-as-code/structure-and-contents-of-a-compass-yml-file/
- GitHub integration: https://support.atlassian.com/compass/docs/integrate-compass-with-github/
