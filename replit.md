# Elite Vinewood Auto - Vehicle Catalog Application

## Overview

Elite Vinewood Auto is a premium vehicle dealership catalog web application built with React and Express. The application provides an elegant, dark-themed interface for browsing and filtering luxury vehicles. Users can explore a comprehensive catalog of vehicles across multiple categories (Compacts, Coupes, Motorcycles, Muscle cars, Sedans, Sports cars, etc.) with advanced filtering capabilities including price range, trunk capacity, seating capacity, and special features.

The application features a modern single-page application (SPA) architecture with server-side rendering support for production deployments.

## Recent Changes

**November 24, 2025 - localStorage/sessionStorage Removed:**
- ✅ Deleted `vehicleStorage.ts` file completely
- ✅ Removed sessionStorage usage for JWT tokens
- ✅ Updated `api.ts` to pass token as parameter instead of storing in sessionStorage
- ✅ Refactored Admin.tsx to manage token in React state
- ✅ Updated AddVehicleDialog to accept token as prop
- ✅ Updated VehicleAdminTable to accept token as prop
- ✅ All CRUD operations use token passed through component props
- ✅ No local storage dependency - token is memory-only (lost on page refresh)

**November 24, 2025 - Database Clean & Import with Updated Authentication:**
- ✅ Cleared all vehicles from PostgreSQL database
- ✅ Imported 433 new vehicles from vehicleStorage JSON file
- ✅ Renamed `access_admin` table column from `code` to `access_key` for consistency
- ✅ Updated authentication system to verify `access_key` column in `access_admin` table
- ✅ Access code: `3l1t3v1n3w00d2k25@!` (DB-stored validation with fallback)
- ✅ All 433 vehicles displaying correctly in catalog with formatted prices
- ✅ Admin panel fully functional with new vehicle dataset

**November 24, 2025 - Input Types & Price Formatting Enhancement:**
- Converted all `input type="number"` fields to `type="text"` for manual entry throughout admin panel
- Created `priceFormatter.ts` utility with `formatPrice()` and `parsePrice()` functions
- Implemented price display format with dots separator (e.g., 1.200.000$) across admin table, add/edit dialogs, and catalog
- Updated budget filter display in Catalog to show formatted prices
- Created `access_admin` database table to store admin access codes (DB-based validation)
- All numeric inputs (price, trunk weight, seats) now accept text input for flexibility

**November 24, 2025 - Admin System Improvements & UI Redesign:**
- Imported all 433 vehicles from source database
- Redesigned admin interface to match main site colors and styling (dark theme with amber accents)
- Implemented real-time image preview when adding/editing vehicles
- Added clickable column headers in admin table for multi-column sorting (Name, Price, Category, Trunk, Seats, Particularity)
- Sorted all vehicles alphabetically by category first, then by name
- Created dedicated AdminHeader component for professional administration panel header
- Enhanced AddVehicleDialog with image preview and styled inputs matching site theme

**November 24, 2025 - Admin System with PostgreSQL Database:**
- Integrated Neon PostgreSQL database via @netlify/neon package with NETLIFY_DATABASE_URL
- Imported 433 vehicles from MySQL to PostgreSQL database
- Created secure admin interface at /admin with JWT authentication
- Implemented full CRUD operations (create, update, delete) for vehicle management
- Added search by vehicle name and category filtering in admin panel
- Separated public catalog (GET routes) from protected admin operations (POST/PUT/DELETE)
- Configured JWT-based authentication with server-side secret (JWT_SECRET)
- Access code: 3l1t3v1n3w00d2k25@! (server-side validation only)

**November 24, 2025 - Replit Environment Setup:**
- Configured project for Replit environment
- Fixed Vite HMR configuration for WebSocket connections (changed from `port` to `clientPort`)
- Added .gitignore file with Node.js and Vite-specific patterns
- Installed all dependencies using npm
- Set up Development Server workflow on port 5000
- Configured deployment settings for Replit Autoscale
- Verified frontend and backend API functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast HMR (Hot Module Replacement)
- React Router for client-side routing with dedicated pages (Index, Catalog, About, Contact, NotFound)
- SWC for fast TypeScript/JSX compilation

**UI Component Library:**
- Radix UI primitives for accessible, unstyled components (dialogs, dropdowns, tooltips, etc.)
- shadcn/ui component system built on top of Radix UI
- Tailwind CSS for utility-first styling with a custom dark theme
- CSS variables for theming (amber/gold primary colors, dark backgrounds)

**State Management:**
- TanStack Query (React Query) for server state and caching
- React Hook Form with Zod resolvers for form validation
- Local storage for vehicle data persistence (`vehicleStorage.ts`)

**Design Patterns:**
- Component-based architecture with reusable UI components
- Custom hooks for shared logic (`use-mobile`, `use-toast`)
- Path aliases (`@/`, `@shared/`) for clean imports
- Responsive design with mobile-first approach

### Backend Architecture

**Server Framework:**
- Express 5.x as the web server framework
- CORS enabled for cross-origin requests
- JSON and URL-encoded body parsing middleware

**API Structure:**
- RESTful API endpoints under `/api` prefix
- Authentication: `/api/auth/login` - JWT token generation
- Vehicle endpoints:
  - GET `/api/vehicles` - List all vehicles (public)
  - GET `/api/vehicles/categories` - List categories (public)
  - GET `/api/vehicles/:id` - Get vehicle by ID (public)
  - POST `/api/vehicles` - Create vehicle (admin only)
  - PUT `/api/vehicles/:id` - Update vehicle (admin only)
  - DELETE `/api/vehicles/:id` - Delete vehicle (admin only)
- Middleware: `adminAuth` for JWT token validation
- Separation of route handlers in dedicated modules (`server/routes/`)

**Development vs Production:**
- Development: Vite dev server with Express middleware integration via custom plugin
- Production: Static SPA serving with Express handling fallback routing
- Separate build configurations (`vite.config.ts` for client, `vite.config.server.ts` for server)

**Build Output:**
- Client builds to `dist/spa/` directory
- Server builds to `dist/server/` directory as ES modules
- Node 22 target for server-side code

### Data Storage Solutions

**PostgreSQL Database (Neon via Netlify):**
- Production database with 423+ vehicles
- Connection via @netlify/neon package using NETLIFY_DATABASE_URL
- Table: `vehicles` with columns: id, name, category, price, trunk_weight, image_url, seats, particularity, created_at, updated_at
- Predefined categories: Compacts, Coupes, Motos, Muscle, Sedans, Sports, Sports classics, SUVs, Super, Vans
- Real-time synchronization between admin panel and public catalog

**Authentication & Security:**
- JWT-based authentication for admin operations
- Server-side secret (JWT_SECRET) stored as environment variable
- Access code validated server-side only (3l1t3v1n3w00d2k25@!)
- Public routes (GET) remain open for catalog browsing
- Protected routes (POST/PUT/DELETE) require valid JWT token
- Token expiration: 24 hours

**Data Model:**
- Vehicle interface with fields: id, name, category, price, trunk_weight, image_url, seats, particularity
- Type-safe data structures using TypeScript interfaces
- Server-side validation on all CRUD operations

**Rationale:**
- PostgreSQL chosen for persistent, production-ready data storage
- Admin system enables dynamic content management
- Separation of public/admin access maintains security while allowing public browsing

### External Dependencies

**Third-Party UI Libraries:**
- Radix UI component primitives (20+ packages for different UI elements)
- React Three Fiber and Drei for potential 3D visualizations
- Lucide React for icon components
- Sonner for toast notifications

**Styling & CSS:**
- Tailwind CSS with Typography plugin
- PostCSS with Autoprefixer
- Custom color scheme based on HSL values

**Utilities:**
- clsx and tailwind-merge for conditional className management
- class-variance-authority for component variant handling
- Zod for schema validation
- jsonwebtoken for JWT authentication
- @netlify/neon for PostgreSQL database connection

**Deployment:**
- Replit Autoscale deployment configured for production
- Environment variable support via dotenv
- WebSocket HMR configuration for cloud development environments (Replit)
- Build command: `npm run build` (builds both client and server)
- Start command: `node dist/server/production.mjs`

**Pros of Current Approach:**
- Fast development with pre-built accessible components
- Type-safety throughout the application
- Excellent developer experience with Vite
- Easy deployment to various platforms

**Cons:**
- Heavy client-side bundle due to multiple Radix UI packages
- No backend persistence (could be added with database integration)
- Limited SEO optimization (pure SPA without SSR in production)