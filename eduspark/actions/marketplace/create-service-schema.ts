import { z } from "zod";

export const CreateServiceSchema = z.object({
  courseId: z.string().cuid("Please select a valid certified course."),

  categoryId: z
    .string()
    .cuid("Please select a valid category.")
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? null : v)),

  title: z
    .string()
    .min(10, "Title must be at least 10 characters.")
    .max(100, "Title must be at most 100 characters.")
    .trim(),

  description: z
    .string()
    .min(50, "Description must be at least 50 characters.")
    .max(3000, "Description must be at most 3000 characters.")
    .trim(),

  price: z
    .number({ error: "Price must be a number." })
    .min(5, "Minimum price is $5.")
    .max(10_000, "Maximum price is $10,000.")
    .multipleOf(0.01, "Price can have at most 2 decimal places."),

  deliveryDays: z
    .number({ error: "Delivery time must be a number." })
    .int("Delivery time must be a whole number.")
    .min(1, "Minimum delivery is 1 day.")
    .max(90, "Maximum delivery is 90 days."),

  revisions: z
    .number({ error: "Revisions must be a number." })
    .int()
    .min(0, "Revisions cannot be negative.")
    .max(20, "Maximum revisions is 20.")
    .default(1),

  tags: z
    .array(
      z
        .string()
        .min(2, "Tag must be at least 2 characters.")
        .max(30, "Tag must be at most 30 characters.")
        .toLowerCase()
        .trim()
    )
    .min(1, "Add at least 1 tag.")
    .max(5, "Maximum 5 tags allowed.")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Tags must be unique.",
    }),

  portfolioLinks: z
    .array(
      z
        .string()
        .url("Each portfolio link must be a valid URL.")
        .max(500, "URL is too long.")
    )
    .max(5, "Maximum 5 portfolio links.")
    .default([]),
});

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

export type CreateServiceResult =
  | { success: true; serviceId: string; slug: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN_ROLE"
        | "NO_CERTIFICATE"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof CreateServiceInput, string[]>>;
    };