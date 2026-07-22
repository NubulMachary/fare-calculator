/** Shared contract with booking app (keep in sync with booking fare-quote.model.ts). */

export const FARE_QUOTE_MESSAGE_APPLY = 'durga-travellers/fare-quote-apply' as const;
export const FARE_QUOTE_MESSAGE_READY = 'durga-travellers/fare-quote-ready' as const;
export const FARE_QUOTE_MESSAGE_PREFILL = 'durga-travellers/fare-quote-prefill' as const;

export interface FareQuoteMapPoint {
  lat: number;
  lng: number;
}

export interface FareQuoteMapLegState {
  origin: string | null;
  destination: string | null;
  distance: number;
  isRoundTrip?: boolean;
  pointA?: FareQuoteMapPoint | null;
  pointB?: FareQuoteMapPoint | null;
}

export interface FareQuoteStop {
  id: number;
  distance: number | string;
}

export interface FareQuoteLegSummary {
  label: string;
  from: string;
  fromCoords: string;
  to: string;
  toCoords: string;
  distanceKm: number;
  isRoundTrip: boolean;
  baseKm: number;
}

export interface FareQuoteSummary {
  legs: FareQuoteLegSummary[];
  totalKm: number;
  mileage: number;
  fuelPrice: number;
  litersNeeded: number;
  fuelTotal: number;
  driverExp: number;
  driverTotal: number;
  days: number;
  tollTotal: number;
  profitPerDay: number;
  profitTotal: number;
  costWithoutProfit: number;
  grandTotal: number;
  costPerKm: number;
}

export interface FareQuotePayload {
  version: 1;
  inputs: {
    distance: number | string;
    mileage: number | string;
    fuelPrice: number | string;
    driverExpense: number | string;
    tollExpense: number | string;
    profit: number | string;
    bookingDays: number | string;
    stops: FareQuoteStop[];
    mainMapState: FareQuoteMapLegState | null;
    mapStates: FareQuoteMapLegState[];
  };
  summary: FareQuoteSummary;
  appliedAt?: string;
}

export interface FareQuoteSessionPrefill {
  destination?: string;
  bookingDays?: number;
  payload?: FareQuotePayload;
}

export interface FareQuoteApplyMessage {
  type: typeof FARE_QUOTE_MESSAGE_APPLY;
  sessionId: string;
  payload: FareQuotePayload;
}

export interface FareQuoteReadyMessage {
  type: typeof FARE_QUOTE_MESSAGE_READY;
  sessionId: string;
}

export interface FareQuotePrefillMessage {
  type: typeof FARE_QUOTE_MESSAGE_PREFILL;
  sessionId: string;
  prefill: FareQuoteSessionPrefill;
}
