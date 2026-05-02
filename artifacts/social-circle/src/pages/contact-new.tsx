import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateContact, getListContactsQueryKey, getGetContactStatsQueryKey, getGetDueContactsQueryKey, CreateContactBodyTier } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { TIER_INTERVALS, defaultIntervalDays } from "@/lib/tier-utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  relationshipType: z.string().min(1, "Relationship type is required").max(50),
  tier: z.enum(["core", "monthly", "yearly"] as const),
  intervalDays: z.number().int().positive(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ContactNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateContact();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      relationshipType: "",
      tier: "monthly",
      intervalDays: defaultIntervalDays("monthly"),
      notes: "",
    },
  });

  const selectedTier = form.watch("tier");
  const selectedInterval = form.watch("intervalDays");

  const handleTierChange = (newTier: "core" | "monthly" | "yearly") => {
    form.setValue("tier", newTier);
    form.setValue("intervalDays", defaultIntervalDays(newTier));
  };

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({ 
      data: {
        name: data.name,
        relationshipType: data.relationshipType,
        tier: data.tier as CreateContactBodyTier,
        intervalDays: data.intervalDays,
        notes: data.notes || null,
        lastContactDate: new Date().toISOString().slice(0, 10),
      } 
    }, {
      onSuccess: (newContact) => {
        toast({
          title: "Contact added",
          description: `${newContact.name} has been added to your circle.`,
        });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
        setLocation(`/contacts/${newContact.id}`);
      }
    });
  };

  const tierOptions = [
    {
      value: "core" as const,
      label: "Core",
      description: "Your most essential people. Contact often.",
      color: "border-primary/60 bg-primary/5",
      checkedColor: "[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/10",
    },
    {
      value: "monthly" as const,
      label: "Monthly",
      description: "Important people you want to keep close.",
      color: "border-amber-500/60 bg-amber-500/5",
      checkedColor: "[&:has([data-state=checked])>div]:border-amber-500 [&:has([data-state=checked])>div]:bg-amber-500/10",
    },
    {
      value: "yearly" as const,
      label: "Yearly",
      description: "Relationships worth maintaining over time.",
      color: "border-emerald-500/60 bg-emerald-500/5",
      checkedColor: "[&:has([data-state=checked])>div]:border-emerald-500 [&:has([data-state=checked])>div]:bg-emerald-500/10",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border/40 pb-6">
          <CardTitle className="text-2xl font-serif">Bring Someone In</CardTitle>
          <CardDescription className="text-base mt-1">
            Add a new relationship to your circle. Be intentional about how often you want to connect.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" id="add-contact-form">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Derek Sivers" className="bg-background" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="relationshipType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Relationship Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Mentor, Friend, Colleague" className="bg-background" {...field} data-testid="input-relation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tier selector */}
              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-foreground">Connection Tier</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(v) => handleTierChange(v as "core" | "monthly" | "yearly")}
                        value={field.value}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                        data-testid="radio-tier"
                      >
                        {tierOptions.map((opt) => (
                          <FormItem key={opt.value}>
                            <FormLabel className={`${opt.checkedColor} cursor-pointer`}>
                              <FormControl>
                                <RadioGroupItem value={opt.value} className="sr-only" />
                              </FormControl>
                              <div className="p-4 rounded-xl border border-border bg-card transition-all hover:border-muted-foreground/40 text-center space-y-1 h-full flex flex-col justify-center">
                                <span className="block font-semibold text-foreground">{opt.label}</span>
                                <span className="block text-xs text-muted-foreground mt-2">{opt.description}</span>
                              </div>
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Interval sub-picker — always visible, changes with tier */}
              <FormField
                control={form.control}
                name="intervalDays"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-foreground">How often to reach out</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2" data-testid="interval-picker">
                        {(TIER_INTERVALS[selectedTier] ?? []).map((opt) => (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => field.onChange(opt.days)}
                            data-testid={`interval-option-${opt.days}`}
                            className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                              selectedInterval === opt.days
                                ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Initial Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Context about this person, what you usually talk about, etc." 
                        className="min-h-[100px] resize-y bg-background" 
                        {...field} 
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormDescription>
                      You can add more notes later.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t border-border/40 p-6 flex justify-end gap-3">
          <Link href="/contacts">
            <Button variant="ghost" data-testid="btn-cancel">Cancel</Button>
          </Link>
          <Button 
            type="submit" 
            form="add-contact-form" 
            disabled={createMutation.isPending}
            className="gap-2 min-w-[120px]"
            data-testid="btn-submit"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Contact
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
