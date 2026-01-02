# Mongol Poker 13 - Next.js Web App

This is the Next.js web version of the Mongol Poker 13 mobile app, converted from Flutter.

## Features

- 🔐 Authentication (Email, Google, Apple Sign-In)
- 🎮 Game Selection & Buy-In Selection
- 🏠 Room Selection with real-time player counts
- 🃏 Real-time Poker Game with WebSocket
- 💰 Account Balance Management
- 💬 Admin Chat System

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Update the API URL in `src/lib/config.ts` if needed:
```typescript
export const API_URL = 'http://146.190.109.150:3001';
export const WS_URL = 'ws://146.190.109.150:3001';
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Home/Landing page
│   ├── game-selection/    # Game selection page
│   ├── buy-in/            # Buy-in selection page
│   ├── room-selection/    # Room selection page
│   └── play/              # Game play page
├── components/            # React components
│   ├── HomeScreen.tsx
│   ├── GameSelectionScreen.tsx
│   ├── BuyInSelectionScreen.tsx
│   ├── RoomSelectionScreen.tsx
│   ├── GamePlayScreen.tsx
│   └── CardComponent.tsx
├── lib/                   # Utilities and services
│   ├── api.ts             # API client
│   ├── websocket.ts       # WebSocket service
│   ├── storage.ts         # Local storage utilities
│   ├── firebase.ts        # Firebase configuration
│   ├── config.ts          # App configuration
│   ├── models/           # TypeScript models
│   │   ├── card.ts
│   │   └── hand.ts
│   └── utils/            # Utility functions
│       └── cardEvaluator.ts
└── app/
    ├── layout.tsx         # Root layout
    └── globals.css       # Global styles
```

## Key Features Implementation

### Authentication
- Email/Password login and registration
- Google Sign-In via Firebase
- Apple Sign-In via Firebase
- User session management with cookies and localStorage

### Game Flow
1. **Home Screen**: Authentication options
2. **Game Selection**: Main menu after login
3. **Buy-In Selection**: Choose buy-in amount (20k, 50k, 100k, 200k)
4. **Room Selection**: Select a room with real-time player counts
5. **Game Play**: Real-time poker game with WebSocket

### WebSocket Integration
- Real-time game state updates
- Player actions (play cards, pass)
- Chat functionality
- Room status updates

### Card Game Logic
- Card evaluation (pairs, three of a kind, straights, flushes, etc.)
- Hand comparison
- Turn management
- Game state synchronization

## Backend Integration

The app connects to the same backend as the Flutter app:
- API endpoints: `/api/auth/*`, `/api/games/*`
- WebSocket server for real-time game communication
- User authentication and game state management

## Notes

- The backend and web admin remain unchanged
- This is a web version of the mobile Flutter app
- All game logic matches the Flutter implementation
- WebSocket protocol matches the Flutter app's implementation

## Development

- Uses Next.js 13 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Framer Motion for animations
- Zustand for state management (can be added if needed)
- React Hot Toast for notifications
