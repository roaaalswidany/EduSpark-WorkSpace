/* eslint-disable react-hooks/incompatible-library */
"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
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
  Sparkles,
} from "lucide-react";
import { createServiceAction } from "@/actions/marketplace/create-service";
import { updateServiceAction } from "@/actions/marketplace/update-service";
import {
  CreateServiceSchema,
  type CreateServiceInput,
} from "@/actions/marketplace/create-service-schema";
import type { CertifiedCourseOption } from "../page";
import { cn } from "@/lib/utils";

interface ServiceCreationFormProps {
  certifiedCourses: CertifiedCourseOption[];
  mode?: "create" | "edit";
  serviceId?: string;
  initialData?: Partial<CreateServiceInput>;
}

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
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-card/80">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function TagInput({
  value,
  onChange,
  error,
  max = 5,
  placeholder,
  hint,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
  max?: number;
  placeholder: string;
  hint: React.ReactNode;
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
          "min-h-11 flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg",
          "bg-background border border-border cursor-text",
          "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
        )}
      >
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-xs"
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:text-primary/80"
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
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-30 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/70">{hint}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PortfolioLinksInput({
  value,
  onChange,
  placeholder,
  addLabel,
}: {
  value: string[];
  onChange: (links: string[]) => void;
  placeholder: string;
  addLabel: string;
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
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            <input
              type="url"
              value={link}
              onChange={(e) => updateLink(i, e.target.value)}
              placeholder={placeholder}
              className={cn(
                "w-full pl-9 pr-4 py-2.5 rounded-lg text-sm",
                "bg-background border border-border text-foreground",
                "placeholder:text-muted-foreground/70",
                "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
                "transition-all"
              )}
            />
          </div>
          <button
            type="button"
            onClick={() => removeLink(i)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-destructive/10 text-muted-foreground/70 hover:text-destructive transition-colors border border-border hover:border-destructive/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {value.length < 5 && (
        <button
          type="button"
          onClick={addLink}
          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {addLabel} {value.length > 0 ? `(${value.length}/5)` : ""}
        </button>
      )}
    </div>
  );
}

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
  const [text, setText] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setText(value === 0 ? "" : String(value));
      lastEmittedRef.current = value;
    }
  }, [value]);

  const isDecimal = step < 1;
  const allowedRegex = isDecimal ? /^\d*\.?\d*$/ : /^\d*$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw !== "" && !allowedRegex.test(raw)) return;

    setText(raw);

    if (raw === "" || raw === ".") return;

    const parsed = isDecimal ? parseFloat(raw) : parseInt(raw, 10);
    if (!isNaN(parsed)) {
      lastEmittedRef.current = parsed;
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (text === "" || text === ".") {
      const fallback = min ?? 0;
      setText(fallback === 0 ? "" : String(fallback));
      lastEmittedRef.current = fallback;
      onChange(fallback);
      return;
    }

    let parsed = isDecimal ? parseFloat(text) : parseInt(text, 10);
    if (isNaN(parsed)) parsed = min ?? 0;
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;

    setText(String(parsed));
    lastEmittedRef.current = parsed;
    onChange(parsed);
  };

  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode={isDecimal ? "decimal" : "numeric"}
        value={text}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm",
          "bg-background border border-border text-foreground",
          "placeholder:text-muted-foreground/70",
          "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
          "transition-all",
          prefix ? "pl-7" : "pl-3",
          suffix ? "pr-12" : "pr-3"
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs select-none pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function ServiceCreationForm({
  certifiedCourses,
  mode = "create",
  serviceId,
  initialData,
}: ServiceCreationFormProps) {
  const t = useTranslations("serviceForm.form");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isEdit = mode === "edit";

  const form = useForm<
    z.input<typeof CreateServiceSchema>,
    unknown,
    CreateServiceInput
  >({
    resolver: zodResolver(CreateServiceSchema),
    defaultValues: {
      courseId: initialData?.courseId ?? "",
      categoryId: initialData?.categoryId ?? null,
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      price: initialData?.price ?? 25,
      deliveryDays: initialData?.deliveryDays ?? 3,
      revisions: initialData?.revisions ?? 1,
      tags: initialData?.tags ?? [],
      portfolioLinks: initialData?.portfolioLinks ?? [],
    },
    mode: "onBlur",
  });

  const tags = form.watch("tags") ?? [];
  const portfolioLinks = form.watch("portfolioLinks") ?? [];
  const selectedCourseId = form.watch("courseId");

  const selectedCourse = certifiedCourses.find(
    (c) => c.courseId === selectedCourseId
  );

  function getErrorMessage(code: string | undefined): string {
    switch (code) {
      case "NO_CERTIFICATE":
        return t("errors.noCertificate");
      case "FORBIDDEN_ROLE":
        return t("errors.forbiddenRole");
      case "FORBIDDEN":
        return t("errors.forbidden");
      case "NOT_FOUND":
        return t("errors.notFound");
      case "MALICIOUS_URL_BLOCKED":
        return t("errors.maliciousUrl");
      case "RATE_LIMITED":
        return t("errors.rateLimited");
      case "CONFLICT":
        return t("errors.conflict");
      case "SERVER_ERROR":
        return t("errors.serverError");
      default:
        return t("errors.generic");
    }
  }

  const onSubmit = form.handleSubmit((data) => {
    setServerError(null);

    const toastId = toast.loading(
      isEdit ? t("toasts.savingChanges") : t("toasts.publishing")
    );

    startTransition(async () => {
      const result =
        isEdit && serviceId
          ? await updateServiceAction({ ...data, serviceId })
          : await createServiceAction(data);

      if (result.success) {
        setSubmitSuccess(true);
        const sentToReview = "sentToReview" in result && result.sentToReview;
        toast.success(
          !isEdit
            ? t("toasts.created")
            : sentToReview
            ? t("toasts.sentForReview")
            : t("toasts.updated"),
          {
            id: toastId,
            description: !isEdit
              ? t("toasts.createdDesc")
              : sentToReview
              ? t("toasts.sentForReviewDesc")
              : t("toasts.updatedDesc"),
          }
        );
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

      const errorMessage = getErrorMessage(result.error);
      setServerError(errorMessage);
      toast.error(
        isEdit ? t("toasts.updateFailed") : t("toasts.publishFailed"),
        {
          id: toastId,
          description: errorMessage,
        }
      );
    });
  });

  if (submitSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isEdit ? t("success.updatedTitle") : t("success.createdTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("success.redirecting")}
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 mt-6">
        <FormSection
          title={t("sections.foundation.title")}
          description={t("sections.foundation.desc")}
        >
          <FormField
            control={form.control}
            name="courseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  {t("fields.certifiedCourse")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={certifiedCourses.map((cert) => ({
                      value: cert.courseId,
                      label: cert.courseTitle,
                      description: `Score ${cert.score}% · ${cert.courseLevel}`,
                      icon: (
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                      ),
                    }))}
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder={t("fields.certifiedCoursePlaceholder")}
                    searchPlaceholder={t("fields.certifiedCourseSearch")}
                    emptyMessage={t("fields.certifiedCourseEmpty")}
                  />
                </FormControl>
                <FormDescription className="text-muted-foreground/70 text-xs">
                  {t("fields.certifiedCourseDesc")}
                </FormDescription>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />

          {selectedCourse && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 truncate">
                  {selectedCourse.courseTitle}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("fields.credential")}{" "}
                  <span className="font-mono text-muted-foreground">
                    {selectedCourse.credentialId}
                  </span>{" "}
                  · {t("fields.score")}{" "}
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {selectedCourse.score}%
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-primary leading-relaxed">
              <span className="font-bold">{t("fields.categoryAuto")}</span>{" "}
              {t("fields.categoryAutoDesc")}
            </p>
          </div>
        </FormSection>

        <FormSection
          title={t("sections.details.title")}
          description={t("sections.details.desc")}
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  {t("fields.title")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("fields.titlePlaceholder")}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-primary h-10"
                  />
                </FormControl>
                <div className="flex justify-between items-center">
                  <FormMessage className="text-destructive text-xs" />
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">
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
                <FormLabel className="text-foreground">
                  {t("fields.description")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder={t("fields.descriptionPlaceholder")}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-primary resize-none"
                  />
                </FormControl>
                <div className="flex justify-between items-center">
                  <FormMessage className="text-destructive text-xs" />
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">
                    {field.value?.length ?? 0}/3000
                  </span>
                </div>
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          title={t("sections.pricing.title")}
          description={t("sections.pricing.desc")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t("fields.price")}{" "}
                      <span className="text-destructive">*</span>
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
                      placeholder={t("fields.pricePlaceholder")}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground/70 text-xs">
                    {t("fields.priceHint")}
                  </FormDescription>
                  <FormMessage className="text-destructive text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deliveryDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {t("fields.deliveryTime")}{" "}
                      <span className="text-destructive">*</span>
                    </span>
                  </FormLabel>
                  <FormControl>
                    <NumberInput
                      value={field.value}
                      onChange={field.onChange}
                      min={1}
                      max={90}
                      suffix={t("fields.deliveryDaysSuffix")}
                      placeholder={t("fields.deliveryTimePlaceholder")}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground/70 text-xs">
                    {t("fields.deliveryTimeHint")}
                  </FormDescription>
                  <FormMessage className="text-destructive text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revisions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-info" />
                      {t("fields.revisions")}
                    </span>
                  </FormLabel>
                  <FormControl>
                    <NumberInput
                      value={field.value ?? 1}
                      onChange={field.onChange}
                      min={0}
                      max={20}
                      placeholder={t("fields.revisionsPlaceholder")}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground/70 text-xs">
                    {t("fields.revisionsHint")}
                  </FormDescription>
                  <FormMessage className="text-destructive text-xs" />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection
          title={t("sections.tags.title")}
          description={t("sections.tags.desc")}
        >
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  {t("fields.tags")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <TagInput
                    value={tags}
                    onChange={(newTags) => {
                      field.onChange(newTags);
                      form.setValue("tags", newTags, { shouldValidate: true });
                    }}
                    error={form.formState.errors.tags?.message}
                    placeholder={t("fields.tagsPlaceholder")}
                    hint={
                      <>
                        {t("fields.tagsHint", {
                          count: tags.length,
                          max: 5,
                        })
                          .replace("{count}/{max}", `${tags.length}/5`)
                          .split("Enter")[0]}
                        <kbd className="px-1 py-0.5 rounded bg-accent text-muted-foreground font-mono text-[10px]">
                          Enter
                        </kbd>{" "}
                        or{" "}
                        <kbd className="px-1 py-0.5 rounded bg-accent text-muted-foreground font-mono text-[10px]">
                          ,
                        </kbd>{" "}
                        {t("fields.tagsHint", { count: tags.length, max: 5 })
                          .split("Enter")[1]
                          ?.replace(",", "")
                          .replace("to add", "")
                          .trim() ||
                          ""}
                      </>
                    }
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
                <FormLabel className="text-foreground">
                  {t("fields.portfolioLinks")}{" "}
                  <span className="text-muted-foreground/70 font-normal text-xs">
                    {t("fields.portfolioLinksOptional")}
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
                    placeholder={t("fields.portfolioLinkPlaceholder")}
                    addLabel={t("fields.addPortfolioLink")}
                  />
                </FormControl>
                <FormDescription className="text-muted-foreground/70 text-xs">
                  {t("fields.portfolioLinksHint")}
                </FormDescription>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />
        </FormSection>

        {serverError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive text-sm">{serverError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/creator/services")}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {t("fields.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {isEdit ? t("fields.saving") : t("fields.publishing")}
              </>
            ) : isEdit ? (
              t("fields.saveChanges")
            ) : (
              t("fields.publish")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}