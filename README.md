# Home Energy System

A full-stack home energy management dashboard built with HTML, CSS, JavaScript, Node.js, Express, Socket.io, and MongoDB.

## Features
- JWT authentication (register / login)
- Live energy readings via WebSockets
- Real-time dashboard with Chart.js charts
- MongoDB aggregation for daily totals, peak hours, solar vs grid breakdown
- 7-day moving average energy prediction
- Configurable alert thresholds (high usage, low battery)
- Device management
- Responsive sidebar layout

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript, Chart.js |
| Backend | Node.js, Express |
| Real-time | Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Seed the database (creates demo data + demo user)
```bash
npm run seed
```
Demo login: `demo@energy.com` / `demo1234`

### 4. Start the server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Open: http://localhost:3000

## Project Structure
```
home-energy-system/
├── server.js              # Entry point, Socket.io setup
├── seed.js                # Database seeder (30 days of data)
├── models/
│   ├── User.js            # User schema + password hashing
│   ├── EnergyReading.js   # Time-series readings with indexes
│   ├── Device.js          # Smart devices
│   └── Alert.js           # Alert log
├── routes/
│   ├── auth.js            # Register, login, JWT
│   ├── readings.js        # CRUD + threshold checking
│   ├── devices.js         # Device management
│   ├── alerts.js          # Alert log
│   └── analytics.js       # MongoDB aggregation pipelines
├── middleware/
│   └── auth.js            # JWT verification middleware
└── public/
    ├── index.html         # Single-page app
    ├── css/style.css      # Full responsive stylesheet
    └── js/app.js          # Frontend logic + Chart.js + Socket.io
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get JWT token |
| GET | /api/auth/me | Get current user |
| PATCH | /api/auth/thresholds | Update alert thresholds |

### Readings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/readings | List readings (filterable) |
| POST | /api/readings | Add reading + check thresholds |
| GET | /api/readings/:id | Single reading |
| DELETE | /api/readings/:id | Delete reading |

### Analytics (MongoDB aggregations)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/analytics/daily | Daily totals — 30 days |
| GET | /api/analytics/peak | Peak hours by hour of day |
| GET | /api/analytics/sources | Solar vs grid vs battery breakdown |
| GET | /api/analytics/prediction | 7-day moving average forecast |
| GET | /api/analytics/summary | Dashboard summary stats |

## Deployment (Render + MongoDB Atlas)
1. Push code to GitHub
2. Create free cluster on [MongoDB Atlas](https://cloud.mongodb.com)
3. Deploy to [Render](https://render.com) — connect GitHub repo
4. Set environment variables in Render dashboard
5. Done!
