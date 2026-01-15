# GUTS ESS - Employee Self Service System

Employee Self Service Portal built with **React 19 + TypeScript + Vite**

## 📋 Project Structure

```
GUTSESS_01/
├── src/
│   ├── components/
│   │   ├── common/           # Reusable components
│   │   ├── modals/           # Modal dialogs
│   │   ├── AppHeader.tsx      # Header component
│   │   ├── BackButton.tsx     # Back button
│   │   ├── FirstLoginModal.tsx
│   │   └── ForgotPasswordModal.tsx
│   │
│   ├── pages/                # Page components (Route-based)
│   │   ├── Login.tsx         # Login page
│   │   ├── Home.tsx          # Dashboard home
│   │   ├── CheckInOut.tsx    # Attendance check-in/out
│   │   ├── FaceVerify.tsx    # Face recognition verification
│   │   └── Dashboard.tsx     # Admin dashboard
│   │
│   ├── api/                  # API endpoints (empty - ready for expansion)
│   │
│   ├── services/             # Business logic services (empty - ready for expansion)
│   │
│   ├── store/                # State management
│   │   ├── slices/           # Redux slices
│   │   └── store.tsx         # Redux store
│   │
│   ├── assets/               # Static assets (images, icons)
│   │
│   ├── App.tsx               # Main app component
│   ├── App.css               # App styles
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 📦 Dependencies

### Runtime Dependencies
- **react** (^19.2.0) - UI library
- **react-dom** (^19.2.0) - React DOM rendering
- **@fortawesome/react-fontawesome** (^3.1.1) - Icon library (FontAwesome)
- **@fortawesome/fontawesome-svg-core** (^7.1.0) - FontAwesome core
- **@fortawesome/free-solid-svg-icons** (^7.1.0) - FontAwesome solid icons
- **lucide-react** (^0.562.0) - Alternative icon library
- **react-hook-form** (^7.71.0) - Form state management
- **zod** (^4.3.5) - TypeScript-first schema validation
- **clsx** (^2.1.1) - Utility for conditional CSS classes

### Development Dependencies
- **typescript** (~5.9.3) - TypeScript compiler
- **vite** (^7.2.4) - Build tool & dev server
- **@vitejs/plugin-react** (^5.1.1) - React plugin for Vite
- **eslint** (^9.39.1) - Code linter
- **@eslint/js** (^9.39.1) - ESLint JavaScript plugin
- **eslint-plugin-react-hooks** (^7.0.1) - React hooks linting
- **eslint-plugin-react-refresh** (^0.4.24) - React refresh plugin
- **typescript-eslint** (^8.46.4) - TypeScript ESLint support
- **@types/react** (^19.2.5) - React type definitions
- **@types/react-dom** (^19.2.3) - React DOM type definitions
- **@types/node** (^24.10.1) - Node.js type definitions
- **globals** (^16.5.0) - Global variables definitions

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Lint Code
```bash
npm lint
```

### Preview Production Build
```bash
npm run preview
```

## 🎯 Features

✅ Employee login with PIN  
✅ First-time user onboarding  
✅ Check-in/Check-out with face verification  
✅ Attendance history  
✅ Employee dashboard  
✅ Responsive design (mobile-first)  
✅ Thai language support  
✅ Icon-based UI with FontAwesome & Lucide React  

## 👥 Team

- **Owner**: lockkup
- **Contributors**: Posuza (Employee)

## 📝 Recent Update

Updated by Peter - Project structure and documentation completed

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | React 19 |
| **Language** | TypeScript 5.9 |
| **Build Tool** | Vite 7 |
| **Package Manager** | npm |
| **Linting** | ESLint 9 |
| **Icons** | FontAwesome 7 + Lucide React |
| **Forms** | React Hook Form 7 |
| **Validation** | Zod 4 |
| **Styling** | CSS |

## 📧 Contact & Support

For issues or feature requests, contact the development team.

