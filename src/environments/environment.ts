// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  // Vite injects env vars as global constants at build time
  // Access the API key that's injected by Vite during the build process
  // Guard against SSR context where window is not defined
  openrouteServiceKey: typeof window !== 'undefined' 
    ? ((window as any).VITE_OPENROUTESERVICE_KEY || (window as any).__VITE_OPENROUTESERVICE_KEY__ || '')
    : ''
};
