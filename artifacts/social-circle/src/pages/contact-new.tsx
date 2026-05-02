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

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  relationshipType: z.string().min(1, "Relationship type is required").max(50),
  tier: z.enum(["core", "monthly", "yearly"] as const),
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
      notes: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({ 
      data: {
        name: data.name,
        relationshipType: data.relationshipType,
        tier: data.tier as CreateContactBodyTier,
        notes: data.notes || null,
        lastContactDate: new Date().toISOString(), // Default to today
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

              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-foreground">Connection Intent (Tier)</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                        data-testid="radio-tier"
                      >
                        <FormItem>
                          <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value="core" className="sr-only" />
                            </FormControl>
                            <div className="p-4 rounded-xl border border-border bg-card transition-all hover:border-primary/50 text-center space-y-1 h-full flex flex-col justify-center">
                              <span className="block font-medium text-foreground">Core</span>
                              <span className="block text-xs text-muted-foreground">Every 3 weeks</span>
                              <span className="block text-xs text-muted-foreground mt-2">A-list. The people most central to your life.</span>
                            </div>
                          </FormLabel>
                        </FormItem>
                        <FormItem>
                          <FormLabel className="[&:has([data-state=checked])>div]:border-amber-500 [&:has([data-state=checked])>div]:bg-amber-500/5 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value="monthly" className="sr-only" />
                            </FormControl>
                            <div className="p-4 rounded-xl border border-border bg-card transition-all hover:border-amber-500/50 text-center space-y-1 h-full flex flex-col justify-center">
                              <span className="block font-medium text-foreground">Monthly</span>
                              <span className="block text-xs text-muted-foreground">Every 2 months</span>
                              <span className="block text-xs text-muted-foreground mt-2">B-list. Important people you want to keep close.</span>
                            </div>
                          </FormLabel>
                        </FormItem>
                        <FormItem>
                          <FormLabel className="[&:has([data-state=checked])>div]:border-emerald-500 [&:has([data-state=checked])>div]:bg-emerald-500/5 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value="yearly" className="sr-only" />
                            </FormControl>
                            <div className="p-4 rounded-xl border border-border bg-card transition-all hover:border-emerald-500/50 text-center space-y-1 h-full flex flex-col justify-center">
                              <span className="block font-medium text-foreground">Yearly</span>
                              <span className="block text-xs text-muted-foreground">Every 6 months</span>
                              <span className="block text-xs text-muted-foreground mt-2">C-list. Maintaining the connection over time.</span>
                            </div>
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
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
