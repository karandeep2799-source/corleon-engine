# @corleon/compliance-intelligence

A deterministic compliance layer for tracking third-party documentation, code samples, brand features, media and linked resources used by Corleon Engine.

## Capabilities
- Maintain an auditable source/license manifest.
- Validate HTTPS source URLs, license evidence, material classifications and duplicate IDs.
- Detect explicit Google page-footer notices for CC BY 4.0 documentation and Apache 2.0 code samples.
- Generate Google's requested attribution language for exact reproductions and modified content.
- Fail closed for unknown, unreviewed or separately-reviewed materials.

This is a workflow aid, not legal advice or an automated legal determination. Verify the exact page, exceptions and material. A detected notice is evidence only. The package does not crawl pages or make network requests.

## Encoded policy
- Google documentation is CC BY 4.0 only where the applicable notice appears and no exception applies.
- Code samples are Apache 2.0 only where the page notice explicitly says so.
- Google trademarks and brand features are excluded from the documentation license.
- Images, audio, video and linked third-party materials are not covered unless specifically stated.
- Unknown or unreviewed material blocks release checks.

## Build and test
Run from the repository root:
- pnpm --filter @corleon/compliance-intelligence build
- pnpm --filter @corleon/compliance-intelligence test

## Operational requirements
1. Review the actual page footer and record exact evidence.
2. Create separate records for documentation, code, logos, images and third-party media.
3. Preserve upstream notices and Apache 2.0 notices when distributing covered code.
4. Include source links and attribution in the relevant product surface or documentation.
5. Re-review when source content or terms change.
6. Never treat this package output as permission to use a trademark, API, service or third-party asset.
