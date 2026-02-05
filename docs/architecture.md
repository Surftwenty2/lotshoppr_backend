# Architecture Overview

## System Intent

LotShoppr is designed to become the intelligence layer between vehicle buyers and dealerships.

This repository is the **decision engine** and must support:

- automation
- data leverage
- future ML insertion points
- scalability without fragility

Avoid architectures that require a rewrite to add negotiation intelligence later.

---

# High-Level Layering

## Presentation Layer (not owned here)
- landing pages
- consumer workflows
- future dashboards

## Application Layer (owned here)
- intake processing
- dealer routing
- quote normalization
- negotiation engine (future)

## Infrastructure Layer
- email delivery
- hosting/runtime
- logging (later)
- observability (later)

## Data Layer
- buyer requests
- dealer metadata
- quotes
- negotiation history (future)

---

# Architectural Philosophy

### Build for Replaceability
Infrastructure components should be swappable without rewriting business logic.

### Avoid Premature Distribution
Stay modular inside one codebase. Do NOT introduce microservices during MVP.

### Protect the Decision Engine
Backend logic must remain stable. Do not allow UI or integration experimentation to destabilize core routing and normalization.

---

# Canonical Flow

Buyer intake
→ validation
→ normalization
→ dealer selection
→ email dispatch
→ quote ingestion
→ quote normalization
→ structured storage
→ consumer output

Future:
→ deal scoring
→ counteroffer generation
→ negotiation thread tracking

---

# Internal Boundaries (Critical)

## Routes
Thin. Declare endpoints only.

## Controllers
HTTP only. No business rules.

## Services
Own business logic. This is where routing, normalization, and negotiation logic belongs.

## Integrations
Email provider, external APIs, future dealer APIs.

## Models / Types
Schema definitions (structures), not behavior.

---

# Scaling Path

## MVP Stage (Now)
- serverless execution (Vercel)
- lightweight automation
- minimal infra

## Growth Stage
- database + durable storage
- queue-based dispatch (if email volume rises)
- observability and error monitoring

## Scale Stage
- negotiation models
- dealer APIs + inventory feeds
- predictive pricing and scoring

---

# Common Failure Modes to Avoid

- over-engineering before product-market fit
- schema instability / drift
- tight coupling between layers
- dealer-specific branching logic baked into services
- splitting services too early

---

# Architecture North Star

Every decision should increase:

- automation capability
- intelligence insertion points
- data quality and leverage
- scalability
- replaceability
