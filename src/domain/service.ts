export type ServiceSuggestionRule = {
  enabled: boolean;
  minDays?: number;
  maxDays?: number;
  quantityMode: "rentalDays" | "fixed";
  fixedQty?: number;
};

export type ServiceItem = {
  id: string;
  name: string;
  hint: string;
  unitPriceEur: number;
  vatRate: number;
  active: boolean;
  appliesTo?: "vehicle" | "equipment" | "both";
  suggestionRule?: ServiceSuggestionRule;
};

export type ServiceDb = {
  version: 1;
  services: ServiceItem[];
};
