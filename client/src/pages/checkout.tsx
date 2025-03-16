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
import { Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

if (!import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  throw new Error('Missing required ReCAPTCHA key: VITE_RECAPTCHA_SITE_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const billingSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  postalCode: z.string().min(5, "Please enter a valid postal code"),
});

type BillingForm = z.infer<typeof billingSchema>;

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { state: { total }, clearCart } = useCart();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const loadRecaptcha = async () => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`;
      document.body.appendChild(script);
    };
    loadRecaptcha();
  }, []);

  const form = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      postalCode: "",
    },
  });

  const handleSubmit = async (data: BillingForm) => {
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Execute reCAPTCHA v3
      const recaptchaToken = await (window as any).grecaptcha.execute(
        import.meta.env.VITE_RECAPTCHA_SITE_KEY,
        { action: 'submit' }
      );

      if (!recaptchaToken) {
        toast({
          title: "Verification Failed",
          description: "Please try again",
          variant: "destructive",
        });
        return;
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.protocol}//${window.location.host}/order-confirmation`,
          payment_method_data: {
            billing_details: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              address: {
                postal_code: data.postalCode,
                country: 'US',
              }
            },
          },
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message || "Please check your details and try again.",
          variant: "destructive",
        });
      } else {
        clearCart();
        setLocation('/order-confirmation');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred.",
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
                <Input {...field} />
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
                <Input type="email" {...field} />
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
                <Input type="tel" {...field} />
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
                <Input {...field} placeholder="12345" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PaymentElement options={{
          layout: {
            type: 'tabs',
            defaultCollapsed: false,
          },
          business: {
            name: 'Faith Hikers Store'
          },
          fields: {
            billingDetails: 'never'
          },
          wallets: {
            applePay: 'never',
            googlePay: 'never'
          },
        }} />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isProcessing || !stripe}
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
                  <Button>
                    Continue Shopping
                  </Button>
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