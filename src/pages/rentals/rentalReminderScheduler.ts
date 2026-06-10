import { listRentals, updateRental } from "../../storage/rentalRepo";
import { getReminderMailSettings } from "../../storage/reminderRepo";
import { sendRentalReminderMail } from "./reminderMail";

let running = false;

function scheduledReminderAt(endAt: string, daysBeforeReturn: number, sendTime: string): Date | null {
  const end = new Date(endAt);
  if (!Number.isFinite(end.getTime())) return null;
  const [hoursRaw, minutesRaw] = sendTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const scheduled = new Date(end);
  scheduled.setDate(scheduled.getDate() - Math.max(0, daysBeforeReturn));
  scheduled.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return scheduled;
}

export async function runDueRentalReminders(now = new Date()): Promise<void> {
  if (running) return;
  running = true;
  try {
    const settings = getReminderMailSettings();
    if (!settings.enabled) return;

    const dueRentals = listRentals().filter((rental) => {
      if (rental.actualReturnAt) return false;
      if (rental.reminderWorkflow?.sentAt) return false;
      if (!rental.tenant.email) return false;
      const dueAt = scheduledReminderAt(rental.endAt, settings.daysBeforeReturn, settings.sendTime);
      return Boolean(dueAt && dueAt.getTime() <= now.getTime());
    });

    for (const rental of dueRentals) {
      try {
        const result = await sendRentalReminderMail(rental, settings);
        updateRental(rental.id, {
          reminderWorkflow: {
            ...rental.reminderWorkflow,
            sentAt: new Date().toISOString(),
            messageId: result.messageId,
            lastError: "",
          },
        });
      } catch (err) {
        updateRental(rental.id, {
          reminderWorkflow: {
            ...rental.reminderWorkflow,
            lastError: err instanceof Error ? err.message : "Erinnerungsmail-Versand fehlgeschlagen",
          },
        });
      }
    }
  } finally {
    running = false;
  }
}
