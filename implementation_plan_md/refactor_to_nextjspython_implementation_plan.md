# Implementation Plan — Refactoring to Next.js + Python Backend

## Goal
Transition the Insider Trading Tracker frontend from plain HTML/JS to a modern Next.js (React) application while maintaining the Python (FastAPI) backend. This architecture will support future scalability for interactive charts and AI-agent integrations.

## Architecture

* **Backend (Python / FastAPI):** Acts solely as a RESTful JSON API (e.g., running on `localhost:8000`). It will handle database queries, data scraping, and API routing (`/api/trades`, `/api/summary`, `/api/watchlist`, `/api/refresh`).
* **Frontend (Next.js):** Acts as the UI layer (e.g., running on `localhost:3000`), fetching data from the Python API and rendering it using React components. We will use Next.js App Router and Tailwind CSS for styling.
* **CORS:** FastAPI MUST be updated to allow Cross-Origin Resource Sharing (CORS) from `localhost:3000`.

## Design Direction (Retained)
* **Theme:** Dark mode with a finance/terminal aesthetic — dark backgrounds (`#0a0a0f`, `#12121a`), accent colors for buy (green `#22c55e`) and sell (red `#ef4444`).
* **Typography:** Google Fonts — `Inter` for body text, `JetBrains Mono` for numbers/values.
* **Style:** Glassmorphism cards, subtle gradients, smooth micro-animations on hover/load.
* **Layout:** Single page dashboard featuring a header, summary metric cards, filter bar, and a main trades data table.

## Step-by-Step Implementation

### Phase 1: Python Backend Adjustments
1. **Remove Static Serving:** Remove FastAPI's `StaticFiles` mounting for the old `static/` directory (if it is currently set up).
2. **Add CORS Middleware:** Update `app.py` (or `main.py`) to add `CORSMiddleware` allowing requests from the frontend at `http://localhost:3000`.

### Phase 2: Next.js Setup
1. **Initialize Next.js:** Run `npx create-next-app@latest frontend` to create a `frontend` directory with App Router and Tailwind CSS enabled.
2. **Setup Tailwind & CSS Variables:** Add the custom color palette (e.g., `--bg-primary`, `--accent-green`, `--glass`) to `tailwind.config.js` and `app/globals.css`.

### Phase 3: Building React Components
1. **`Navbar` (Header):** Title, last updated timestamp, and a refresh button that calls `POST http://localhost:8000/api/refresh`.
2. **`SummaryCards`:** Fetch from `/api/summary`. Map over the data and render glassmorphism cards displaying ticker, total trades, buy/sell value, etc.
3. **`FilterBar`:** Input forms and dropdowns (Ticker, Direction, Owner, Date Range). Updates Next.js state (or URL query params) to trigger API refetching.
4. **`TradesTable`:** Fetch from `/api/trades` using the active filters. Sortable headers, alternating row colors, pagination controls. Highlight rows on hover.

### Phase 4: State Management & Data Fetching
* Use SWR, React Query, or standard React Server Components for efficient fetching, caching, and showing loading spinners from the FastAPI endpoints.

## Future Extensibility
* **Interactive Charts:** Can easily drop in libraries like `Recharts` for visualizing trade volumes.
* **AI Agent:** A chat component can be added using the Vercel AI SDK to stream conversational responses based on stock data.

## Open Questions

1. **Tooling:** Do you prefer using plain Tailwind CSS, or would you like to incorporate a modern UI component library like `shadcn/ui` to speed up building the glassmorphism standard?
2. **Execution Timing:** Are you ready to start splitting the project into a proper `backend/` and `frontend/` folder structure?
