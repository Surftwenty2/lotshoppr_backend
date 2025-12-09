import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import {
  CustomerCriteria,
  Dealer,
  generateCustomerEmail,
} from "./emailTemplates";
import {
  parseDealerEmail,
  evaluateOffer,
  buildFollowupEmail,
} from "./logic";

// ----------------- In-memory storage (demo only) -----------------

const criteriaStore = new Map<string, CustomerCriteria>();
const dealerStore = new Map<string, Dealer>();

// demo dealers – replace with real data later
dealerStore.set("dealer_1", {
  dealerId: "dealer_1",
  name: "Example Toyota",
  email: "sales@example-toyota.com",
});
dealerStore.set("dealer_2", {
  dealerId: "dealer_2",
  name: "Another Toyota Store",
  email: "internet@another-toyota.com",
});

// ----------------- Express setup -----------------

const app = express();
app.use(bodyParser.json());

// ----------------- Email stub -----------------

// stub – wire this to your email provider later
async function sendEmail(
  from: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  console.log("=== SENDING EMAIL (stub) ===");
  console.log("From:", from);
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("Body:\n", body);
  console.log("============================");
}

// ----------------- Tally helpers -----------------

type TallyField = {
  key: string;
  label: string | null;
  type: string;
  value: any;
  options?: { id: string; text: string }[];
};

type TallyPayload = {
  eventId: string;
  eventType: string;
  createdAt: string;
  data: {
    responseId: string;
    submissionId: string;
    respondentId: string;
    formId: string;
    formName: string;
    createdAt: string;
    fields: TallyField[];
  };
};

// index fields by key for easier lookup
function indexFields(fields: TallyField[]) {
  const map: Record<string, TallyField> = {};
  for (const f of fields) {
    map[f.key] = f;
  }
  return map;
}

// convert a field into readable text
function getFieldText(
  byKey: Record<string, TallyField>,
  key: string
): string | null {
  const field = byKey[key];
  if (!field) return null;

  if (field.type === "DROPDOWN") {
    const selectedIds: string[] | null = field.value;
    if (!selectedIds || !selectedIds.length || !field.options) return null;
    const selectedId = selectedIds[0];
    const opt = field.options.find((o) => o.id === selectedId);
    return opt?.text ?? null;
  }

  if (typeof field.value === "string") return field.value;
  return null;
}

// parse things like "$70,000" or "$500/Month" to a number
function parseMoney(input: string | null): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

// ----------------- Tally webhook -----------------

// This expects the raw payload you pasted from Tally/Vercel
app.post("/webhooks/tally", async (req, res) => {
  try {
    const payload = req.body as TallyPayload;
    console.log("📥 Raw Tally payload:", JSON.stringify(payload));

    const fields = payload.data?.fields ?? [];
    const byKey = indexFields(fields);

    // --- Customer info (final page) ---
    const firstName = getFieldText(byKey, "question_oMPMO5") ?? "";
    const lastName = getFieldText(byKey, "question_P5x50x") ?? "";
    const customerEmail = getFieldText(byKey, "question_EQRQ02") ?? "";
    const zip = getFieldText(byKey, "question_rA4AEX") ?? "";

    const customerName = `${firstName} ${lastName}`.trim();

    // --- Vehicle info ---
    const yearText = getFieldText(byKey, "question_O5250k"); // Year dropdown text like "2024"
    const year = yearText ? Number(yearText) : 0;

    const make = getFieldText(byKey, "question_V5e58N") ?? "";
    const model = getFieldText(byKey, "question_P5x50P") ?? "";
    const trim = getFieldText(byKey, "question_EQRQ0A") ?? "";

    const interiorShade = getFieldText(byKey, "question_rA4AEp"); // "Light Interior" or "Dark Interior"
    let interiorPreference: "light" | "dark" | "any" = "any";
    if (interiorShade === "Light Interior") interiorPreference = "light";
    else if (interiorShade === "Dark Interior") interiorPreference = "dark";

    const exteriorColor = getFieldText(byKey, "question_GdGd0Q"); // White / Black / etc. (not used in logic yet)

    // --- Deal type ---
    const dealTypeText = getFieldText(byKey, "question_4x6xjd"); // "Lease" | "Finance" | "Pay Cash"
    let dealType: "lease" | "finance" | "cash" | "unknown" = "unknown";
    if (dealTypeText === "Lease") dealType = "lease";
    else if (dealTypeText === "Finance") dealType = "finance";
    else if (dealTypeText === "Pay Cash") dealType = "cash";

    // --- Terms depending on deal type ---

    // Lease terms (null if not used)
    const leaseMilesText = getFieldText(byKey, "question_jQRQxY"); // e.g. "12000 Miles"
    const leaseMonthsText = getFieldText(byKey, "question_2NWNrg"); // e.g. "36"
    const leaseDownText = getFieldText(byKey, "question_xaqaZE"); // e.g. "$2000"
    const leaseMaxMonthlyText = getFieldText(byKey, "question_R5N5LQ"); // "$500/Month"

    const leaseTerms =
      dealType === "lease"
        ? {
            milesPerYear: leaseMilesText
              ? parseInt(leaseMilesText.replace(/[^0-9]/g, ""), 10)
              : null,
            months: leaseMonthsText ? Number(leaseMonthsText) : null,
            downPayment: parseMoney(leaseDownText),
            maxMonthly: parseMoney(leaseMaxMonthlyText),
          }
        : null;

    // Finance terms
    const financeDownText = getFieldText(byKey, "question_oMPMON");
    const financeMaxMonthlyText = getFieldText(byKey, "question_GdGd0O");
    const financeMonthsText = getFieldText(byKey, "question_O5250M");

    const financeTerms =
      dealType === "finance"
        ? {
            downPayment: parseMoney(financeDownText),
            maxMonthly: parseMoney(financeMaxMonthlyText),
            months: financeMonthsText ? Number(financeMonthsText) : null,
          }
        : null;

    // Cash terms
    const cashMaxOtdText = getFieldText(byKey, "question_V5e586");
    const cashMaxOtd = dealType === "cash" ? parseMoney(cashMaxOtdText) : null;

    // --- Map into CustomerCriteria for your existing logic ---

    // For now:
    // - Cash deals use the real max OTD as both targetPrice and maxPrice
    // - Lease/finance deals use 0 for prices (your negotiation logic can special-case this later)
    let targetPrice = 0;
    let maxPrice = 0;
    let toleranceAboveTarget = 0;

    if (dealType === "cash" && cashMaxOtd !== null) {
      targetPrice = cashMaxOtd;
      maxPrice = cashMaxOtd;
      toleranceAboveTarget = 0;
    }

    const requestId = payload.data.responseId;

    const criteria: CustomerCriteria = {
      requestId,
      customerName,
      customerEmail,
      zip,
      year,
      make,
      model,
      trim,
      drivetrain: undefined,
      interiorPreference,
      mustHaves: [],
      dealbreakers: [],
      targetPrice,
      maxPrice,
      toleranceAboveTarget,
      timelineDescription: "the next few weeks",
    };

    // Store criteria for later use when dealer replies come in
    criteriaStore.set(requestId, criteria);

    console.log("🎯 Parsed CustomerCriteria from Tally:");
    console.dir(
      {
        criteria,
        dealType,
        leaseTerms,
        financeTerms,
        cashMaxOtd,
        exteriorColor,
      },
      { depth: null }
    );

    // For now, send to both demo dealers; later you will select real ones
    const dealerIds = ["dealer_1", "dealer_2"];

    for (const dealerId of dealerIds) {
      const dealer = dealerStore.get(dealerId);
      if (!dealer) continue;
      const email = generateCustomerEmail(criteria, dealer);
      await sendEmail(
        criteria.customerEmail,
        dealer.email,
        email.subject,
        email.body
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error in /webhooks/tally:", err);
    res.status(500).json({ ok: false, error: "tally_webhook_failed" });
  }
});

// ----------------- Email provider webhook -----------------

// Email provider webhook: dealer replies land here
app.post("/webhooks/email-inbound", async (req, res) => {
  try {
    const {
      requestId,
      dealerId,
      from,
      subject,
      text,
    }: {
      requestId: string;
      dealerId: string;
      from: string;
      subject: string;
      text: string;
    } = req.body;

    const criteria = criteriaStore.get(requestId);
    if (!criteria) {
      console.warn("No criteria found for requestId", requestId);
      res.status(404).json({ ok: false, error: "unknown_request" });
      return;
    }

    const offer = await parseDealerEmail(dealerId, requestId, text);
    const evaluation = evaluateOffer(criteria, offer);
    const followup = buildFollowupEmail(criteria, offer, evaluation);

    await sendEmail(
      criteria.customerEmail,
      from,
      followup.subject,
      followup.body
    );

    res.json({ ok: true, decision: evaluation });
  } catch (err) {
    console.error("❌ Error in /webhooks/email-inbound:", err);
    res.status(500).json({ ok: false, error: "inbound_email_failed" });
  }
});

// ----------------- Start server -----------------

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`LotShoppr backend listening on port ${port}`);
});


