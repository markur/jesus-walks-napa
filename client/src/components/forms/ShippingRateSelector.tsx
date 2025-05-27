import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { type ShippingAddress } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type ShippingMethod = {
  carrier: string;
  service: string;
  rate: number;
  estimatedDays: number;
  trackingAvailable: boolean;
};

export interface ShippingRateSelectorProps {
  customerAddress: ShippingAddress;
  onSelectRate: (rate: ShippingMethod) => void;
  selectedRateId?: string;
}

// Standard parcel details for a typical order
const DEFAULT_PARCEL = {
  weight: 16, // 1 lb in oz
  length: 12, // inches
  width: 8,   // inches
  height: 6   // inches
};

// Business address (can be stored in a config later)
const BUSINESS_ADDRESS: ShippingAddress = {
  firstName: "Jesus Walks",
  lastName: "Napa",
  address1: "1275 McKinstry St",
  address2: "",
  city: "Napa",
  state: "CA",
  postalCode: "94559",
  country: "US",
  phone: "7075551234"
};

export function ShippingRateSelector({ 
  customerAddress, 
  onSelectRate, 
  selectedRateId 
}: ShippingRateSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rates, setRates] = useState<ShippingMethod[]>([]);
  const [selectedRate, setSelectedRate] = useState<string | undefined>(selectedRateId);
  const { toast } = useToast();

  useEffect(() => {
    if (customerAddress) {
      fetchShippingRates();
    }
  }, [customerAddress]);

  // When selected rate changes, notify parent
  useEffect(() => {
    if (selectedRate && rates.length > 0) {
      const rate = rates.find(r => 
        `${r.carrier}-${r.service}` === selectedRate
      );
      
      if (rate) {
        onSelectRate(rate);
      }
    }
  }, [selectedRate, rates, onSelectRate]);

  const fetchShippingRates = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/shipping/calculate-rates", {
        fromAddress: BUSINESS_ADDRESS,
        toAddress: customerAddress,
        parcelDetails: DEFAULT_PARCEL
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch shipping rates");
      }
      
      setRates(data);
      
      // Auto-select the cheapest option if none is selected
      if (!selectedRate && data.length > 0) {
        const cheapestRate = data.reduce((prev: ShippingMethod, curr: ShippingMethod) => 
          prev.rate < curr.rate ? prev : curr
        );
        setSelectedRate(`${cheapestRate.carrier}-${cheapestRate.service}`);
      }
    } catch (error) {
      toast({
        title: "Error fetching shipping rates",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRate = (value: string) => {
    setSelectedRate(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Calculating shipping options...</span>
        </CardContent>
      </Card>
    );
  }

  if (rates.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">
            No shipping options available for this address. Please check your address or contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Shipping Method</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={selectedRate} 
          onValueChange={handleSelectRate}
          className="space-y-3"
        >
          {rates.map(rate => {
            const rateId = `${rate.carrier}-${rate.service}`;
            return (
              <div 
                key={rateId}
                className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem 
                  value={rateId} 
                  id={rateId} 
                  className="peer"
                />
                <Label 
                  htmlFor={rateId} 
                  className="flex-1 flex justify-between items-center cursor-pointer"
                >
                  <div>
                    <span className="font-medium">{rate.carrier}</span>
                    <p className="text-sm text-muted-foreground">{rate.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {rate.estimatedDays === 1 
                        ? "Estimated 1 day delivery"
                        : rate.estimatedDays > 1
                        ? `Estimated ${rate.estimatedDays} days delivery`
                        : "Delivery time unknown"
                      }
                    </p>
                  </div>
                  <div className="font-semibold">
                    ${rate.rate.toFixed(2)}
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}