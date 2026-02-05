// Temporary in-memory storage
// TODO: Replace with Postgres/database when ready

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export interface Lead {
  id: string;
  createdAt: string;
  status: "new" | "negotiating" | "won" | "lost";
  firstName: string;
  lastName: string;
  email: string;
  zip: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    color?: string;
    interior?: "light" | "dark" | "any";
  };
  constraints: {
    dealType: "cash" | "lease" | "finance";
    cash?: { maxOtd: number | null };
    lease?: { miles: number | null; months: number | null; down: number | null; maxPayment: number | null };
    finance?: { months: number | null; down: number | null; maxPayment: number | null };
  };
  conversation: ConversationEntry[];
}

export interface ConversationEntry {
  from: "dealer" | "customer" | "system";
  subject?: string;
  text: string;
  at: string;
  dealerId?: string;
}

const leads = new Map<string, Lead>();

export function createLead(data: Omit<Lead, "id" | "createdAt" | "conversation">): Lead {
  const lead: Lead = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    conversation: [],
  };
  leads.set(lead.id, lead);
  return lead;
}

export function getLead(id: string): Lead | null {
  return leads.get(id) || null;
}

export function updateLead(id: string, patch: Partial<Lead>): Lead | null {
  const existing = leads.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  leads.set(id, updated);
  return updated;
}

export function appendConversation(id: string, entry: Omit<ConversationEntry, "at">): Lead | null {
  const existing = leads.get(id);
  if (!existing) return null;
  existing.conversation.push({
    ...entry,
    at: new Date().toISOString(),
  });
  leads.set(id, existing);
  return existing;
}

export function getAllLeads(): Lead[] {
  return Array.from(leads.values());
}
