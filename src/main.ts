import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

// Note: VITE_OPENROUTESERVICE_KEY is read from .env.local during development
// The service will look for it in window, environment, or localStorage

platformBrowser().bootstrapModule(AppModule, {
  
})
  .catch(err => console.error(err));
