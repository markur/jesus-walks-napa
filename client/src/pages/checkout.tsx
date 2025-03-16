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
import { Loader2, AlertCircle, TruckIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShippingAddressForm } from "@/components/forms/ShippingAddressForm";
import type { ShippingAddress, ShippingRate } from "@shared/schema";

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
});

type BillingForm = z.infer<typeof billingSchema>;

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const { toast } = useToast();
  const { state: { total, items }, clearCart } = useCart();
  const [, setLocation] = useLocation();

  const form = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
    mode: "onChange",
  });

  const handleAddressValidated = async (address: ShippingAddress) => {
    setShippingAddress(address);

    try {
      // Calculate shipping rates
      const response = await apiRequest("POST", "/api/shipping/calculate-rates", {
        fromAddress: {
          firstName: "Store",
          lastName: "Admin",
          address1: "1234 Store St",
          city: "Napa",
          state: "CA",
          postalCode: "94559",
          country: "US",
          phone: "1234567890"
        },
        toAddress: address,
        parcelDetails: {
          weight: 1.0,
          length: 12.0,
          width: 8.0,
          height: 6.0
        }
      });

      const rates = await response.json();
      setShippingRates(rates);

      if (rates.length > 0) {
        setSelectedRate(rates[0]); // Select the first rate by default
      }
    } catch (error: any) {
      toast({
        title: "Error Calculating Shipping",
        description: error.message || "Failed to calculate shipping rates",
        variant: "destructive",
      });
    }
  };

  const handlePaymentChange = (event: any) => {
    setPaymentError(event.error ? event.error.message : null);
  };

  const handleSubmit = async (data: BillingForm) => {
    if (!stripe || !elements || !shippingAddress || !selectedRate) {
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
            },
            shipping: {
              name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
              address: {
                line1: shippingAddress.address1,
                line2: shippingAddress.address2,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postal_code: shippingAddress.postalCode,
                country: 'US',
              },
              phone: shippingAddress.phone,
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
    <div className="space-y-6">
      {!shippingAddress ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Shipping Information</h2>
          <ShippingAddressForm onAddressValidated={handleAddressValidated} />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {shippingRates.map((rate) => (
                      <div
                        key={`${rate.carrier}-${rate.service}`}
                        className={`p-4 border rounded-lg cursor-pointer flex items-center justify-between ${
                          selectedRate?.service === rate.service ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedRate(rate)}
                      >
                        <div className="flex items-center space-x-4">
                          <TruckIcon className="h-5 w-5" />
                          <div>
                            <p className="font-medium">{rate.carrier} - {rate.service}</p>
                            <p className="text-sm text-muted-foreground">
                              Estimated delivery: {rate.estimatedDays} days
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">${rate.rate.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
              <Card>
                <CardContent className="pt-6 space-y-4">
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

                  <div className="pt-4 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Shipping</span>
                      <span>${selectedRate?.rate.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${(total + (selectedRate?.rate || 0)).toFixed(2)}</span>
                    </div>
                  </div>

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
                      `Pay $${(total + (selectedRate?.rate || 0)).toFixed(2)}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      )}
    </div>
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