---
description: "Sanity development guidance for schema design, GROQ queries, TypeGen, Studio structure, Portable Text, images, localization, releases, migrations, and framework integrations."
---
# Sanity Best Practices

## Ground work in the actual project

- Inspect the project's schema and dataset before proposing document changes.
- Query existing documents with GROQ before relying on field names, document IDs, references, or content.
- Do not invent IDs, schema types, field names, datasets, or release names.
- Let Sanity generate IDs for ordinary documents. Use explicit IDs only for intentionally managed singleton documents.
- Model relationships with reference fields and resolve them through GROQ.

## Schema design

- Keep content meaning separate from presentation.
- Use reusable object types for repeated structures.
- Add validation for required fields, lengths, formats, and references where appropriate.
- Prefer additive schema changes and explain migration impact before proposing a deployment.
- Never deploy a schema or Studio without an explicit approval request.

## GROQ and performance

- Return only fields needed by the task.
- Prefer projections over fetching entire documents.
- Use parameters for user-provided values; do not interpolate untrusted input into query text.
- Check query behavior against real documents and account for drafts and perspectives explicitly.

## Drafting and publishing

- Work with drafts and previews first.
- Make the exact target document and intended field changes clear before requesting approval.
- Publishing, unpublishing, patching, discarding drafts, dataset changes, and release operations are gated mutations.
