"use client";

import { useState, useTransition, KeyboardEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Loader2,
  Link2,
  Tag,
  DollarSign,
  Clock,
  RotateCcw,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  CreateServiceSchema,
  type CreateServiceInput,
  createServiceAction,
} from "@/actions/marketplace/create-service";
import type { CertifiedCourseOption, CategoryOption } from "../page";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ServiceCreationFormProps {
  certifiedCourses: CertifiedCourseOption[];
  categories: CategoryOption[];
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80">
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  error,
  max = 5,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
  max?: number;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!tag || tag.length < 2 || value.includes(tag) || value.length >= max) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "min-h-[2.75rem] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg",
          "bg-slate-950 border border-slate-700 cursor-text",
          "focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all"
        )}
      >
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20 text-xs"
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:text-indigo-100"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        {value.length < max && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => input && addTag(input)}
            placeholder={value.length === 0 ? "Type a tag, press Enter…" : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
          />
        )}
      </div>
      <p className="text-[11px] text-slate-600">
        {value.length}/{max} tags added · Press{" "}
        <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[10px]">
          Enter
        </kbd>{" "}
        or{" "}
        <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[10px]">
          ,
        </kbd>{" "}
        to add
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Portfolio Links ──────────────────────────────────────────────────────────

function PortfolioLinksInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (links: string[]) => void;
}) {
  const addLink = () => {
    if (value.length < 5) onChange([...value, ""]);
  };

  const updateLink = (index: number, url: string) => {
    const updated = [...value];
    updated[index] = url;
    onChange(updated);
  };

  const removeLink = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2.5">
      {value.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              type="url"
              value={link}
              onChange={(e) => updateLink(i, e.target.value)}
              placeholder="https://your-portfolio.com/project"
              className={cn(
                "w-full pl-9 pr-4 py-2.5 rounded-lg text-sm",
                "bg-slate-950 border border-slate-700 text-slate-200",
                "placeholder:text-slate-600",
                "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                "transition-all"
              )}
            />
          </div>
          <button
            type="button"
            onClick={() => removeLink(i)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-500/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {value.length < 5 && (
        <button
          type="button"
          onClick={addLink}
          className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add portfolio link {value.length > 0 ? `(${value.length}/5)` : ""}
        </button>
      )}
    </div>
  );
}

// ─── Number Input ─────────────────────────────────────────────────────────────

function NumberInput({
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
  step = 1,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value || ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const parsed = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          if (!isNaN(parsed)) onChange(parsed);
        }}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm",
          "bg-slate-950 border border-slate-700 text-slate-200",
          "placeholder:text-slate-600",
          "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
          "transition-all",
          prefix ? "pl-7" : "pl-3",
          suffix ? "pr-12" : "pr-3"
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

function getErrorMessage(
  code: string | undefined
): string {
  switch (code) {
    case "NO_CERTIFICATE":
      return "Your certificate for this course could not be verified. Please ensure you passed the course quiz.";
    case "FORBIDDEN_ROLE":
      return "Your account is not authorized to create services.";
    case "SERVER_ERROR":
      return "Something went wrong on our end. Please try again.";
    default:
      return "An unexpected error occurred.";
  }
}

export function ServiceCreationForm({
  certifiedCourses,
  categories,
}: ServiceCreationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(CreateServiceSchema),
    defaultValues: {
      courseId: "",
      categoryId: null,
      title: "",
      description: "",
      price: 25,
      deliveryDays: 3,
      revisions: 1,
      tags: [],
      portfolioLinks: [],
    },
    mode: "onBlur",
  });

  const tags = form.watch("tags") ?? [];
  const portfolioLinks = form.watch("portfolioLinks") ?? [];
  const selectedCourseId = form.watch("courseId");

  const selectedCourse = certifiedCourses.find(
    (c) => c.courseId === selectedCourseId
  );

  const onSubmit = form.handleSubmit((data) => {
    setServerError(null);

    startTransition(async () => {
      const result = await createServiceAction(data);

      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => router.push("/dashboard/creator/services"), 1200);
        return;
      }

      if (result.fieldErrors) {
        for (const [field, errors] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof CreateServiceInput, {
            type: "server",
            message: errors?.[0],
          });
        }
      }

      setServerError(getErrorMessage(result.error));
    });
  });

  if (submitSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Service Created!</h2>
        <p className="text-slate-400 text-sm">
          Redirecting to your services…
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 mt-6">

        {/* ── Section 1: Foundation ─────────────────────────────────────── */}
        <FormSection
          title="Service Foundation"
          description="Link your service to a course you've certified in."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Certified Course */}
            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    Certified Course <span className="text-red-400">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 h-10">
                        <SelectValue placeholder="Select a certified course…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {certifiedCourses.map((cert) => (
                        <SelectItem
                          key={cert.courseId}
                          value={cert.courseId}
                          className="text-slate-200 focus:bg-indigo-500/10 focus:text-white cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{cert.courseTitle}</span>
                            <span className="text-amber-400 text-xs font-semibold shrink-0">
                              {cert.score}%
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-slate-600 text-xs">
                    Only courses with a passing certificate are listed.
                  </FormDescription>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Category</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? null : v)
                    }
                    defaultValue={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 h-10">
                        <SelectValue placeholder="Select a category…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem
                        value="__none__"
                        className="text-slate-400 focus:bg-slate-800 cursor-pointer"
                      >
                        Uncategorized
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem
                          key={cat.id}
                          value={cat.id}
                          className="text-slate-200 focus:bg-indigo-500/10 focus:text-white cursor-pointer"
                        >
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Certificate preview strip */}
          {selectedCourse && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300 truncate">
                  {selectedCourse.courseTitle}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Credential{" "}
                  <span className="font-mono text-slate-400">
                    {selectedCourse.credentialId}
                  </span>{" "}
                  · Score{" "}
                  <span className="text-amber-400 font-semibold">
                    {selectedCourse.score}%
                  </span>
                </p>
              </div>
            </div>
          )}
        </FormSection>

        {/* ── Section 2: Service Details ────────────────────────────────── */}
        <FormSection
          title="Service Details"
          description="Write a compelling title and description to attract buyers."
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">
                  Service Title <span className="text-red-400">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. I will build a full-stack Next.js web application…"
                    className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500 h-10"
                  />
                </FormControl>
                <div className="flex justify-between items-center">
                  <FormMessage className="text-red-400 text-xs" />
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {field.value?.length ?? 0}/100
                  </span>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">
                  Description <span className="text-red-400">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder="Describe exactly what you'll deliver, what's included, your process, and any requirements from the buyer…"
                    className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                  />
                </FormControl>
                <div className="flex justify-between items-center">
                  <FormMessage className="text-red-400 text-xs" />
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {field.value?.length ?? 0}/3000
                  </span>
                </div>
              </FormItem>
            )}
          />
        </FormSection>

        {/* ── Section 3: Pricing & Delivery ────────────────────────────── */}
        <FormSection
          title="Pricing & Delivery"
          description="Set competitive rates based on your expertise level."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Price (USD) <span className="text-red-400">*</span>
                    </span>
                  </FormLabel>
                  <FormControl>
                    <NumberInput
                      value={field.value}
                      onChange={field.onChange}
                      min={5}
                      max={10000}
                      step={0.01}
                      prefix="$"
                      placeholder="25.00"
                    />
                  </FormControl>
                  <FormDescription className="text-slate-600 text-xs">
                    Min $5 · Max $10,000
                  </FormDescription>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deliveryDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      Delivery Time <span className="text-red-400">*</span>
                    </span>
                  </FormLabel>
                  <FormControl>
                    <NumberInput
                      value={field.value}
                      onChange={field.onChange}
                      min={1}
                      max={90}
                      suffix="days"
                      placeholder="3"
                    />
                  </FormControl>
                  <FormDescription className="text-slate-600 text-xs">
                    1–90 calendar days
                  </FormDescription>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revisions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-violet-400" />
                      Revisions
                    </span>
                  </FormLabel>
                  <FormControl>
                    <NumberInput
                      value={field.value}
                      onChange={field.onChange}
                      min={0}
                      max={20}
                      placeholder="1"
                    />
                  </FormControl>
                  <FormDescription className="text-slate-600 text-xs">
                    0 = no revisions
                  </FormDescription>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* ── Section 4: Tags & Portfolio ───────────────────────────────── */}
        <FormSection
          title="Tags & Portfolio"
          description="Help buyers discover your service and see past work."
        >
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">
                  Tags <span className="text-red-400">*</span>
                </FormLabel>
                <FormControl>
                  <TagInput
                    value={tags}
                    onChange={(newTags) => {
                      field.onChange(newTags);
                      form.setValue("tags", newTags, { shouldValidate: true });
                    }}
                    error={form.formState.errors.tags?.message}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="portfolioLinks"
            render={() => (
              <FormItem>
                <FormLabel className="text-slate-300">
                  Portfolio Links{" "}
                  <span className="text-slate-600 font-normal text-xs">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <PortfolioLinksInput
                    value={portfolioLinks}
                    onChange={(links) =>
                      form.setValue("portfolioLinks", links, {
                        shouldValidate: true,
                      })
                    }
                  />
                </FormControl>
                <FormDescription className="text-slate-600 text-xs">
                  Add up to 5 links to showcase your previous work.
                </FormDescription>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />
        </FormSection>

        {/* ── Server error ──────────────────────────────────────────────── */}
        {serverError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{serverError}</p>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Publishing…
              </>
            ) : (
              "Publish Service"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}