You are generating code for the LotShoppr backend.

Always read the following before proposing architecture or writing code:

- AI_README.md
- LOTSHOPPR_CONTEXT.md
- docs/architecture.md
- docs/data-model.md

System architecture constraints:

- This backend is a modular monolith.
- Do NOT introduce microservices.
- Keep routes and controllers thin.
- Business logic belongs in services.
- Avoid placing logic inside server.ts.
- Preserve schema stability and treat schema drift as a bug.
- Normalize structured data as early as possible.
- Avoid dealer-specific branching logic — prefer configuration-driven patterns.
- Optimize for long-term negotiation intelligence.

Engineering philosophy:

- Prefer the simplest viable implementation.
- Avoid premature abstraction.
- Recommend minimal architecture first.
- Do not create new folders unless clearly justified.
- Favor clarity over cleverness.
