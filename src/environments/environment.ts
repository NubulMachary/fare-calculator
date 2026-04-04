// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  // Vite injects env vars as global constants at build time
  // Access the API key that's injected by Vite during the build process
  // Guard against SSR context where window is not defined
  openrouteServiceKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjI4ZTQxZTEyYTRhZDQ3NzY4MDIzMjhmNzNjZGQ1YzQyIiwiaCI6Im11cm11cjY0In0='
};
