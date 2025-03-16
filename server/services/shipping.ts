import Easypost from "@easypost/api";
import NodeGeocoder from "node-geocoder";
import type { ShippingAddress } from "@shared/schema";

if (!process.env.EASYPOST_API_KEY) {
  throw new Error("Missing required EasyPost API key");
}

const easypost = new Easypost(process.env.EASYPOST_API_KEY);

const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: process.env.GOOGLE_MAPS_API_KEY
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

export class ShippingService {
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
        phone: verifiedAddress.phone
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
