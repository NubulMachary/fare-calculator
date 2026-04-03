import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  // Input signals
  distance = signal<number | string>('');
  mileage = signal<number | string>('');
  fuelPrice = signal<number | string>('');
  driverExpense = signal<number | string>('');
  tollExpense = signal<number | string>('');
  profit = signal<number | string>('');

  // Output signals - Price Calculation
  totalPrice = signal<number>(0);
  fuelCost = signal<number>(0);

  // Rate Analysis signals
  costPerKm = signal<number>(0);
  profitMarginPercent = signal<number>(0);
  profitPerKm = signal<number>(0);
  costWithoutProfit = signal<number>(0);
  standardRate = signal<number>(15); // Standard rate per km (can be adjusted)
  costVsStandard = signal<number>(0);
  isAboveStandard = signal<boolean>(false);

  // Vehicle efficiency signals
  literRequired = signal<number>(0);
  costPerLiter = signal<number>(0);

  constructor() {
    // Auto-calculate when any input changes
  }

  calculatePrice() {
    const dist = Number(this.distance());
    const mileage = Number(this.mileage());
    const fuelPrice = Number(this.fuelPrice());
    const driverExp = Number(this.driverExpense());
    const tollExp = Number(this.tollExpense());
    const profitMargin = Number(this.profit());

    // Validate inputs
    if (mileage === 0 || dist === 0 || isNaN(dist) || isNaN(mileage) || isNaN(fuelPrice)) {
      this.totalPrice.set(0);
      this.resetAnalytics();
      return;
    }

    // Calculate fuel cost
    const fuelCostValue = (dist / mileage) * fuelPrice;
    this.fuelCost.set(Math.round(fuelCostValue * 100) / 100);

    // Calculate total cost without profit
    const costWithoutProfitValue = fuelCostValue + driverExp + tollExp;
    this.costWithoutProfit.set(Math.round(costWithoutProfitValue * 100) / 100);

    // Calculate total price with profit
    const total = costWithoutProfitValue + profitMargin;
    this.totalPrice.set(Math.round(total * 100) / 100);

    // === RATE ANALYSIS CALCULATIONS ===

    // Cost per km
    const costPerKmValue = total / dist;
    this.costPerKm.set(Math.round(costPerKmValue * 100) / 100);

    // Profit per km
    const profitPerKmValue = profitMargin / dist;
    this.profitPerKm.set(Math.round(profitPerKmValue * 100) / 100);

    // Profit margin percentage
    const profitPercentValue = (profitMargin / costWithoutProfitValue) * 100;
    this.profitMarginPercent.set(Math.round(profitPercentValue * 100) / 100);

    // Cost per liter used
    const literRequiredValue = dist / mileage;
    this.literRequired.set(Math.round(literRequiredValue * 100) / 100);
    const costPerLiterValue = fuelCostValue / literRequiredValue;
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
    this.totalPrice.set(0);
    this.resetAnalytics();
  }
}
