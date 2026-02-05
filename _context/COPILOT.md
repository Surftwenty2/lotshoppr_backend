# Copilot Guidance (LotShoppr)

Before suggesting changes, read:
- AI_README.md
- LOTSHOPPR_CONTEXT.md
- docs/architecture.md
- docs/data-model.md

Rules:
- No microservices.
- Keep routes/controllers thin.
- Business logic belongs in services.
- Avoid dealer-specific branching logic.
- Normalize quotes on ingestion.
- Preserve schema stability (treat drift as a bug).
