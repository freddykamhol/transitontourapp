import { z } from "zod";

// Skalierbar: erlaubt beliebige zusätzliche Felder
export const inboundRequestSchema = z
  .object({
    source: z.string().optional(),
    customer: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    subject: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const messageSchema = z
  .object({
    subject: z.string().optional(),
    body: z.string().min(1),
    toEmail: z.string().email().optional(),
  })
  .passthrough();

