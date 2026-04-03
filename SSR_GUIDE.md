# 🚀 Server-Side Rendering (SSR) Setup Guide

## ✅ Current Status

Your Fare Calculator application **already has SSR enabled and configured**!

### What's Enabled:

- ✅ **SSR Configuration** in `angular.json`
- ✅ **Server Entry Point** (`src/server.ts`)
- ✅ **Server Module** (`app.module.server.ts`)
- ✅ **Express Server** with Angular Node App Engine
- ✅ **Build Configuration** ready for production

---

## 🎯 Building for SSR

### Development SSR Build

```bash
cd /Users/nubulmachary/Documents/work/durgatravellers.com/calculate-rent

# Build for development with SSR
npm run build -- --configuration development

# Start the SSR dev server
node dist/calculate-rent/server/server.mjs
```

Then visit: `http://localhost:4000`

### Production SSR Build

```bash
cd /Users/nubulmachary/Documents/work/durgatravellers.com/calculate-rent

# Build for production with SSR
npm run build

# Start the SSR server
node dist/calculate-rent/server/server.mjs
```

Then visit: `http://localhost:4000`

---

## 📦 Build Output Structure

After building with SSR, you'll have:

```
dist/calculate-rent/
├── browser/                    # Client-side bundle
│   ├── index.html
│   ├── styles.css
│   ├── main.js
│   └── ...
├── server/                     # Server-side bundle
│   ├── server.mjs             # Main server entry
│   ├── main.server.mjs        # Server module
│   └── ...
└── package.json               # Production dependencies
```

---

## 🔧 How SSR Works in This Project

### 1. **Server Entry Point** (`src/server.ts`)

```typescript
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';

// Create Express app
const app = express();
const angularApp = new AngularNodeAppEngine();

// Serve static files from /browser
app.use(express.static(browserDistFolder, { ... }));

// Handle all requests with Angular SSR
app.use((req, res, next) => {
  angularApp.handle(req)
    .then((response) => 
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

// Listen on port 4000 or custom PORT env variable
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
```

### 2. **Server Module** (`app.module.server.ts`)

```typescript
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { AppModule } from './app-module';
import { serverRoutes } from './app.routes.server';

@NgModule({
  imports: [AppModule],
  providers: [provideServerRendering(withRoutes(serverRoutes))],
  bootstrap: [App],
})
export class AppServerModule { }
```

### 3. **Angular Build Configuration**

In `angular.json`:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "outputMode": "server",
      "ssr": {
        "entry": "src/server.ts"
      }
    }
  }
}
```

---

## 🚀 Complete Build & Run Commands

### Quick Build & Run

```bash
#!/bin/bash
cd /Users/nubulmachary/Documents/work/durgatravellers.com/calculate-rent

# Clean previous builds
rm -rf dist

# Build for production with SSR
npm run build

# Run the server
node dist/calculate-rent/server/server.mjs
```

### With Environment Variables

```bash
# Build with custom settings
npm run build -- --configuration production

# Run on custom port
PORT=3000 node dist/calculate-rent/server/server.mjs

# Run with PM2 (production recommended)
npm install -g pm2
pm2 start dist/calculate-rent/server/server.mjs --name "fare-calculator"
```

---

## 📊 Benefits of SSR

### ✅ Performance
- **Faster Initial Load**: Page renders on server before sending to browser
- **Better Time to First Paint**: Content visible immediately
- **Improved Core Web Vitals**: Better LCP, FCP metrics

### ✅ SEO
- **Crawlable Content**: Search engines get fully rendered HTML
- **Meta Tags**: Proper Open Graph tags for social sharing
- **Better Indexing**: All content indexed by Google

### ✅ User Experience
- **No Flash of Unstyled Content**: Fully styled HTML from server
- **Works Without JavaScript**: Content visible even if JS fails
- **Faster Interactions**: Pre-rendered content loads faster

### ✅ Accessibility
- **Better Screen Reader Support**: Fully rendered DOM
- **Progressive Enhancement**: Works with and without JS

---

## 🔍 Debugging SSR

### View Server Logs

```bash
# Run with detailed logging
PORT=4000 node dist/calculate-rent/server/server.mjs

# Or with environment variable
DEBUG=* node dist/calculate-rent/server/server.mjs
```

### Check Build Output

```bash
# List build contents
ls -la dist/calculate-rent/browser/
ls -la dist/calculate-rent/server/

# Check file sizes
du -sh dist/calculate-rent/browser/
du -sh dist/calculate-rent/server/
```

### Test SSR Rendering

```bash
# Curl the page to see server-rendered HTML
curl http://localhost:4000

# Check meta tags
curl http://localhost:4000 | grep -o '<meta[^>]*>'

# View source in browser
# Right-click → View Page Source
# Should see fully rendered HTML, not just script tags
```

---

## 📝 Package.json Scripts

Your `package.json` already includes:

```json
{
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "serve:ssr:calculate-rent": "node dist/calculate-rent/server/server.mjs"
  }
}
```

### Usage:

```bash
# Development CSR (current - port 4200/4300)
npm start

# Production SSR
npm run build
npm run serve:ssr:calculate-rent

# Or combined
npm run build && npm run serve:ssr:calculate-rent
```

---

## 🌐 Deployment Options

### Option 1: Node.js Server (Recommended)

```bash
# Build
npm run build

# Run with PM2
pm2 start dist/calculate-rent/server/server.mjs --name "fare-calculator"

# Monitor
pm2 monit
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 4000
CMD ["node", "dist/calculate-rent/server/server.mjs"]
```

Build and run:

```bash
docker build -t fare-calculator .
docker run -p 4000:4000 fare-calculator
```

### Option 3: Netlify

Already configured in `netlify.toml`:

```bash
# Deploy
npm run build
netlify deploy --prod
```

### Option 4: Vercel

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/calculate-rent"
}
```

---

## 🔐 Environment Variables

Supported environment variables:

```bash
# Port configuration
PORT=3000                    # Change from default 4000

# Node environment
NODE_ENV=production          # Set to production

# PM2 specific
pm_id=0                     # Detected by PM2 automatically
```

---

## 📈 Performance Metrics

With SSR enabled, you should see improvements:

| Metric | Without SSR | With SSR |
|--------|-----------|----------|
| Time to First Byte (TTFB) | ~500ms | ~100-200ms |
| First Contentful Paint (FCP) | ~2s | ~0.5-1s |
| Largest Contentful Paint (LCP) | ~3s | ~1-2s |
| Initial Bundle Size | Browser Bundle | ~30% reduction in JS |

---

## 🆘 Troubleshooting

### Issue: "Cannot find module '@angular/ssr/node'"

**Solution**:
```bash
npm install @angular/ssr@latest
npm run build
```

### Issue: Port 4000 already in use

**Solution**:
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9

# Or use different port
PORT=5000 npm run serve:ssr:calculate-rent
```

### Issue: Build size too large

**Solution**:
```bash
# Build with optimization
npm run build -- --configuration production --optimization

# Check bundle analyzer
ng build --stats-json
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/calculate-rent/browser/stats.json
```

### Issue: SSR not rendering properly

**Solution**:
```bash
# Check browser console for errors
# Check server logs
# Verify DOM is hydrating correctly
curl http://localhost:4000 | head -50
```

---

## 📚 Additional Resources

- [Angular SSR Documentation](https://angular.dev/guide/ssr)
- [Express.js Guide](https://expressjs.com/)
- [Node.js Best Practices](https://nodejs.org/en/docs/)
- [Web Vitals Guide](https://web.dev/vitals/)

---

## ✅ Checklist for SSR Deployment

- [x] SSR configured in angular.json
- [x] Server entry point (server.ts) ready
- [x] Server module (app.module.server.ts) configured
- [x] Build scripts in package.json
- [x] Environment variables documented
- [ ] Build and test locally
- [ ] Deploy to production
- [ ] Monitor performance metrics
- [ ] Setup error logging
- [ ] Configure auto-scaling (if needed)

---

## 🎯 Next Steps

1. **Build locally and test**:
   ```bash
   npm run build
   npm run serve:ssr:calculate-rent
   ```

2. **Visit** `http://localhost:4000`

3. **Check page source** to see server-rendered HTML

4. **Deploy** using your preferred platform

---

**Last Updated**: April 4, 2026

⭐ Your Fare Calculator is SSR-ready!
