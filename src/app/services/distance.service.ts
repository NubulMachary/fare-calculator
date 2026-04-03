import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distance: number; // in kilometers
  duration: number; // in seconds
  routeGeometry: any; // GeoJSON geometry
}

@Injectable({
  providedIn: 'root'
})
export class DistanceService {
  private readonly API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY'; // Replace with your actual API key
  private readonly BASE_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

  // Signals for tracking route state
  pointA = signal<RouteCoordinates | null>(null);
  pointB = signal<RouteCoordinates | null>(null);
  calculatedDistance = signal<number>(0);
  isRoundTrip = signal<boolean>(false);
  routeGeometry = signal<any>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');

  constructor(private http: HttpClient) {}

  /**
   * Set point A (starting location)
   */
  setPointA(coordinates: RouteCoordinates): void {
    this.pointA.set(coordinates);
  }

  /**
   * Set point B (destination)
   */
  setPointB(coordinates: RouteCoordinates): void {
    this.pointB.set(coordinates);
  }

  /**
   * Toggle round trip option
   */
  toggleRoundTrip(): void {
    this.isRoundTrip.set(!this.isRoundTrip());
  }

  /**
   * Calculate distance between two points using OpenRouteService
   */
  calculateDistance(): Observable<DistanceResult> {
    const pointAData = this.pointA();
    const pointBData = this.pointB();

    if (!pointAData || !pointBData) {
      this.errorMessage.set('Please select both point A and point B');
      return throwError(() => new Error('Both points must be selected'));
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    // Prepare coordinates for OpenRouteService (format: [lng, lat])
    const coordinates = `${pointAData.lng},${pointAData.lat}|${pointBData.lng},${pointBData.lat}`;

    return this.http.get<any>(
      `${this.BASE_URL}?api_key=${this.API_KEY}&coordinates=${coordinates}&geometry=true`
    ).pipe(
      catchError((error) => {
        const errorMsg = error.error?.message || 'Failed to calculate distance';
        this.errorMessage.set(errorMsg);
        this.isLoading.set(false);
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Process the distance result and apply round trip multiplier
   */
  processDistanceResult(result: any): DistanceResult {
    let distance = result.routes[0].summary.distance / 1000; // Convert to km
    const duration = result.routes[0].summary.duration;
    const geometry = result.routes[0].geometry;

    // Apply round trip multiplier if enabled
    if (this.isRoundTrip()) {
      distance *= 2;
    }

    // Store the processed data
    this.calculatedDistance.set(distance);
    this.routeGeometry.set(geometry);
    this.isLoading.set(false);

    return {
      distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
      duration,
      routeGeometry: geometry
    };
  }

  /**
   * Get the final distance (includes round trip multiplier if enabled)
   */
  getFinalDistance(): number {
    return this.calculatedDistance();
  }

  /**
   * Reset all distance calculations
   */
  resetDistance(): void {
    this.pointA.set(null);
    this.pointB.set(null);
    this.calculatedDistance.set(0);
    this.isRoundTrip.set(false);
    this.routeGeometry.set(null);
    this.errorMessage.set('');
  }

  /**
   * Get the multiplier for distance (1x for one-way, 2x for round trip)
   */
  getDistanceMultiplier(): number {
    return this.isRoundTrip() ? 2 : 1;
  }
}
