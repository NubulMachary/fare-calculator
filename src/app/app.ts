import { Component, signal, OnInit } from '@angular/core';
import { DistanceService } from './services/distance.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App implements OnInit {
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
  showMapModal = signal<boolean>(false);

  constructor(public distanceService: DistanceService) {}

  ngOnInit(): void {
    // Subscribe to distance changes and update the distance input
    // This is handled through the distanceService.calculatedDistance signal
  }

  toNumber(value: number | string): number {
    return Number(value);
  }

  calculatePrice() {
    const dist = Number(this.distance());
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
   * Apply distance from map/route service
   */
  applyDistanceFromMap(): void {
    const mapDistance = this.distanceService.getFinalDistance();
    if (mapDistance > 0) {
      this.distance.set(mapDistance);
      this.showMapModal.set(false);
      this.calculatePrice();
    }
  }

  /**
   * Toggle map modal visibility
   */
  toggleMapModal(): void {
    this.showMapModal.set(!this.showMapModal());
  }
}
