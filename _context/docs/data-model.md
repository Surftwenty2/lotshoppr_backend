# Data Model — Source of Truth

Design schemas as if machine learning will depend on them — because it will.

Normalize early.  
Avoid schema drift.

This document describes the canonical entities the system should converge toward.

---

# Core Entities

## BuyerRequest

Represents structured consumer purchase intent.

**Core fields (directional):**
- vehicle configuration (year/make/model/trim + options)
- budget range
- financing preference (cash/finance/lease + target terms)
- trade-in (yes/no + basic details)
- buyer location + radius
- purchase timeline
- contact preferences (if needed)

**Notes:**
- keep intake normalized (no blobs of unstructured text unless also parsed)
- preserve original intake payload as raw input only if needed for audit/debug

---

## Dealer

Represents a dealership endpoint (a target for quote requests).

**Core fields (directional):**
- dealer identity (name)
- contact info (email(s), phone optional)
- supported brands / product lines
- geography (city/state/zip + service radius)
- routing tags (optional)

**Future fields:**
- response latency
- competitiveness score
- conversion / close outcomes
- deliverability metrics (bounce/complaints)

**Rule:**
Do not embed negotiation rules directly in the Dealer model.

---

## Quote

Represents a dealer offer in a comparable structure.

**Target normalized structure (directional):**
- vehicle price
- dealer fees (itemized where possible)
- incentives / rebates
- add-ons (itemized)
- financing terms (APR, months, down, payment)
- out-the-door total (OTD)

**Notes:**
- normalize on ingestion so quotes can be compared programmatically
- store raw dealer text/PDF/email separately from normalized fields
- track quote provenance (which dealer, which request, timestamp)

---

# Future Entity: NegotiationThread

Tracks negotiation history and strategy over time.

Potential fields:
- requestId
- dealerId
- initial offer snapshot
- counteroffer history
- strategy decisions
- final outcome (won/lost/abandoned)
- reasoning metadata (future AI)

---

# Data Quality Principles

Good schema quality creates:
- pricing intelligence
- dealer performance insights
- automation leverage
- ML readiness

Bad schema causes:
- comparison failures
- brittle logic
- expensive rewrites

**Treat schema drift as a bug.**
