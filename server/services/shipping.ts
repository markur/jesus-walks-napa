import Easypost from "@easypost/api";
import NodeGeocoder from "node-geocoder";
import { default as axios } from "axios";
import type { ShippingAddress } from "@shared/schema";

if (!process.env.EASYPOST_API_KEY) {
  console.warn("Warning: Missing EASYPOST_API_KEY. Shipping features will be disabled.");
  process.env.EASYPOST_API_KEY = '';
}

// Use either GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY
const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

if (!googleApiKey) {
  console.warn("Warning: Missing Google API key. Address autocomplete features will be disabled.");
}

const easypost = new Easypost(process.env.EASYPOST_API_KEY);

const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: googleApiKey
});

export interface ValidatedAddress extends ShippingAddress {
  isValid: boolean;
  normalizedAddress?: ShippingAddress;
  messages?: string[];
}

export interface ShippingRate {
  carrier: string;
  service: string;
  rate: number;
  estimatedDays: number;
  trackingAvailable: boolean;
}

export interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PostalCodeDetails {
  city: string;
  state: string;
  country: string;
}

export class ShippingService {
  // Get address suggestions using Google Places API
  async getAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return [];
    }
    
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        {
          params: {
            input: query,
            types: 'address',
            components: 'country:us', // Limit to US addresses
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (response.data.status !== 'OK') {
        console.warn('Google Places API returned an error:', response.data.status);
        return [];
      }

      return response.data.predictions.map((prediction: any) => ({
        description: prediction.description,
        placeId: prediction.place_id,
        mainText: prediction.structured_formatting.main_text,
        secondaryText: prediction.structured_formatting.secondary_text
      }));
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      return [];
    }
  }

  // Get details for a specific place ID from Google Places API
  async getAddressDetails(placeId: string): Promise<ShippingAddress | null> {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return null;
    }
    
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: placeId,
            fields: 'address_component,formatted_address',
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (response.data.status !== 'OK') {
        console.warn('Google Places API returned an error:', response.data.status);
        return null;
      }

      const result = response.data.result;
      const components = result.address_components;
      
      // Extract address components
      const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name || '';
      const streetName = components.find((c: any) => c.types.includes('route'))?.long_name || '';
      const city = components.find((c: any) => c.types.includes('locality'))?.long_name || 
                   components.find((c: any) => c.types.includes('postal_town'))?.long_name || '';
      const state = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '';
      const postalCode = components.find((c: any) => c.types.includes('postal_code'))?.long_name || '';
      const country = components.find((c: any) => c.types.includes('country'))?.short_name || 'US';
      
      // Parse subpremise (apt/suite number) if available
      const subpremise = components.find((c: any) => c.types.includes('subpremise'))?.long_name || '';
      
      // Format address1 and address2
      const address1 = streetNumber ? `${streetNumber} ${streetName}` : streetName;
      const address2 = subpremise ? `Apt/Suite ${subpremise}` : '';
      
      return {
        firstName: '',  // These fields must be filled by the user
        lastName: '',
        address1,
        address2,
        city,
        state,
        postalCode,
        country,
        phone: ''
      };
    } catch (error) {
      console.error('Error fetching address details:', error);
      return null;
    }
  }

  // Get city and state from postal code
  async getPostalCodeDetails(postalCode: string): Promise<PostalCodeDetails | null> {
    try {
      const results = await geocoder.geocode({
        zipcode: postalCode,
        country: 'US'
      });
      
      if (!results.length) {
        return null;
      }
      
      return {
        city: results[0].city || '',
        state: results[0].administrativeLevels?.level1short || '',
        country: results[0].countryCode || 'US'
      };
    } catch (error) {
      console.error('Error fetching postal code details:', error);
      return null;
    }
  }

  async validateAddress(address: ShippingAddress): Promise<ValidatedAddress> {
    try {
      // First validate with geocoder
      const geocodeResult = await geocoder.geocode({
        address: `${address.address1} ${address.address2 || ''}`,
        country: address.country,
        zipcode: address.postalCode,
        city: address.city,
        state: address.state
      });

      if (!geocodeResult.length) {
        return {
          ...address,
          isValid: false,
          messages: ["Address could not be found"]
        };
      }

      // Then validate with EasyPost for shipping-specific validation
      const verifiedAddress = await easypost.Address.create({
        street1: address.address1,
        street2: address.address2,
        city: address.city,
        state: address.state,
        zip: address.postalCode,
        country: address.country,
        name: `${address.firstName} ${address.lastName}`,
        phone: address.phone
      });

      await verifiedAddress.verify();

      const normalizedAddress: ShippingAddress = {
        firstName: address.firstName,
        lastName: address.lastName,
        address1: verifiedAddress.street1,
        address2: verifiedAddress.street2 || '',
        city: verifiedAddress.city,
        state: verifiedAddress.state,
        postalCode: verifiedAddress.zip,
        country: verifiedAddress.country,
        phone: address.phone
      };

      return {
        ...address,
        isValid: true,
        normalizedAddress,
        messages: verifiedAddress.verifications?.delivery?.details || []
      };
    } catch (error: any) {
      return {
        ...address,
        isValid: false,
        messages: [error.message || "Address validation failed"]
      };
    }
  }

  async getShippingRates(
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress,
    parcelDetails: {
      weight: number;
      length: number;
      width: number;
      height: number;
    }
  ): Promise<ShippingRate[]> {
    try {
      const shipment = await easypost.Shipment.create({
        from_address: {
          street1: fromAddress.address1,
          street2: fromAddress.address2,
          city: fromAddress.city,
          state: fromAddress.state,
          zip: fromAddress.postalCode,
          country: fromAddress.country,
          name: `${fromAddress.firstName} ${fromAddress.lastName}`,
          phone: fromAddress.phone
        },
        to_address: {
          street1: toAddress.address1,
          street2: toAddress.address2,
          city: toAddress.city,
          state: toAddress.state,
          zip: toAddress.postalCode,
          country: toAddress.country,
          name: `${toAddress.firstName} ${toAddress.lastName}`,
          phone: toAddress.phone
        },
        parcel: {
          weight: parcelDetails.weight,
          length: parcelDetails.length,
          width: parcelDetails.width,
          height: parcelDetails.height
        }
      });

      return shipment.rates.map(rate => ({
        carrier: rate.carrier,
        service: rate.service,
        rate: parseFloat(rate.rate),
        estimatedDays: rate.delivery_days || 0,
        trackingAvailable: true
      }));
    } catch (error: any) {
      throw new Error(`Failed to get shipping rates: ${error.message}`);
    }
  }
}

export const shippingService = new ShippingService();
