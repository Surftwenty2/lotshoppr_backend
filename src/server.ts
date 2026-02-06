import "dotenv/config";

// Debug: Check if OpenAI API key is present at startup (do not log the full key)
if (process.env.OPENAI_API_KEY) {
  console.log('[DEBUG] OPENAI_API_KEY is set (length:', process.env.OPENAI_API_KEY.length, ')');
} else {
  console.warn('[WARN] OPENAI_API_KEY is NOT set!');
}
import express from "express";
import bodyParser from "body-parser";
import { parseDealerEmail, evaluateOffer, buildFollowupEmail } from "./logic";
import {
  createLead,
  getLead,
  updateLead,
  appendConversation,
  getAllLeads,
} from "./storage";

// ============================================
// Express setup
// ============================================

const app = express();
app.use(bodyParser.json());

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "LotShoppr backend is running" });
});

// List all leads (debug)
app.get("/api/leads", (req, res) => {
  return res.json({ leads: getAllLeads() });
});

/**
 * Create a lead from intake data
 * Called by webhook after Tally submission
 */
app.post("/api/leads", (req, res) => {
  try {
    const { firstName, lastName, email, zip, vehicle, constraints } = req.body;

    if (!firstName || !email || !vehicle?.make || !vehicle?.model) {
      return res.status(400).json({
        ok: false,
        error: "missing_required_fields",
        required: ["firstName", "email", "vehicle.make", "vehicle.model"],
      });
    }

    const lead = createLead({
      firstName,
      lastName,
      email,
      zip,
      vehicle: {
        year: vehicle.year || 0,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        color: vehicle.color,
        interior: vehicle.interior || "any",
      },
      constraints: {
        dealType: constraints?.dealType || "cash",
        ...constraints,
      },
      status: "new",
    });

    console.log("✅ Created lead:", lead.id);
    return res.status(201).json({ ok: true, lead });
  } catch (err) {
    console.error("❌ Error creating lead:", err);
    return res.status(500).json({ ok: false, error: "lead_creation_failed" });
  }
});

/**
 * Get a specific lead
 */
app.get("/api/leads/:leadId", (req, res) => {
  const { leadId } = req.params;
  const lead = getLead(leadId);

  if (!lead) {
    return res.status(404).json({ ok: false, error: "lead_not_found" });
  }

  return res.json({ ok: true, lead });
});

/**
 * Receive dealer reply and evaluate it
 * Called by webhook when email comes in
 */
app.post("/api/leads/:leadId/dealer-reply", async (req, res) => {
  try {
    const { leadId } = req.params;
    const { dealerId, from, subject, text } = req.body;

    if (!dealerId || !from || !text) {
      return res.status(400).json({
        ok: false,
        error: "missing_required_fields",
        required: ["dealerId", "from", "text"],
      });
    }

    const lead = getLead(leadId);
    if (!lead) {
      return res.status(404).json({ ok: false, error: "lead_not_found" });
    }

    // Parse dealer email into structured offer
    const offer = await parseDealerEmail(dealerId, leadId, text);

    // Map lead constraints to old CustomerCriteria format for evaluateOffer
    // TODO: refactor evaluateOffer to work with Lead directly
    const mockCriteria = {
      requestId: leadId,
      customerName: `${lead.firstName} ${lead.lastName}`,
      customerEmail: lead.email,
      zip: lead.zip,
      year: lead.vehicle.year,
      make: lead.vehicle.make,
      model: lead.vehicle.model,
      trim: lead.vehicle.trim || "",
      mustHaves: [],
      dealbreakers: [],
      targetPrice: lead.constraints.cash?.maxOtd || 0,
      maxPrice: lead.constraints.cash?.maxOtd || 0,
      toleranceAboveTarget: 0,
      timelineDescription: "soon",
    };

    // Evaluate offer
    const evaluation = evaluateOffer(mockCriteria, offer);

    // Log conversation
    appendConversation(leadId, {
      from: "dealer",
      subject,
      text,
      dealerId,
    });

    // Build follow-up email
    const followup = buildFollowupEmail(mockCriteria, offer, evaluation);

    // Update lead status if decision is accept
    if (evaluation.decision === "accept") {
      updateLead(leadId, { status: "won" });
    } else if (evaluation.decision === "reject") {
      updateLead(leadId, { status: "negotiating" });
    }

    console.log(
      "🎯 Evaluated offer for lead:",
      leadId,
      "Decision:",
      evaluation.decision
    );

    return res.json({
      ok: true,
      evaluation,
      followupEmail: followup,
    });
  } catch (err) {
    console.error("❌ Error evaluating dealer reply:", err);
    return res.status(500).json({
      ok: false,
      error: "evaluation_failed",
    });
  }
});

// ----------------- Start server -----------------

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`LotShoppr backend listening on port ${port}`);
});


