export type CompanyData = {
  company: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  iban: string;
  bic: string;
  notes: string;
};

export type CompanyDb = {
  version: 1;
  company: CompanyData;
};
