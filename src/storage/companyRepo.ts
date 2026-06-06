import type { CompanyData, CompanyDb } from "../domain/company";

const STORAGE_KEY = "tot.companyDb.v1";

export const emptyCompanyData: CompanyData = {
  company: "",
  name: "",
  address: "",
  phone: "",
  fax: "",
  email: "",
  iban: "",
  bic: "",
  notes: "",
};

function safeParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDb(value: unknown): value is CompanyDb {
  if (!value || typeof value !== "object") return false;
  const db = value as Partial<CompanyDb>;
  return db.version === 1 && Boolean(db.company);
}

export function getCompanyData(): CompanyData {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (isDb(parsed)) return { ...emptyCompanyData, ...parsed.company };
  return emptyCompanyData;
}

export function saveCompanyData(company: CompanyData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, company } satisfies CompanyDb));
}
