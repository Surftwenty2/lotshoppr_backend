export interface CustomerCriteria {
  requestId: string;
  customerName: string;
  customerEmail: string;
  zip: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  drivetrain?: string;
  interiorPreference?: "light" | "dark" | "any";
  mustHaves: string[];
  dealbreakers: string[];
  targetPrice: number; // assumed OTD
  maxPrice: number;
  toleranceAboveTarget: number;
  timelineDescription: string; // e.g. "the next couple of weeks"
}

export interface Dealer {
  dealerId: string;
  name: string;
  email: string;
  city?: string;
  state?: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

const subjectVariants = [
  (c: CustomerCriteria) =>
    `Looking for a ${c.year} ${c.make} ${c.model} near ${c.zip}`,
  (c: CustomerCriteria) =>
    `${c.year} ${c.make} ${c.model} buyer in ${c.zip} – pricing question`,
  (c: CustomerCriteria) =>
    `Question about ${c.year} ${c.make} ${c.model} availability`,
];

const introVariants = [
  (c: CustomerCriteria) =>
    `Hi there,\n\nMy name is ${c.customerName} and I live in the ${c.zip} area. I’m currently shopping for a ${c.year} ${c.make} ${c.model}${c.trim ? " " + c.trim : ""}${c.drivetrain ? " " + c.drivetrain : ""}.`,
  (c: CustomerCriteria) =>
    `Hi,\n\nI’m ${c.customerName} in ${c.zip}. I’m seriously looking at a ${c.year} ${c.make} ${c.model}${c.trim ? " " + c.trim : ""}${c.drivetrain ? " " + c.drivetrain : ""} and wanted to see what you might have available.`,
  (c: CustomerCriteria) =>
    `Hello,\n\nI’m in the market for a ${c.year} ${c.make} ${c.model}${c.trim ? " " + c.trim : ""}${c.drivetrain ? " " + c.drivetrain : ""}, and I’m reaching out directly as a customer to check on inventory and realistic pricing.`,
];

function interiorSentence(c: CustomerCriteria): string {
  if (!c.interiorPreference || c.interiorPreference === "any") return "";
  const words =
    c.interiorPreference === "light" ? "lighter interior" : "darker interior";
  return ` I’d prefer a ${words} if possible.`;
}

function mustHaveSentence(c: CustomerCriteria): string {
  if (!c.mustHaves.length) return "";
  const list = c.mustHaves.join(", ");
  const variants = [
    ` A few features I really care about are: ${list}.`,
    ` My must-have features include: ${list}.`,
    ` I’m trying to make sure it has: ${list}.`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

function dealbreakerSentence(c: CustomerCriteria): string {
  if (!c.dealbreakers.length) return "";
  const list = c.dealbreakers.join(", ");
  const variants = [
    ` I’m trying to avoid: ${list}.`,
    ` I’m not interested in anything with: ${list}.`,
    ` I’d rather stay away from: ${list}.`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

const priceBlockVariants = [
  (c: CustomerCriteria) =>
    `\n\nI’m trying to stay around $${c.targetPrice.toLocaleString()} out the door, and I can stretch up to about $${c.maxPrice.toLocaleString()} for the right vehicle.`,
  (c: CustomerCriteria) =>
    `\n\nPrice-wise, my goal is roughly $${c.targetPrice.toLocaleString()} out the door, with an upper limit near $${c.maxPrice.toLocaleString()}.`,
  (c: CustomerCriteria) =>
    `\n\nIn terms of budget, I’m targeting about $${c.targetPrice.toLocaleString()} OTD and I’d like not to go past roughly $${c.maxPrice.toLocaleString()}.`,
];

const askBlockVariants = [
  () =>
    `\n\nDo you currently have anything in stock that’s a close match, and what would a realistic out-the-door number look like (including dealer fees, but before tax is fine if that’s easier)?`,
  () =>
    `\n\nCould you let me know if you have something that fits this description and what your best all-in (or close) number would be?`,
  () =>
    `\n\nIf you have something that fits, I’d appreciate a straightforward quote with all dealer fees included so I can compare it apples-to-apples.`,
];

const closingVariants = [
  () => `\n\nThanks for your time,\n${"{{NAME}}"}`,
  () => `\n\nThanks in advance for any info you can share,\n${"{{NAME}}"}`,
  () => `\n\nI appreciate your help,\n${"{{NAME}}"}`,
];

export function generateCustomerEmail(
  criteria: CustomerCriteria,
  dealer: Dealer
): GeneratedEmail {
  const subject =
    subjectVariants[Math.floor(Math.random() * subjectVariants.length)](
      criteria
    );

  const intro =
    introVariants[Math.floor(Math.random() * introVariants.length)](criteria);

  const details =
    interiorSentence(criteria) +
    mustHaveSentence(criteria) +
    dealbreakerSentence(criteria);

  const priceBlock =
    priceBlockVariants[Math.floor(Math.random() * priceBlockVariants.length)](
      criteria
    );

  const askBlock =
    askBlockVariants[Math.floor(Math.random() * askBlockVariants.length)]();

  const closingTemplate =
    closingVariants[Math.floor(Math.random() * closingVariants.length)]();
  const closing = closingTemplate.replace("{{NAME}}", criteria.customerName);

  const body =
    intro +
    details +
    `\n\nTiming-wise, I’m hoping to do something within ${criteria.timelineDescription}.` +
    priceBlock +
    askBlock +
    closing;

  return { subject, body };
}
