// AGMC pre-owned platform — business config + inventory. Edit freely; Wazir (the AI advisor) reads everything from here.
window.CONFIG = {
  brand: "AGMC",
  advisor: "Wazir",
  currency: "AED",
  depositAmount: 3000,               // refundable reservation deposit
  defaultApr: 4.25,
  hours: { open: 9, close: 20 },     // hourly test-drive slots (showroom open 9AM-8PM)
  location: "Sheikh Zayed Road, Al Quoz 1, Dubai",
  contact: { phone: "800AGMC", phoneHref: "tel:800AGMC", whatsapp: "+971 4 339 1555", whatsappHref: "https://wa.me/97143391555", email: "info@agmc.com" },   // from agmc.com — confirm before launch
  locations: [   // shown in the footer
    { name: "AGMC HQ — Sheikh Zayed Road", addr: "Al Quoz 1, Dubai", hours: "Open daily 9AM–8PM" },
    { name: "AGMC Dubai Motor City", addr: "Dubai Motor City, Dubai", hours: "Sales & service" },
    { name: "AGMC Sharjah", addr: "Sharjah, UAE", hours: "Sales & service" },
  ],
  allLocationsUrl: "https://www.agmc.com/en/contact",
  social: { linkedin: "https://www.linkedin.com/company/agmc/", instagram: "#", facebook: "#", youtube: "#", x: "#" },   // only LinkedIn is confirmed; replace the # placeholders
  popular: ["AG-101", "AG-104", "AG-122", "AG-116"],   // "Popular right now" in the footer
  model: "qwen2.5:3b",               // local Ollama model
  showPhotoCredits: false,           // set true to show photographer credits (required for the Wikimedia photos once the site is public)
  autoOpenCar: true,                 // Wazir opens the car page when it recommends one
};

/* car(id, make, model, year, price, km, body, fuel, seats, colourName, colourHex, hp, nm, engine, drivetrain, accel0to100, topSpeed,
       consumption, bootLitres, interior, owners, features[], blurb)   — all cars are pre-owned. */
const car = (id, make, model, year, price, km, body, fuel, seats, colorName, color, power, torque, engine, drive, accel, top, cons, boot, interior, owners, features, blurb) => ({
  id, make, model, year, price, mileage: km, body, fuel, seats, colorName, color, power, torque, engine, drive, accel, top, cons, boot, interior, owners, features, blurb,
  condition: "Used", transmission: fuel === "Electric" ? "Single-speed" : "Automatic", doors: body === "Coupe" ? 2 : body === "Hatchback" ? 5 : body === "Van" ? 5 : 4,
  spec: "GCC specs", accident: "Accident-free", service: owners === 1 ? "Full dealer service history" : "Full service history",
});

window.CARS = [
  car("AG-101", "Toyota", "Land Cruiser GXR", 2018, 189000, 92000, "SUV", "Petrol", 8, "Pearl White", "#ecebe6", 275, 385, "4.0L V6", "4WD", 9.3, 180, "14.9 L/100 km", 550, "Beige leather", 2, ["Eight seats", "Multi-terrain select", "Cool box", "Rear entertainment"], "The desert-proven full-size SUV, with seating for eight and legendary durability."),
  car("AG-102", "Toyota", "Camry Hybrid", 2020, 74500, 52000, "Sedan", "Hybrid", 5, "Bronze Metallic", "#5a463a", 215, 221, "2.5L hybrid", "FWD", 8.3, 180, "4.5 L/100 km", 524, "Black leather", 1, ["Hybrid economy", "Lane departure alert", "Wireless charging", "Power seats"], "Quiet, spacious and remarkably frugal — the sensible executive sedan."),
  car("AG-103", "Toyota", "RAV4 Hybrid XSE", 2021, 98500, 33000, "SUV", "Hybrid", 5, "Pearl White / Red roof", "#efeeea", 219, 221, "2.5L hybrid", "AWD", 8.1, 180, "4.9 L/100 km", 580, "Black fabric / leather", 1, ["Hybrid AWD", "Toyota Safety Sense", "Power tailgate", "Apple CarPlay"], "Efficient family SUV with all-wheel drive and a two-tone sporty look."),
  car("AG-104", "Nissan", "Patrol Desert Edition", 2018, 135000, 76000, "SUV", "Petrol", 8, "Pearl White", "#f2f2ef", 400, 560, "5.6L V8", "4WD", 6.9, 210, "15.9 L/100 km", 550, "Charcoal leather", 2, ["5.6L V8", "Eight seats", "Around-view monitor", "Tow package"], "The Gulf favourite: a V8-powered, dune-ready SUV built for the whole family."),
  car("AG-105", "Honda", "Civic RS", 2018, 54500, 62000, "Sedan", "Petrol", 5, "Rallye Red", "#b3262d", 174, 220, "1.5L turbo", "FWD", 8.2, 200, "6.4 L/100 km", 430, "Black fabric", 1, ["Sunroof", "Honda Sensing", "Sport bodykit", "Apple CarPlay"], "Sharp styling and a punchy turbo engine in an affordable, reliable package."),
  car("AG-106", "Mazda", "CX-5 GT", 2022, 89900, 29000, "SUV", "Petrol", 5, "Deep Crystal Blue", "#1e2a44", 187, 252, "2.5L", "AWD", 9.0, 197, "7.8 L/100 km", 506, "Black leather", 1, ["Bose audio", "Head-up display", "Heated seats", "i-Activsense safety"], "The driver's pick of the compact SUVs, with a premium cabin."),
  car("AG-107", "Hyundai", "Tucson Limited", 2022, 79900, 33000, "SUV", "Petrol", 5, "Polar White", "#f1f1ee", 187, 246, "2.5L", "AWD", 9.4, 200, "8.4 L/100 km", 620, "Black leather", 1, ["Panoramic roof", "Blind-spot monitor", "Ventilated seats", "Digital cluster"], "Bold, tech-packed and generous on space for the price."),
  car("AG-108", "Kia", "Carnival SXL", 2023, 126000, 24000, "Van", "Petrol", 8, "Ebony Black", "#16181a", 290, 355, "3.5L V6", "FWD", 8.4, 200, "10.1 L/100 km", 627, "Two-tone leather", 1, ["Power sliding doors", "Eight seats", "Dual sunroof", "Captain chairs"], "Seats the whole family in comfort — and their luggage."),
  car("AG-109", "Mercedes-Benz", "C 300 AMG Line", 2022, 178000, 28000, "Sedan", "Petrol", 5, "Polar White", "#f3f3f1", 258, 400, "2.0L turbo + 48V", "AWD", 6.0, 250, "6.7 L/100 km", 455, "Black leather", 1, ["MBUX with 11.9\" screen", "Burmester sound", "Ambient lighting", "Digital cockpit"], "A technology-rich, beautifully finished compact luxury sedan."),
  car("AG-110", "Mercedes-Benz", "GLE 450 4MATIC", 2020, 228000, 52000, "SUV", "Hybrid", 5, "Iridium Silver", "#b6b8bb", 367, 500, "3.0L I6 + EQ Boost", "AWD", 5.7, 250, "9.4 L/100 km", 630, "Black leather", 1, ["Air suspension", "Panoramic roof", "Burmester sound", "360° camera"], "Smooth six-cylinder power and a lavish cabin in a very capable SUV."),
  car("AG-111", "Audi", "A4 40 TFSI", 2021, 105000, 38000, "Sedan", "Petrol", 5, "Florett Silver", "#c3c6c9", 190, 320, "2.0L turbo", "FWD", 7.3, 241, "6.1 L/100 km", 460, "Black leather", 1, ["Virtual Cockpit", "MMI navigation", "LED headlights", "Parking assist"], "Refined and understated, with a superbly built interior."),
  car("AG-112", "Audi", "Q7 55 TFSI", 2018, 149000, 82000, "SUV", "Petrol", 7, "Glacier White", "#eceeee", 340, 500, "3.0L V6 TFSI", "AWD", 5.9, 250, "9.2 L/100 km", 770, "Brown leather", 2, ["Seven seats", "Air suspension", "Bang & Olufsen audio", "Head-up display"], "Spacious seven-seat luxury with surprising performance."),
  car("AG-113", "Lexus", "RX 350 F Sport", 2017, 109000, 78000, "SUV", "Petrol", 5, "Matador Red", "#8c1c26", 295, 362, "3.5L V6", "AWD", 8.0, 200, "10.7 L/100 km", 553, "Black leather", 2, ["F Sport package", "Mark Levinson audio", "Adaptive suspension", "Head-up display"], "Whisper-quiet luxury with a reputation for reliability."),
  car("AG-114", "Porsche", "Macan S", 2016, 149000, 91000, "SUV", "Petrol", 5, "Jet Black", "#14151a", 340, 460, "3.0L V6 twin-turbo", "AWD", 5.4, 254, "9.8 L/100 km", 500, "Black leather", 2, ["Sport Chrono", "PASM suspension", "Bose surround", "Panoramic roof"], "Sports-car handling in a practical SUV body."),
  car("AG-115", "Land Rover", "Range Rover Sport SVR", 2017, 215000, 64000, "SUV", "Petrol", 5, "Estoril Blue", "#1c2a8a", 550, 680, "5.0L supercharged V8", "AWD", 4.7, 280, "12.8 L/100 km", 780, "Ebony leather", 2, ["Supercharged V8", "Meridian audio", "Terrain Response 2", "Carbon-fibre trim"], "A thunderous V8 super-SUV with proper Range Rover presence."),
  car("AG-116", "Tesla", "Model 3 Long Range", 2019, 108000, 52000, "Sedan", "Electric", 5, "Pearl White", "#f4f4f4", 346, 510, "Dual motor", "AWD", 4.4, 233, "16 kWh/100 km", 425, "Black premium", 1, ["Autopilot", "Glass roof", "OTA updates", "560 km range"], "Quick, quiet and almost no running costs."),
  car("AG-117", "Ford", "Mustang GT", 2017, 92000, 56000, "Coupe", "Petrol", 4, "Grabber Blue", "#1f8fd1", 435, 542, "5.0L V8", "RWD", 4.3, 250, "13.4 L/100 km", 408, "Black leather", 2, ["5.0L V8", "Brembo option", "Launch control", "Digital cluster"], "Pure American V8 muscle for weekend thrills."),
  car("AG-118", "Jeep", "Wrangler Rubicon", 2020, 139000, 41000, "SUV", "Petrol", 5, "Hella Yella", "#e9d12a", 285, 353, "3.6L V6", "4WD", 7.8, 177, "12.9 L/100 km", 548, "Black leather", 1, ["Rock-Trac 4x4", "Locking diffs", "Removable roof", "Alpine audio"], "The ultimate off-roader, ready for the dunes."),
  car("AG-119", "BMW", "320i M Sport", 2021, 119000, 54000, "Sedan", "Petrol", 5, "Black Sapphire", "#1b1d20", 184, 300, "2.0L turbo", "RWD", 7.4, 235, "6.5 L/100 km", 480, "Cognac leather", 1, ["M Sport package", "Live Cockpit", "Parking assist", "Wireless charging"], "One owner, fully serviced — the smart way into the 3 Series."),
  car("AG-120", "BMW", "530i M Sport", 2022, 189000, 38000, "Sedan", "Petrol", 5, "Black Sapphire", "#1b1d20", 252, 350, "2.0L turbo", "RWD", 6.2, 250, "6.7 L/100 km", 530, "Black leather", 1, ["Adaptive suspension", "Harman Kardon", "Head-up display", "Comfort seats"], "Executive comfort and genuine driver appeal, two years young."),
  car("AG-121", "BMW", "X5 xDrive40i", 2019, 209000, 71000, "SUV", "Petrol", 5, "Mineral White", "#dcdddf", 340, 450, "3.0L I6 turbo", "AWD", 5.5, 250, "8.9 L/100 km", 650, "Mocha leather", 2, ["Panoramic Sky Lounge", "Heated seats", "360° camera", "Gesture control"], "The family-sized luxury SUV at a gentler price."),
  car("AG-122", "BMW", "M3 Competition", 2021, 289000, 33000, "Sedan", "Petrol", 5, "Java Green", "#5fae2b", 510, 650, "3.0L I6 twin-turbo", "RWD", 3.9, 290, "10.2 L/100 km", 480, "Black Merino leather", 1, ["M Carbon bucket seats", "M Drive Professional", "Carbon roof", "M Compound brakes"], "A true super-sedan: shattering pace, entirely usable every day."),
  car("AG-123", "Volkswagen", "Golf GTI", 2019, 79000, 49000, "Hatchback", "Petrol", 5, "Pure White", "#f4f4f2", 245, 370, "2.0L turbo", "FWD", 6.2, 250, "7.0 L/100 km", 380, "Tartan cloth", 1, ["DSG gearbox", "Adaptive dampers", "Digital cockpit", "Sport seats"], "The original hot hatch — fast, practical and fun every day."),
  car("AG-124", "Toyota", "Corolla Hybrid", 2020, 62500, 41000, "Sedan", "Hybrid", 5, "Celestite Grey", "#7f93a8", 122, 142, "1.8L hybrid", "FWD", 10.9, 180, "3.8 L/100 km", 471, "Black fabric", 1, ["Hybrid economy", "Toyota Safety Sense", "Reverse camera", "Smart entry"], "Bulletproof reliability and tiny fuel bills."),
].map((c, i) => {
  // derived, demo-only fields: market reference price (drives the price rating), warranty and inspection result
  const f = [1.06, 1.02, 1.09, 1.04, 0.99, 1.07, 1.03, 1.05, 1.08, 1.01, 1.06, 1.04, 1.1, 1.02, 1.05, 1.07, 0.98, 1.06, 1.03, 1.05, 1.09, 1.02, 1.04, 1.07][i % 24];
  const age = 2026 - c.year;
  return { ...c, market: Math.round((c.price * f) / 500) * 500, warranty: age <= 5 && c.mileage <= 80000 ? "12 months / 20,000 km" : "6 months / 10,000 km", inspection: 146 + (i % 5) };
});
