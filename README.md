# GUTS ESS_O1 - Employee Self Service System

Modern employee self-service system built with **React 19 + TypeScript + Vite + CSS Modules**

## 📋 Project Structure

```
GUTSESS_01/
├── public/                    # Static assets
│
├── src/
│   ├── components/           # Reusable components (with scoped CSS)
│   │   ├── AppHeader.tsx
│   │   ├── AppHeader.module.css
│   │   ├── BackButton.tsx
│   │   ├── BackButton.module.css
│   │   ├── FirstLoginModal.tsx
│   │   ├── FirstLoginModal.module.css
│   │   ├── ForgotPasswordModal.tsx
│   │   └── ForgotPasswordModal.module.css
│   │
│   ├── pages/                # Page components (with scoped CSS)
│   │   ├── Login.tsx
│   │   ├── Login.module.css
│   │   ├── Home.tsx
│   │   ├── Home.module.css
│   │   ├── CheckInOut.tsx
│   │   ├── CheckInOut.module.css
│   │   ├── FaceVerify.tsx
│   │   ├── FaceVerify.module.css
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.module.css
│   │
│   ├── styles/               # Global styles & theme
│   │   ├── global.css        # Essential resets only
│   │   └── theme.css         # CSS variables (colors, spacing, fonts, shadows)
│   │
│   ├── api/                  # API services (ready for expansion)
│   ├── services/             # Business logic services (ready for expansion)
│   ├── store/                # Redux state management
│   │   ├── slices/           # Redux slices
│   │   └── store.tsx         # Redux store configuration
│   │
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   ├── assets/               # Static assets (images, icons)
│   │
│   ├── App.tsx               # Main app component
│   ├── index.css             # Entry point (imports fonts, theme, global)
│   ├── main.tsx              # React root entry
│   └── vite-env.d.ts         # Vite environment types
│
├── index.html                # HTML template
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
├── tsconfig.app.json         # TypeScript app config
├── tsconfig.node.json        # TypeScript node config
├── vite.config.ts            # Vite configuration
├── eslint.config.js          # ESLint configuration
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## 🎨 CSS Architecture: Modular CSS Modules

### Overview

Each component and page has its own **scoped CSS module** (`.module.css`):

- **Components**: `components/ComponentName.module.css`
- **Pages**: `pages/PageName.module.css`
- **Global**: Only essential resets in `styles/global.css`
- **Theme**: Centralized CSS variables in `styles/theme.css`



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
- **typescript-eslint** (^8.46.4) - TypeScript ESLint support





# Project - Update

- organize the projects 
- adding theme,moduless.css to compents and Page 

