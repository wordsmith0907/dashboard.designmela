import type { Entity } from "./domain";
export interface Client extends Entity {
  name: string;
  company: string;
  leadId: string;
  notes: string;
}
export interface Service extends Entity {
  name: string;
  description: string;
  basePrice: number;
  unit: string;
  duration: string;
  active: boolean;
}
export interface QuoteItem {
  description: string;
  quantity: number;
  price: number;
}
export interface Quote extends Entity {
  title: string;
  leadId: string;
  items: QuoteItem[];
  discount: number;
  tax: number;
  currency: string;
  notes: string;
  validUntil: string;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
}
export interface Proposal extends Entity {
  title: string;
  leadId: string;
  quoteId: string;
  scope: string;
  deliverables: string;
  timeline: string;
  revisions: string;
  price: number;
  currency: string;
  validUntil: string;
  status: "Draft" | "Sent" | "Accepted" | "Rejected";
  sentAt: string;
  decisionAt: string;
  followUpAt: string;
  projectId: string;
}
export interface Payment extends Entity {
  title: string;
  leadId: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: "Due" | "Paid" | "Overdue";
  notes: string;
}
export function quoteTotals(q: Pick<Quote, "items" | "discount" | "tax">) {
  if (
    q.items.some(
      (i) =>
        !i.description.trim() ||
        !Number.isFinite(i.quantity) ||
        i.quantity <= 0 ||
        !Number.isFinite(i.price) ||
        i.price < 0,
    ) ||
    q.discount < 0 ||
    q.tax < 0 ||
    q.tax > 100 ||
    !Number.isFinite(q.discount) ||
    !Number.isFinite(q.tax)
  )
    throw new Error(
      "Check item descriptions, quantities, prices, discount and tax.",
    );
  const subtotal = q.items.reduce((s, i) => s + i.quantity * i.price, 0);
  if (q.discount > subtotal)
    throw new Error("Discount cannot exceed subtotal.");
  const net = subtotal - q.discount;
  const tax = (net * q.tax) / 100;
  return { subtotal, tax, total: Math.round((net + tax) * 100) / 100 };
}
