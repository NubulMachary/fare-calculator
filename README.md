# 🚗 Fare Calculator

A professional Angular-based **Rent Calculator** application for travel and transportation businesses. Calculate accurate fares with real-time rate analysis and cost breakdown.

## 📋 Features

### Core Calculation Engine
- **Accurate Fare Calculation**: `Total Price = ((Distance ÷ Mileage) × Fuel Price) + Driver Expense + Toll/Extra + Profit`
- Real-time calculation as you input values
- Support for multiple cost components

### 📊 Rate Analysis
- **Cost per km** - Detailed cost breakdown per kilometer
- **Profit per km** - Profit margin per kilometer
- **Profit Margin %** - Percentage profit on costs
- **Liters Required** - Fuel consumption calculation
- **Standard Rate Comparison** - Compare against industry standards
- **Cost Distribution Analysis** - Visual breakdown of all cost components

### 💰 Cost Breakdown
- Fuel cost calculation
- Driver expense tracking
- Toll and extra expenses
- Profit margin management
- Visual progress bars for cost distribution

### 🎯 User Features
- Responsive design (mobile, tablet, desktop)
- 4-column grid layout on desktop
- Beautiful gradient UI with Tailwind CSS
- Real-time calculations
- Reset functionality
- Quick insights panel

## 🛠️ Technology Stack

- **Framework**: Angular 21.2.0
- **Styling**: Tailwind CSS 4.1.12
- **Language**: TypeScript 5.9.2
- **Package Manager**: npm 10.8.2
- **Build Tool**: Vite
- **State Management**: Angular Signals

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (v10 or higher)
- Angular CLI (v21.2.6 or higher)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fare-calculator.git
cd fare-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Navigate to `http://localhost:4300/` in your browser

## 🚀 Usage

### Basic Calculation
1. Enter the **Distance** (in km)
2. Enter **Vehicle Mileage** (km/liter)
3. Enter **Fuel Price** (₹/liter)
4. Add **Driver Expense** (optional)
5. Add **Toll/Extra Expenses** (optional)
6. Set **Profit Margin** (₹)
7. Click **Calculate**

### View Analysis
The calculator automatically displays:
- ✅ Total fare amount
- ✅ Cost per kilometer
- ✅ Profit breakdown
- ✅ Rate comparison
- ✅ Cost distribution

### Reset
Click the **Reset** button to clear all values and start fresh.

## 📁 Project Structure

```
fare-calculator/
├── src/
│   ├── app/
│   │   ├── app.ts                 # Main component with calculation logic
│   │   ├── app.html               # Template with UI
│   │   ├── app.css                # Component styles
│   │   ├── app-module.ts          # App module configuration
│   │   ├── app-routing-module.ts  # Routing configuration
│   │   └── ...
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json                    # Angular configuration
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript configuration
└── README.md
```

## 🔧 Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Building with SSR
```bash
npm run build -- --configuration production
```

### Serve SSR Build
```bash
npm run serve:ssr:calculate-rent
```

## 📊 Component Details

### App Component (`app.ts`)

**Signals (State Management)**:
- Input signals: `distance`, `mileage`, `fuelPrice`, `driverExpense`, `tollExpense`, `profit`
- Output signals: `totalPrice`, `fuelCost`
- Analysis signals: `costPerKm`, `profitMarginPercent`, `profitPerKm`, `costWithoutProfit`, etc.

**Methods**:
- `calculatePrice()` - Performs all calculations
- `resetForm()` - Resets all values to defaults
- `resetAnalytics()` - Clears analysis results

### Key Calculations

```typescript
// Fuel cost
fuelCost = (distance / mileage) × fuelPrice

// Total price
totalPrice = fuelCost + driverExpense + tollExpense + profit

// Cost per km
costPerKm = totalPrice / distance

// Profit margin %
profitMarginPercent = (profit / costWithoutProfit) × 100

// Profit per km
profitPerKm = profit / distance
```

## 🎨 Styling

The application uses **Tailwind CSS** for styling with:
- Gradient backgrounds
- Color-coded components
- Responsive grid layouts
- Smooth animations
- Professional color scheme

## 📱 Responsive Design

- **Mobile** (< 768px): Single column layout
- **Tablet** (768px - 1024px): 2-column layout
- **Desktop** (> 1024px): 4-column layout

## 🐛 Known Issues

None currently reported.

## 📝 Future Enhancements

- [ ] Calculation history
- [ ] Multi-leg journey support
- [ ] PDF export functionality
- [ ] Multiple language support
- [ ] Dark mode theme
- [ ] GPS integration for real distance
- [ ] Real-time fuel price API
- [ ] User authentication & profiles
- [ ] Saved routes
- [ ] SMS/Email quote sharing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💼 Author

**Durga Travellers**
- Website: durgatravellers.com

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Steps to Contribute:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, email support@durgatravellers.com or open an issue on GitHub.

## 🙏 Acknowledgments

- Angular team for the excellent framework
- Tailwind CSS for the styling framework
- The open-source community

---

**Last Updated**: April 3, 2026

⭐ If you find this project helpful, please consider giving it a star!
