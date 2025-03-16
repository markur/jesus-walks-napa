import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState, useEffect } from 'react';
import { useCart } from "@/hooks/use-cart";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const billingSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .regex(/^[a-zA-Z\s]*$/, "Name can only contain letters and spaces"),
  email: z.string()
    .email("Please enter a valid email address")
    .min(5, "Email must be at least 5 characters")
    .max(50, "Email cannot exceed 50 characters"),
  phone: z.string()
    .regex(/^\+?1?\d{9,15}$/, "Please enter a valid phone number")
    .min(10, "Phone number must be at least 10 digits"),
  postalCode: z.string()
    .regex(/^\d{5}(-\d{4})?$/, "Please enter a valid US postal code (e.g., 12345 or 12345-6789)")
});

type BillingForm = z.infer<typeof billingSchema>;

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { toast } = useToast();
  const { state: { total }, clearCart } = useCart();
  const [, setLocation] = useLocation();

  const form = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      postalCode: "",
    },
    mode: "onChange", // Enable real-time validation
  });

  // Handle payment element changes
  const handlePaymentChange = (event: any) => {
    setPaymentError(event.error ? event.error.message : null);
  };

  const handleSubmit = async (data: BillingForm) => {
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
          payment_method_data: {
            billing_details: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              address: {
                postal_code: data.postalCode,
              }
            },
          },
        },
      });

      if (error) {
        throw error;
      }

      clearCart();
      setLocation('/order-confirmation');

      toast({
        title: "Payment Successful",
        description: "Thank you for your purchase!",
      });
    } catch (err: any) {
      setPaymentError(err.message);
      toast({
        title: "Payment Failed",
        description: err.message || "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  placeholder="John Doe"
                  className={form.formState.errors.name ? "border-red-500" : ""}
                  onChange={(e) => {
                    field.onChange(e);
                    form.trigger("name"); // Trigger validation on change
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  {...field} 
                  placeholder="john@example.com"
                  className={form.formState.errors.email ? "border-red-500" : ""}
                  onChange={(e) => {
                    field.onChange(e);
                    form.trigger("email");
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input 
                  type="tel" 
                  {...field} 
                  placeholder="(123) 456-7890"
                  className={form.formState.errors.phone ? "border-red-500" : ""}
                  onChange={(e) => {
                    field.onChange(e);
                    form.trigger("phone");
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="postalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Postal Code</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  placeholder="12345"
                  className={form.formState.errors.postalCode ? "border-red-500" : ""}
                  onChange={(e) => {
                    field.onChange(e);
                    form.trigger("postalCode");
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PaymentElement 
          onChange={handlePaymentChange}
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
            }
          }} 
        />

        {paymentError && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{paymentError}</span>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isProcessing || !stripe || !form.formState.isValid}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${total.toFixed(2)}`
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState<string>("");
  const { state: { total, items } } = useCart();

  useEffect(() => {
    if (items.length > 0) {
      apiRequest("POST", "/api/create-payment-intent", { amount: total })
        .then((res) => res.json())
        .then((data) => setClientSecret(data.clientSecret))
        .catch((error) => {
          console.error("Failed to create payment intent:", error);
        });
    }
  }, [total, items]);

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-6">Your cart is empty</p>
                <Link href="/shop">
                  <Button>Continue Shopping</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                  },
                }}>
                  <CheckoutForm />
                </Elements>
              ) : (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}