export type ServiceItem = {
  id: string;
  name: string;
  hint: string;
  unitPriceEur: number;
  vatRate: number;
  active: boolean;
  appliesTo?: "vehicle" | "equipment" | "both";
};

export type ServiceDb = {
  version: 1;
  services: ServiceItem[];
};
