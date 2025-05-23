import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, MapPin, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { shippingAddressSchema, type ShippingAddress } from "@shared/schema";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

type ShippingFormProps = {
  onAddressValidated: (address: ShippingAddress) => void;
};

interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export function ShippingAddressForm({ onAddressValidated }: ShippingFormProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  const form = useForm<ShippingAddress>({
    resolver: zodResolver(shippingAddressSchema),
    mode: "onChange",
    defaultValues: {
      country: "US" // Default country to US
    }
  });

  // Handle address search input change
  useEffect(() => {
    if (addressSearch.length > 3) {
      setIsLoadingSuggestions(true);
      
      // Clear previous timeout if it exists
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
      
      // Set a new timeout to prevent too many API calls
      searchTimeoutRef.current = window.setTimeout(() => {
        fetchAddressSuggestions(addressSearch);
      }, 300);
    } else {
      setAddressSuggestions([]);
      setOpenSuggestions(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [addressSearch]);

  // Fetch address suggestions from our backend
  const fetchAddressSuggestions = async (query: string) => {
    try {
      const response = await apiRequest("GET", `/api/shipping/address-suggestions?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch address suggestions");
      }
      
      const data = await response.json();
      setAddressSuggestions(data);
      setOpenSuggestions(true);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      // Fall back to postal code lookup if address suggestions fail
      if (query.match(/^\d{5}$/)) {
        fetchPostalCodeDetails(query);
      }
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // If we only have a postal code, try to get city and state
  const fetchPostalCodeDetails = async (postalCode: string) => {
    try {
      const response = await apiRequest("GET", `/api/shipping/postal-code-details?code=${postalCode}`);
      if (!response.ok) {
        throw new Error("Failed to fetch postal code details");
      }
      
      const data = await response.json();
      if (data.city && data.state) {
        form.setValue("city", data.city);
        form.setValue("state", data.state);
        form.setValue("postalCode", postalCode);
        toast({
          title: "Address Details Found",
          description: `Found ${data.city}, ${data.state} for postal code ${postalCode}`,
        });
      }
    } catch (error) {
      console.error("Error fetching postal code details:", error);
    }
  };

  // When a suggested address is selected
  const handleAddressSelect = async (suggestion: AddressSuggestion) => {
    setOpenSuggestions(false);
    setAddressSearch(suggestion.description);
    
    try {
      const response = await apiRequest("GET", `/api/shipping/address-details?placeId=${encodeURIComponent(suggestion.placeId)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch address details");
      }
      
      const addressDetails = await response.json();
      
      // Populate the form with the returned address details
      if (addressDetails) {
        form.setValue("address1", addressDetails.address1);
        form.setValue("address2", addressDetails.address2 || "");
        form.setValue("city", addressDetails.city);
        form.setValue("state", addressDetails.state);
        form.setValue("postalCode", addressDetails.postalCode);
        form.setValue("country", addressDetails.country);
        
        // Automatically trigger validation if we have all required address fields
        if (
          addressDetails.address1 &&
          addressDetails.city &&
          addressDetails.state &&
          addressDetails.postalCode
        ) {
          // Wait for form to update before validating
          setTimeout(() => {
            const firstName = form.getValues("firstName");
            const lastName = form.getValues("lastName");
            const phone = form.getValues("phone");
            
            if (firstName && lastName && phone) {
              form.handleSubmit(validateAddress)();
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error("Error fetching address details:", error);
    }
  };

  const validateAddress = async (data: ShippingAddress) => {
    setIsValidating(true);
    try {
      const response = await apiRequest("POST", "/api/shipping/validate-address", data);
      const validatedAddress = await response.json();
      
      if (validatedAddress.isValid) {
        setIsAddressValid(true);
        onAddressValidated(validatedAddress.normalizedAddress || data);
        
        // If we have a normalized address that's different from what was entered, update the form
        if (validatedAddress.normalizedAddress) {
          const normalized = validatedAddress.normalizedAddress;
          
          // Only update if there are differences to avoid unnecessary form updates
          let hasChanges = false;
          
          if (normalized.address1 !== data.address1) {
            form.setValue("address1", normalized.address1);
            hasChanges = true;
          }
          
          if (normalized.address2 !== data.address2) {
            form.setValue("address2", normalized.address2 || "");
            hasChanges = true;
          }
          
          if (normalized.city !== data.city) {
            form.setValue("city", normalized.city);
            hasChanges = true;
          }
          
          if (normalized.state !== data.state) {
            form.setValue("state", normalized.state);
            hasChanges = true;
          }
          
          if (normalized.postalCode !== data.postalCode) {
            form.setValue("postalCode", normalized.postalCode);
            hasChanges = true;
          }
          
          if (hasChanges) {
            toast({
              title: "Address Updated",
              description: "We've corrected your address for better delivery accuracy.",
            });
          }
        }
      } else {
        form.setError("address1", {
          type: "manual",
          message: validatedAddress.messages?.[0] || "Invalid address"
        });
        setIsAddressValid(false);
      }
    } catch (error: any) {
      form.setError("address1", {
        type: "manual",
        message: error.message || "Failed to validate address"
      });
      setIsAddressValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Listen for postal code changes to auto-fill city and state
  const postalCodeValue = form.watch("postalCode");
  useEffect(() => {
    const postalCode = postalCodeValue?.trim();
    if (postalCode && postalCode.match(/^\d{5}$/)) {
      const city = form.getValues("city");
      const state = form.getValues("state");
      
      // Only fetch details if city and state are not already filled
      if (!city || !state) {
        fetchPostalCodeDetails(postalCode);
      }
    }
  }, [postalCodeValue]);

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(validateAddress)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Autocomplete */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Find Your Address</label>
              <Popover open={openSuggestions} onOpenChange={setOpenSuggestions}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Start typing your address..."
                      className="pl-8"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                    />
                    {isLoadingSuggestions && (
                      <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start" side="bottom" sideOffset={5}>
                  <Command className="w-full">
                    <CommandList>
                      <CommandEmpty>No address found</CommandEmpty>
                      <CommandGroup heading="Suggested Addresses">
                        {addressSuggestions.map((suggestion) => (
                          <CommandItem
                            key={suggestion.placeId}
                            onSelect={() => handleAddressSelect(suggestion)}
                            className="flex items-center"
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            <div>
                              <p>{suggestion.mainText}</p>
                              <p className="text-xs text-muted-foreground">{suggestion.secondaryText}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Type your address, or just start with your postal code
              </p>
            </div>

            <FormField
              control={form.control}
              name="address1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123 Main St" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Apt, Suite, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="City" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CA" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="(123) 456-7890" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isValidating || !form.formState.isValid}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating Address...
                </>
              ) : isAddressValid ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Address Verified
                </>
              ) : (
                'Validate Address'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
