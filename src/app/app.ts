import { Component, signal, OnInit } from '@angular/core';
import { DistanceService } from './services/distance.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App implements OnInit {
  // Per-stop map state: array of { origin, destination, distance, isRoundTrip, pointA, pointB }
  mapStates = signal<Array<{ origin: any, destination: any, distance: number, isRoundTrip?: boolean, pointA?: { lat: number; lng: number } | null, pointB?: { lat: number; lng: number } | null }>>([]);
  // Map state for the main (single) distance input
  mainMapState = signal<{ origin: any, destination: any, distance: number, isRoundTrip?: boolean, pointA?: { lat: number; lng: number } | null, pointB?: { lat: number; lng: number } | null } | null>(null);
  // Input signals
  distance = signal<number | string>('');
  mileage = signal<number | string>(7);
  fuelPrice = signal<number | string>(90);
  driverExpense = signal<number | string>(1000);
  tollExpense = signal<number | string>('');
  profit = signal<number | string>(5000);
  // New: total booking days (defaults to 1)
  bookingDays = signal<number | string>(1);

  // Output signals - Price Calculation
  totalPrice = signal<number>(0);
  fuelCost = signal<number>(0);

  // Rate Analysis signals
  costPerKm = signal<number>(0);
  profitMarginPercent = signal<number>(0);
  profitPerKm = signal<number>(0);
  costWithoutProfit = signal<number>(0);
  standardRate = signal<number>(30); // Standard rate per km (can be adjusted)
  costVsStandard = signal<number>(0);
  isAboveStandard = signal<boolean>(false);

  // Vehicle efficiency signals
  literRequired = signal<number>(0);
  costPerLiter = signal<number>(0);

  // Map and Distance service
  // Map modal: when null, modal is closed. When set to -1, it means "single distance";
  // when set to >=0 it points to the stop index the modal will populate.
  showMapModal = signal<number | null>(null);

  // Dynamic stops (multiple distance entries). Each stop can be filled via the map.
  stops = signal<Array<{ id: number; distance: number | string }>>([]);
  private nextStopId = 1;



  // Summary popup
  showSummary = signal<boolean>(false);

  /** Build a structured summary object consumed by the popup template. */
  summaryData() {
    const days = Math.max(1, Number(this.bookingDays()) || 1);
    const mileage = Number(this.mileage()) || 0;
    const fuelPrice = Number(this.fuelPrice()) || 0;
    const driverExp = Number(this.driverExpense()) || 0;
    const tollExp = Number(this.tollExpense()) || 0;
    const profitPerDay = Number(this.profit()) || 0;

    // ── Route legs ──────────────────────────────────────────────────────────
    const mainDist = Number(this.distance()) || 0;
    const mainState = this.mainMapState();
    const legs: Array<{
      label: string;
      from: string; fromCoords: string;
      to: string;   toCoords: string;
      distanceKm: number;
      isRoundTrip: boolean;
      baseKm: number;
    }> = [];

    if (mainDist > 0) {
      const rt = mainState?.isRoundTrip ?? false;
      legs.push({
        label: 'Main Distance',
        from: mainState?.origin || '—',
        fromCoords: mainState?.pointA
          ? `${mainState.pointA.lat.toFixed(4)}, ${mainState.pointA.lng.toFixed(4)}` : '',
        to: mainState?.destination || '—',
        toCoords: mainState?.pointB
          ? `${mainState.pointB.lat.toFixed(4)}, ${mainState.pointB.lng.toFixed(4)}` : '',
        distanceKm: mainDist,
        isRoundTrip: rt,
        baseKm: rt ? mainDist / 2 : mainDist,
      });
    }

    this.stops().forEach((stop, i) => {
      const dist = Number(stop.distance) || 0;
      if (dist <= 0) return;
      const ms = this.mapStates()[i];
      const rt = ms?.isRoundTrip ?? false;
      legs.push({
        label: `Stop ${i + 1}`,
        from: ms?.origin || '—',
        fromCoords: ms?.pointA
          ? `${ms.pointA.lat.toFixed(4)}, ${ms.pointA.lng.toFixed(4)}` : '',
        to: ms?.destination || '—',
        toCoords: ms?.pointB
          ? `${ms.pointB.lat.toFixed(4)}, ${ms.pointB.lng.toFixed(4)}` : '',
        distanceKm: dist,
        isRoundTrip: rt,
        baseKm: rt ? dist / 2 : dist,
      });
    });

    const totalKm = legs.reduce((s, l) => s + l.distanceKm, 0);

    // ── Cost breakdown ──────────────────────────────────────────────────────
    const litersNeeded = mileage > 0 ? totalKm / mileage : 0;
    const fuelTotal = litersNeeded * fuelPrice;
    const driverTotal = driverExp * days;
    const tollTotal = tollExp;
    const profitTotal = profitPerDay * days;
    const costWithoutProfit = fuelTotal + driverTotal + tollTotal;
    const grandTotal = costWithoutProfit + profitTotal;

    return {
      legs,
      totalKm,
      mileage,
      fuelPrice,
      litersNeeded,
      fuelTotal,
      driverExp,
      driverTotal,
      days,
      tollTotal,
      profitPerDay,
      profitTotal,
      costWithoutProfit,
      grandTotal,
      costPerKm: totalKm > 0 ? grandTotal / totalKm : 0,
    };
  }

  onMapStateChange(newState: { origin: any, destination: any, distance: number, isRoundTrip?: boolean, pointA?: { lat: number; lng: number } | null, pointB?: { lat: number; lng: number } | null }) {
    const idx = this.showMapModal();
    if (idx === -1) {
      // Main distance input map
      this.mainMapState.set(newState);
    } else if (typeof idx === 'number' && idx >= 0) {
      const arr = this.mapStates();
      arr[idx] = newState;
      this.mapStates.set(arr);
    }
  }

  getCurrentMapState() {
    const idx = this.showMapModal();
    if (idx === -1) {
      return this.mainMapState();
    }
    const arr = this.mapStates ? (this.mapStates() || []) : [];
    if (arr && typeof idx === 'number' && idx >= 0 && idx < arr.length) {
      return arr[idx];
    }
    return null;
  }

  ngOnInit(): void {
    // Subscribe to distance changes and update the distance input
    // This is handled through the distanceService.calculatedDistance signal
  }

  // Add a new stop (distance entry) and recalculate totals
  addStop(): void {
    // Mutate the array in place to avoid input focus loss
    const arr = this.stops();
    arr.push({ id: this.nextStopId++, distance: '' });
    this.stops.set(arr);
    // Add a blank map state for this stop
    const mapArr = this.mapStates();
    mapArr.push({ origin: null, destination: null, distance: 0 });
    this.mapStates.set(mapArr);
    this.calculatePrice();
  }

  // Remove a stop by index
  removeStop(index: number): void {
    const arr = [...this.stops()];
    if (index < 0 || index >= arr.length) return;
    arr.splice(index, 1);
    this.stops.set(arr);
    // Remove the corresponding map state
    const mapArr = this.mapStates();
    mapArr.splice(index, 1);
    this.mapStates.set(mapArr);
    // Recalculate after removal
    this.calculatePrice();
  }

  // Update stop distance (called from template ngModelChange)
  updateStopDistance(index: number, value: number | string): void {
    // Mutate the array in place to avoid input focus loss
    const arr = this.stops();
    if (index < 0 || index >= arr.length) return;
    arr[index].distance = value;
    this.stops.set(arr);
    this.calculatePrice();
  }

  toNumber(value: number | string): number {
    return Number(value);
  }

  // Return the effective total distance: always include the main distance input plus the sum of all stop distances
  totalDistance(): number {
    const stops = this.stops();
    const stopsSum = stops.reduce((s, l) => s + (Number(l.distance) || 0), 0);
    return (Number(this.distance()) || 0) + stopsSum;
  }

  calculatePrice() {
    // Use totalDistance() so that if stops are present, their sum is used; otherwise, the single distance input
    const dist = this.totalDistance();
    const mileage = Number(this.mileage());
    const fuelPrice = Number(this.fuelPrice());
    const driverExp = Number(this.driverExpense());
    const tollExp = Number(this.tollExpense());
    const profitMargin = Number(this.profit());
    const days = Math.max(1, Number(this.bookingDays()) || 1);

    // Validate inputs
    if (mileage === 0 || dist === 0 || isNaN(dist) || isNaN(mileage) || isNaN(fuelPrice)) {
      this.totalPrice.set(0);
      this.resetAnalytics();
      return;
    }

    // Calculate fuel cost based on the trip distance (distance does NOT change with booking days)
    const fuelCostValue = (dist / mileage) * fuelPrice;
    this.fuelCost.set(Math.round(fuelCostValue * 100) / 100);

    // Calculate totals where only driver and profit are considered per-day
    // Toll is considered a one-time per-trip expense and does NOT scale with days
    const driverTotal = driverExp * days;
    const tollTotal = tollExp; // per trip
    const profitTotal = profitMargin * days;

    // Total cost without profit: fuel cost (single trip) + per-day driver/toll totals
    const costWithoutProfitValue = fuelCostValue + driverTotal + tollTotal;
    this.costWithoutProfit.set(Math.round(costWithoutProfitValue * 100) / 100);

    // Total price for the booking: aggregated cost + aggregated profit
    const total = costWithoutProfitValue + profitTotal;
    this.totalPrice.set(Math.round(total * 100) / 100);

    // === RATE ANALYSIS CALCULATIONS ===

    // Cost per km (aggregated across the booking)
    const costPerKmValue = dist > 0 ? total / dist : 0;
    this.costPerKm.set(Math.round(costPerKmValue * 100) / 100);

    // Profit per km (total profit across booking divided by distance)
    const profitPerKmValue = dist > 0 ? profitTotal / dist : 0;
    this.profitPerKm.set(Math.round(profitPerKmValue * 100) / 100);

    // Profit margin percentage (based on aggregated values)
    const profitPercentValue = costWithoutProfitValue > 0 ? (profitTotal / costWithoutProfitValue) * 100 : 0;
    this.profitMarginPercent.set(Math.round(profitPercentValue * 100) / 100);

    // Cost per liter used (based on the trip distance; distance does not change with days)
    const literRequiredValue = dist / mileage;
    this.literRequired.set(Math.round(literRequiredValue * 100) / 100);
    const costPerLiterValue = literRequiredValue > 0 ? fuelCostValue / literRequiredValue : 0;
    this.costPerLiter.set(Math.round(costPerLiterValue * 100) / 100);

    // Compare with standard rate
    const standardCost = dist * this.standardRate();
    this.costVsStandard.set(Math.round((total - standardCost) * 100) / 100);
    this.isAboveStandard.set(total > standardCost);
  }

  resetAnalytics() {
    this.costPerKm.set(0);
    this.profitMarginPercent.set(0);
    this.profitPerKm.set(0);
    this.costWithoutProfit.set(0);
    this.costVsStandard.set(0);
    this.literRequired.set(0);
    this.costPerLiter.set(0);
    this.fuelCost.set(0);
  }

  resetForm() {
    this.distance.set('');
    this.mileage.set('');
    this.fuelPrice.set('');
    this.driverExpense.set('');
    this.tollExpense.set('');
    this.profit.set('');
    this.bookingDays.set(1);
    this.totalPrice.set(0);
    this.resetAnalytics();
  }

  /**
   * Apply distance from the map component's emitted state.
   * Reads from mapStates (populated via onMapStateChange) — never from the
   * shared DistanceService signals, so each map instance stays isolated.
   */
  applyDistanceFromMap(): void {
    const active = this.showMapModal();
    if (active === null) return;

    let mapDistance = 0;
    if (active === -1) {
      // single distance input: use the special index -1 slot (stored at index 0 of a separate ref)
      // We store the main-distance map state at index 0 of a dedicated signal
      mapDistance = this.mainMapState()?.distance ?? 0;
    } else {
      mapDistance = this.mapStates()[active]?.distance ?? 0;
    }

    if (mapDistance > 0) {
      if (active === -1) {
        this.distance.set(mapDistance);
      } else {
        const arr = this.stops();
        if (active >= 0 && active < arr.length) {
          arr[active].distance = mapDistance;
          this.stops.set(arr);
        }
      }
      this.showMapModal.set(null);
      this.calculatePrice();
    }
  }

  /**
   * Toggle map modal visibility
   */
  toggleMapModal(): void {
    // Deprecated single-toggle: close modal
    this.showMapModal.set(null);
  }

  // Open the map modal for a given stop index, or for the single distance input when index is null
  openMapFor(index: number | null): void {
    // Use -1 to represent the single distance input so that `null` remains the closed state.
    if (index === null) {
      this.showMapModal.set(-1);
    } else {
      this.showMapModal.set(index);
    }
  }
}
