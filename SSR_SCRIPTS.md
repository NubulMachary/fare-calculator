# 🚀 SSR Scripts Quick Reference

## Available NPM Scripts

### Development (CSR - Client-Side Rendering)

```bash
npm start              # Start dev server on http://localhost:4200-4300
npm run watch         # Build with watch mode for development
```

### Production SSR (Server-Side Rendering)

#### Build SSR

```bash
npm run build:ssr     # Build for production with SSR (default)
npm run build:ssr:dev # Build for development with SSR
```

#### Run SSR Server

```bash
npm run serve:ssr           # Run SSR server on http://localhost:4000
npm run serve:ssr:prod      # Run SSR with production settings (NODE_ENV=production)
npm run serve:ssr:calculate-rent # Original command (still available)
```

#### Build & Run Combined

```bash
npm run start:ssr     # Build production SSR + Run server (recommended)
npm run dev:ssr       # Build development SSR + Run server
```

---

## 📋 Common Use Cases

### For Development

```bash
npm start
# Changes update automatically on http://localhost:4300
```

### For Production Deployment

```bash
npm run start:ssr
# Build optimized & run on http://localhost:4000
```

### For Development with SSR

```bash
npm run dev:ssr
# Build unminified SSR & run on http://localhost:4000
# Useful for debugging
```

### Build Only (Don't Run)

```bash
npm run build:ssr
# Output in: dist/calculate-rent/
```

---

## 🎯 Script Details

| Script | Purpose | Port | Environment |
|--------|---------|------|-------------|
| `npm start` | Dev server with hot reload | 4200/4300 | CSR |
| `npm run build` | Build for production | N/A | CSR |
| `npm run build:ssr` | Build for production SSR | N/A | SSR |
| `npm run build:ssr:dev` | Build for dev SSR | N/A | SSR |
| `npm run serve:ssr` | Run SSR server | 4000 | Default |
| `npm run serve:ssr:prod` | Run SSR production | 4000 | Production |
| `npm run start:ssr` | Build + Run SSR prod | 4000 | Production |
| `npm run dev:ssr` | Build + Run SSR dev | 4000 | Development |

---

## 🔧 Custom Port

To run SSR on a different port:

```bash
PORT=3000 npm run serve:ssr
# Server will run on http://localhost:3000
```

Or modify the serve:ssr:prod script to use your preferred port.

---

## 📊 Build Output

All builds output to:
```
dist/calculate-rent/
├── browser/        (Client-side bundle)
└── server/         (Server-side code)
```

---

## ✅ Verify Scripts Work

```bash
# Test build script
npm run build:ssr

# Test serve script
npm run serve:ssr

# Test combined
npm run start:ssr
```

---

## 🎓 Quick Command Summary

```bash
# Development (CSR)
npm start

# Production (SSR)
npm run start:ssr

# Development with SSR
npm run dev:ssr

# Just build
npm run build:ssr

# Just run (after building)
npm run serve:ssr
```

---

**Last Updated**: April 4, 2026
**Status**: ✅ All SSR scripts ready
