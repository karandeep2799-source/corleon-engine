---
description: "Structured content modeling guidance for schema design, reuse, references versus embedded objects, separation of concerns, omnichannel content, and taxonomy."
---
# Content Modeling Best Practices

1. **Model meaning, not pages.** Structure content around the concepts it represents rather than a single page layout.
2. **Keep a single source of truth.** Avoid duplicated fields and documents that drift independently.
3. **Design for reuse.** Use references for shared entities and embedded objects for values that belong only to one parent.
4. **Separate concerns.** Keep editorial content, presentation configuration, and operational metadata distinct.
5. **Make the editor workflow clear.** Field names, descriptions, validation, and Studio structure should help editors make correct choices.
6. **Plan for channels.** Prefer models that can support web, mobile, email, and other delivery surfaces without duplicating content.
7. **Use taxonomies deliberately.** Choose flat, hierarchical, or faceted classification based on the actual navigation and filtering requirements.

Before changing a schema, inspect current documents, identify compatibility risks, propose a migration path, and require approval before deploying.
