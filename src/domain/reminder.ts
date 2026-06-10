export type ReminderAttachmentCategory = "fuel_guide" | "rental_contract" | "return_checklist" | "specific_documents";

export type ReminderMailSettings = {
  enabled: boolean;
  subject: string;
  text: string;
  daysBeforeReturn: number;
  sendTime: string;
  attachmentCategories: ReminderAttachmentCategory[];
};

export type ReminderMailDb = {
  version: 1;
  settings: ReminderMailSettings;
};
