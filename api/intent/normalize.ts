/**
 * Message normalization for intent detection
 * Handles typos (via fuzzy later), whitespace, encoding
 */

const TYPO_MAP: Record<string, string> = {
  cancle: "cancel", cancell: "cancel", canel: "cancel",
  discout: "discount", diccount: "discount", disount: "discount",
  insurence: "insurance", insurnace: "insurance", insuranse: "insurance",
  shiping: "shipping", shippng: "shipping", delivary: "delivery",
  apointment: "appointment", appointmnt: "appointment",
  perscription: "prescription", presciption: "prescription",
  testosteron: "testosterone", testerone: "testosterone",
  subcription: "subscription", subscribtion: "subscription",
  reciept: "receipt", recipt: "receipt", refil: "refill", reffill: "refill",
  chrge: "charge", chrage: "charge", schedual: "schedule", scedule: "schedule",
  resutls: "results", resluts: "results", labratory: "laboratory",
  medicaton: "medication", medicatin: "medication",
  labz: "labs", rezults: "results", hlp: "help",
  fedex: "fedex", ups: "ups", usps: "usps",
};

export function normalize(message: string): string {
  if (!message || typeof message !== "string") return "";
  let s = message
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
  // Apply typo corrections (word boundary)
  const words = s.split(/\s+/);
  s = words
    .map((w) => {
      const key = w.replace(/[^\w]/g, "");
      return TYPO_MAP[key] ?? w;
    })
    .join(" ");
  return s;
}
