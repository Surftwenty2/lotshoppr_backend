import OpenAI from "openai";
import { CustomerCriteria } from "./emailTemplates";

export interface DealerOffer {
  dealerId: string;
  requestId: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  drivetrain?: string;
  color?: string;
  newOrUsed?: "new" | "used" | "cpo" | "unknown";
  mileage?: number | null;
  msrp?: number | null;
  quotedBasePrice?: number | null;
  docFee?: number | null;
  otherFees?: number | null;
  taxEstimated?: number | null;
  priceType?: "otd" | "before_tax_fees" | "unknown";
  mustFinanceWithDealer?: boolean;
  mustAddProducts?: boolean;
  expirationDate?: string | null;
  stockNumber?: string | null;
  vin?: string | null;
  rawText: string;
}

export type DecisionType = "accept" | "counter" | "reject" | "clarify";

export interface EvaluationResult {
  decision: DecisionType;
  reason: string;
  otdEstimate?: number;
  counterPrice?: number;
  missingMustHaves?: string[];
  dealbreakerHit?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeFeatures(offer: DealerOffer): string[] {
  const text = offer.rawText.toLowerCase();
  const features: string[] = [];
  const featureKeywords = [
    "moonroof",
    "sunroof",
    "blind spot",
    "blind-spot",
    "heated seats",
    "ventilated seats",
    "leather",
    "cloth",
    "navigation",
  ];
  for (const k of featureKeywords) {
    if (text.includes(k)) {
      features.push(k);
    }
  }
  return features;
}

function estimateOtd(offer: DealerOffer): number | null {
  const base = offer.quotedBasePrice ?? offer.msrp;
  if (base == null) return null;
  const doc = offer.docFee ?? 0;
  const other = offer.otherFees ?? 0;
  const tax = offer.taxEstimated ?? 0;
  return base + doc + other + tax;
}

export function evaluateOffer(
  criteria: CustomerCriteria,
  offer: DealerOffer
): EvaluationResult {
  if (offer.year && offer.year !== criteria.year) {
    return { decision: "reject", reason: "wrong_year" };
  }
  if (offer.make && offer.make.toLowerCase() !== criteria.make.toLowerCase()) {
    return { decision: "reject", reason: "wrong_make" };
  }
  if (
    offer.model &&
    offer.model.toLowerCase() !== criteria.model.toLowerCase()
  ) {
    return { decision: "reject", reason: "wrong_model" };
  }

  const features = normalizeFeatures(offer);

  const missingMust = criteria.mustHaves.filter(
    (m) => !features.some((f) => f.includes(m.toLowerCase()))
  );
  if (missingMust.length) {
    return {
      decision: "counter",
      reason: "missing_features",
      missingMustHaves: missingMust,
    };
  }

  for (const d of criteria.dealbreakers) {
    if (features.some((f) => f.includes(d.toLowerCase()))) {
      return {
        decision: "reject",
        reason: "dealbreaker_feature",
        dealbreakerHit: d,
      };
    }
  }

  const otd = estimateOtd(offer);
  if (otd == null) {
    return {
      decision: "clarify",
      reason: "no_price_parsed",
    };
  }

  const target = criteria.targetPrice;
  const max = criteria.maxPrice;
  const tol = criteria.toleranceAboveTarget;

  if (otd <= target) {
    return {
      decision: "accept",
      reason: "meets_or_beats_target",
      otdEstimate: otd,
    };
  }

  if (otd <= target + tol && otd <= max) {
    return {
      decision: "accept",
      reason: "within_tolerance",
      otdEstimate: otd,
    };
  }

  if (otd <= max) {
    const counter = Math.min(target, otd - 250);
    return {
      decision: "counter",
      reason: "above_target_but_under_max",
      otdEstimate: otd,
      counterPrice: counter,
    };
  }

  return {
    decision: "reject",
    reason: "over_max_price",
    otdEstimate: otd,
  };
}

export async function parseDealerEmail(
  dealerId: string,
  requestId: string,
  text: string
): Promise<DealerOffer> {
  const system = `You extract structured car purchase offers from dealer emails.
Return strict JSON only, matching this TypeScript type:

{
  "year": number | null,
  "make": string | null,
  "model": string | null,
  "trim": string | null,
  "drivetrain": string | null,
  "color": string | null,
  "newOrUsed": "new" | "used" | "cpo" | "unknown",
  "mileage": number | null,
  "msrp": number | null,
  "quotedBasePrice": number | null,
  "docFee": number | null,
  "otherFees": number | null,
  "taxEstimated": number | null,
  "priceType": "otd" | "before_tax_fees" | "unknown",
  "mustFinanceWithDealer": boolean,
  "mustAddProducts": boolean,
  "expirationDate": string | null,
  "stockNumber": string | null,
  "vin": string | null
}`;

  const userPrompt = `Dealer email:\n\n${text}\n\nExtract the values. Use null for unknown numbers.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const offer: DealerOffer = {
    dealerId,
    requestId,
    year: parsed.year ?? null,
    make: parsed.make ?? null,
    model: parsed.model ?? null,
    trim: parsed.trim ?? null,
    drivetrain: parsed.drivetrain ?? null,
    color: parsed.color ?? null,
    newOrUsed: parsed.newOrUsed ?? "unknown",
    mileage: parsed.mileage ?? null,
    msrp: parsed.msrp ?? null,
    quotedBasePrice: parsed.quotedBasePrice ?? null,
    docFee: parsed.docFee ?? null,
    otherFees: parsed.otherFees ?? null,
    taxEstimated: parsed.taxEstimated ?? null,
    priceType: parsed.priceType ?? "unknown",
    mustFinanceWithDealer: !!parsed.mustFinanceWithDealer,
    mustAddProducts: !!parsed.mustAddProducts,
    expirationDate: parsed.expirationDate ?? null,
    stockNumber: parsed.stockNumber ?? null,
    vin: parsed.vin ?? null,
    rawText: text,
  };

  return offer;
}

export function buildFollowupEmail(
  criteria: CustomerCriteria,
  offer: DealerOffer,
  evaluation: EvaluationResult
): { subject: string; body: string } {
  const prettyOtd =
    evaluation.otdEstimate != null
      ? `$${evaluation.otdEstimate.toLocaleString()}`
      : "the price you mentioned";

  if (evaluation.decision === "accept") {
    const subject = `Re: ${criteria.year} ${criteria.make} ${criteria.model} – that works for me`;
    const body = [
      "Hi,",
      "",
      `Thanks for sending the numbers on the ${criteria.year} ${criteria.make} ${criteria.model}${criteria.trim ? " " + criteria.trim : ""}.`,
      "",
      `Based on what you sent, the out-the-door figure of ${prettyOtd} works for me and fits what I was aiming for.`,
      "",
      "Before I commit, can you please confirm there aren’t any additional mandatory add-ons or surprise fees beyond what you already listed?",
      "",
      "If that all checks out, I’m ready to move forward and schedule a time.",
      "",
      `Thanks,`,
      criteria.customerName,
    ].join("\n");
    return { subject, body };
  }

  if (evaluation.decision === "counter" && evaluation.counterPrice != null) {
    const subject = `Re: ${criteria.year} ${criteria.make} ${criteria.model} – close, but a bit high`;
    const body = [
      "Hi,",
      "",
      `I appreciate you sending over the quote on the ${criteria.year} ${criteria.make} ${criteria.model}${criteria.trim ? " " + criteria.trim : ""}.`,
      "",
      `The only hang-up for me right now is the overall number. Your out-the-door figure of ${prettyOtd} is a bit above where I’m comfortable landing.`,
      "",
      `If you’re able to get closer to about $${evaluation.counterPrice.toLocaleString()} out the door, I’d be a lot more comfortable moving forward quickly.`,
      "",
      "Let me know if there’s any room to tighten things up.",
      "",
      "Thanks again,",
      criteria.customerName,
    ].join("\n");
    return { subject, body };
  }

  if (evaluation.decision === "clarify") {
    const subject = `Re: ${criteria.year} ${criteria.make} ${criteria.model} – can you clarify the total?`;
    const body = [
      "Hi,",
      "",
      `Thanks for the info on the ${criteria.year} ${criteria.make} ${criteria.model}.`,
      "",
      "I may have missed it, but I couldn’t tell exactly what the total out-the-door price would be (with dealer fees included).",
      "",
      "Could you send a simple breakdown with the main price, dealer fees, and any required extras so I can see the full picture?",
      "",
      "Thanks,",
      criteria.customerName,
    ].join("\n");
    return { subject, body };
  }

  const subject = `Re: ${criteria.year} ${criteria.make} ${criteria.model} – I’m going to pass`;
  const body = [
    "Hi,",
    "",
    "Thanks for taking the time to send the quote.",
    "",
    "After looking it over, I’m going to pass for now because it doesn’t quite line up with what I’m trying to do on this purchase.",
    "",
    "I appreciate the information either way.",
    "",
    "Best,",
    criteria.customerName,
  ].join("\n");
  return { subject, body };
}
