---
description: "Sanity development guidance for schema design, GROQ queries, TypeGen, Studio structure, Portable Text, images, localization, releases, migrations, and framework integrations."
---
# Sanity Best Practices

- Inspect the project's schema and dataset before proposing document changes.
- Query existing documents with GROQ before relying on field names, document IDs, references, or content.
- Never invent IDs, schema types, field names, datasets, or release names.
- Let Sanity generate IDs for ordinary documents. Use explicit IDs only for intentionally managed singleton documents.
- Keep content meaning separate from presentation and use reusable object types for repeated structures.
- Add validation for required fields, lengths, formats, and references where appropriate.
- Prefer additive schema changes and explain migration impact before proposing a deployment.
- Return only fields needed by a GROQ query; use parameters for user-provided values and do not interpolate untrusted input.
- Work with drafts and previews first. Make the exact target and intended field changes clear before requesting approval.
- Publishing, unpublishing, patching, discarding drafts, dataset changes, and release operations are gated mutations.
