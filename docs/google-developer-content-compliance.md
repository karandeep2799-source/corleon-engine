# Google Developer Content Compliance — Corleon Engine

**Status:** Engineering policy baseline  
**Last reviewed:** 2026-11-16

## Governing sources
- [Google Developers Site Policies](https://developers.google.com/terms/site-policies)
- [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Google brand permissions](https://www.google.com/permissions/)

## Required decision process
1. Identify the exact source page and exact material.
2. Inspect the footer/license notice on that page. Never infer a license from the Google domain.
3. Classify the material as documentation, code sample, brand feature, image, audio, video, third-party link or other.
4. Record URL, publisher, license evidence, reviewer and review date in the manifest.
5. For CC BY 4.0, provide attribution, link the license and source, indicate modifications, and preserve relevant notices.
6. For Apache 2.0 code samples, retain required copyright, license and NOTICE information when distributing covered code.
7. Route trademarks, brand features, media and third-party materials to separate review unless their own license explicitly covers the intended use.
8. Block release when license status is unknown or review is incomplete.

## Attribution language

For exact reproductions, Google requests:

> Portions of this page are reproduced from work created and shared by Google and used according to terms described in the Creative Commons 4.0 Attribution License.

For modified content, Google requests:

> Portions of this page are modifications based on work created and shared by Google and used according to terms described in the Creative Commons 4.0 Attribution License.

Link “shared by Google” to Google's policy page, the license name to the CC BY 4.0 deed, and the original source page.

## Exclusions and boundaries
- Google's trademarks and other brand features are not included in the documentation license.
- Images, audio, video and content linked from other webpages are not covered unless specifically noted.
- API terms, quotas, privacy/security rules and product-specific requirements remain independently applicable.
- This is not legal advice and does not certify rights automatically.

## Engineering integration
The @corleon/compliance-intelligence workspace package provides manifest validation, explicit notice detection, attribution formatting and a fail-closed release gate. It makes no external requests and does not deploy, publish or activate integrations.
