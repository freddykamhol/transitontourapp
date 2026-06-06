export type ServiceItem = {
  id: string;
  name: string;
  hint: string;
  unitPriceEur: number;
  vatRate: number;
  active: boolean;
};

export type ServiceDb = {
  version: 1;
  services: ServiceItem[];
};
