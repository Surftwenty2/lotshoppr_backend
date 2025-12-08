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

// in-memory storage for demo; replace with DB later
const criteriaStore = new Map<string, CustomerCriteria>();
const dealerStore = new Map<string, Dealer>();

// demo dealers – replace with real data
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

const app = express();
app.use(bodyParser.json());

// stub – wire this to your email provider
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

// Tally webhook: create criteria and send first-person emails to dealers
app.post("/webhooks/tally", async (req, res) => {
  try {
    const {
      requestId,
      customer,
      vehicle,
      price,
      timelineDescription,
      dealerIds,
    } = req.body;

    const criteria: CustomerCriteria = {
      requestId,
      customerName: customer.name,
      customerEmail: customer.email,
      zip: customer.zip,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      drivetrain: vehicle.drivetrain,
      interiorPreference: vehicle.interiorPreference ?? "any",
      mustHaves: vehicle.mustHaves ?? [],
      dealbreakers: vehicle.dealbreakers ?? [],
      targetPrice: price.targetPrice,
      maxPrice: price.maxPrice,
      toleranceAboveTarget: price.toleranceAboveTarget ?? 500,
      timelineDescription: timelineDescription ?? "the next couple of weeks",
    };

    criteriaStore.set(requestId, criteria);

    for (const dealerId of dealerIds as string[]) {
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
    console.error(err);
    res.status(500).json({ ok: false, error: "tally_webhook_failed" });
  }
});

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

    await sendEmail(criteria.customerEmail, from, followup.subject, followup.body);

    res.json({ ok: true, decision: evaluation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "inbound_email_failed" });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`LotShoppr backend listening on port ${port}`);
});
