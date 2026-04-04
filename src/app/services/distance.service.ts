import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distance: number; // in kilometers
  duration: number; // in seconds
  routeGeometry: any; // GeoJSON geometry
}

export interface GeocodeResult {
  name: string;
  coordinates: RouteCoordinates;
  address?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DistanceService {
  /**
   * Called once by MapComponent.ngAfterViewInit — the only place that uses
   * the API key. No key logic lives in index.html or anywhere outside this
   * service and the environment files.
   */
  ensureApiKeyReady(): void {
    // Nothing to do at runtime; getApiKey() reads directly from environment.ts.
    // This method is kept as an explicit hook so the call-site documents intent.
  }

  /** Read the API key solely from the compiled environment object. */
  private getApiKey(): string {
    if (environment.openrouteServiceKey) {
      return environment.openrouteServiceKey;
    }
    return '';
  }

  private readonly BASE_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
  private readonly GEOCODING_URL = 'https://api.openrouteservice.org/geocode/search';

  // Signals for tracking route state
  pointA = signal<RouteCoordinates | null>(null);
  pointB = signal<RouteCoordinates | null>(null);
  calculatedDistance = signal<number>(0);
  // baseDistance stores the one-way calculated distance (km) before round-trip multiplier
  baseDistance = signal<number>(0);
  // Make round-trip checked by default
  isRoundTrip = signal<boolean>(true);
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
    const newVal = !this.isRoundTrip();
    this.isRoundTrip.set(newVal);

    // If we already have a base distance, update the calculatedDistance immediately
    const base = this.baseDistance();
    if (base && base > 0) {
      const newCalculated = newVal ? base * 2 : base;
      this.calculatedDistance.set(Math.round(newCalculated * 100) / 100);
    }
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

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const keyMsg = 'OpenRouteService API key not configured. Please set openrouteServiceKey in src/environments/environment.ts.';
      this.errorMessage.set(keyMsg);
      return throwError(() => new Error(keyMsg));
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    // Prepare coordinates for OpenRouteService (format: [[lng, lat], [lng, lat]])
    const body = {
      coordinates: [
        [pointAData.lng, pointAData.lat],
        [pointBData.lng, pointBData.lat]
      ],
      instructions: false,
      geometry: true
    };

    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    };

    // Use POST with Authorization header (recommended by OpenRouteService)
    return this.http.post<any>(
      `${this.BASE_URL}`,
      body,
      { headers }
    ).pipe(
      catchError((error) => {
        console.error('Distance API error:', error);
        const errorMsg = error?.error?.error || error?.error?.message || error.statusText || 'Failed to calculate distance';
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
    let distance = result.routes[0].summary.distance / 1000; // Convert to km (one-way)
    const duration = result.routes[0].summary.duration;
    const geometry = result.routes[0].geometry;
    // Store base (one-way) distance and apply multiplier for displayed value
    this.baseDistance.set(distance);
    const displayed = this.isRoundTrip() ? distance * 2 : distance;
    this.calculatedDistance.set(Math.round(displayed * 100) / 100);
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
   * Search for locations by address/name (geocoding)
   */
  searchLocations(query: string): Observable<GeocodeResult[]> {
    if (!query || query.trim().length < 2) {
      return throwError(() => new Error('Search query too short'));
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const keyMsg = 'OpenRouteService API key not configured. Please set openrouteServiceKey in src/environments/environment.ts.';
      this.errorMessage.set(keyMsg);
      return throwError(() => new Error(keyMsg));
    }

    const headers = { 'Authorization': apiKey };
    return this.http.get<any>(
      `${this.GEOCODING_URL}?text=${encodeURIComponent(query)}`,
      { headers }
    ).pipe(
      catchError((error) => {
        const errorMsg = error?.error?.error || error?.error?.message || error.statusText || 'Failed to search locations';
        console.error('Geocoding error:', error);
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Get the multiplier for distance (1x for one-way, 2x for round trip)
   */
  getDistanceMultiplier(): number {
    return this.isRoundTrip() ? 2 : 1;
  }

  /**
   * Calculate distance between two explicit coordinates WITHOUT touching shared signals.
   * Returns raw one-way distance in km so the caller can manage its own state.
   */
  calculateDistanceFor(
    origin: RouteCoordinates,
    destination: RouteCoordinates
  ): Observable<{ distanceKm: number; duration: number }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const keyMsg =
        'OpenRouteService API key not configured. Please set openrouteServiceKey in src/environments/environment.ts.';
      return throwError(() => new Error(keyMsg));
    }

    const body = {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat]
      ],
      instructions: false,
      geometry: true
    };

    const headers = {
      Authorization: apiKey,
      'Content-Type': 'application/json'
    };

    return this.http
      .post<any>(this.BASE_URL, body, { headers })
      .pipe(
        map((result) => ({
          distanceKm: Math.round((result.routes[0].summary.distance / 1000) * 100) / 100,
          duration: result.routes[0].summary.duration
        })),
        catchError((error) => {
          const errorMsg =
            error?.error?.error ||
            error?.error?.message ||
            error.statusText ||
            'Failed to calculate distance';
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  /**
   * Search for locations without affecting shared signals.
   */
  searchLocationsClean(query: string): Observable<GeocodeResult[]> {
    return this.searchLocations(query);
  }
}
