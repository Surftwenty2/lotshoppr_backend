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
  dealType?: 'lease' | 'finance' | 'cash';
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
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `Lease inquiry: ${c.year} ${c.make} ${c.model}`;
    } else if (c.dealType === 'finance') {
      return `Finance options for ${c.year} ${c.make} ${c.model}`;
    }
    return `Looking for a ${c.year} ${c.make} ${c.model} near ${c.zip}`;
  },
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `Monthly lease pricing on ${c.year} ${c.make} ${c.model}`;
    } else if (c.dealType === 'finance') {
      return `Finance details for ${c.year} ${c.make} ${c.model}`;
    }
    return `${c.year} ${c.make} ${c.model} buyer in ${c.zip} – pricing question`;
  },
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `Lease availability for ${c.year} ${c.make} ${c.model}`;
    } else if (c.dealType === 'finance') {
      return `Finance availability for ${c.year} ${c.make} ${c.model}`;
    }
    return `Question about ${c.year} ${c.make} ${c.model} availability`;
  },
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
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `\n\nCould you provide a detailed lease quote, including monthly payment, term, mileage, and any fees?`;
    } else if (c.dealType === 'finance') {
      return `\n\nCould you provide a detailed finance quote, including APR, term, down payment, and monthly payment?`;
    }
    return `\n\nDo you currently have anything in stock that’s a close match, and what would a realistic out-the-door number look like (including dealer fees, but before tax is fine if that’s easier)?`;
  },
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `\n\nDo you have any lease specials for this vehicle? I’d like to know the monthly payment, term, and mileage.`;
    } else if (c.dealType === 'finance') {
      return `\n\nDo you have any financing options available for this vehicle? I’d like to know the APR, term, and down payment.`;
    }
    return `\n\nCould you let me know if you have something that fits this description and what your best all-in (or close) number would be?`;
  },
  (c: CustomerCriteria) => {
    if (c.dealType === 'lease') {
      return `\n\nIf you have something that fits, I’d appreciate a lease worksheet with all the details.`;
    } else if (c.dealType === 'finance') {
      return `\n\nIf you have something that fits, I’d appreciate a straightforward finance quote with all details included.`;
    }
    return `\n\nIf you have something that fits, I’d appreciate a straightforward quote with all dealer fees included so I can compare it apples-to-apples.`;
  },
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
  // More dynamic, natural, and random initial dealer email
  const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
  const subject = random(subjectVariants)(criteria);
  const intro = random(introVariants)(criteria);
  const details = interiorSentence(criteria) + mustHaveSentence(criteria) + dealbreakerSentence(criteria);
  const timingBlock = random([
    `\n\nI’m hoping to do something within ${criteria.timelineDescription}.`,
    `\n\nIdeally, I’d like to wrap this up ${criteria.timelineDescription}.`,
    `\n\nMy timeline is ${criteria.timelineDescription}, but I’m flexible if needed.`,
  ]);
  // Determine deal type
  const dealType = (criteria as any).dealType || 'cash';
  let priceBlock = '';
  let askBlock = '';
  if (dealType === 'lease') {
    priceBlock = `\n\nI’m hoping to be around $${((criteria as any).lease?.maxPayment || 0).toLocaleString()}/month with as little due at signing as possible, for a ${((criteria as any).lease?.months || 36)}-month lease and ${((criteria as any).lease?.miles || 10000).toLocaleString()} miles/year.`;
    askBlock = `\n\nCould you send a quote with the monthly payment, due at signing, term, mileage, and any fees or add-ons? If you have a worksheet, that’d be great.`;
  } else if (dealType === 'finance') {
    priceBlock = `\n\nI’m looking to finance with a monthly payment around $${((criteria as any).finance?.maxPayment || 0).toLocaleString()}, ideally with a low APR and minimal down payment, for about ${((criteria as any).finance?.months || 60)} months.`;
    askBlock = `\n\nCould you send a quote with the APR, term, down payment, monthly payment, and all fees?`;
  } else {
    priceBlock = random(priceBlockVariants)(criteria);
    askBlock = random(askBlockVariants)();
  }
  const closingTemplate = random(closingVariants)();
  const closing = closingTemplate.replace("{{NAME}}", criteria.customerName);
  const body =
    intro +
    details +
    timingBlock +
    priceBlock +
    askBlock +
    closing;
  return { subject, body };
}
