INE Software Engineer Intern --- Product Price Tracker

A full-stack product price and stock tracker built for the INE Software
Engineer Intern assignment.

Live Demo

Frontend: https://ine-price-tracker-six.vercel.app/

Backend: https://ine-price-tracker-1.onrender.com

Health: https://ine-price-tracker-1.onrender.com/health

GitHub: https://github.com/Aditya-3110/ine-price-tracker

Mock Store: https://demo.inelabteamdev.com/

Features

Search products by partial or full name.

Search the complete 1000-product mock catalogue.

Track selected products.

Scrape current price and stock using Playwright.

Store successful observations in Supabase/PostgreSQL.

Store every scrape attempt and failure in scrape logs.

Retry failed scrapes.

Prevent failed scrapes from creating fake history points.

View price/stock history and scrape logs.

React frontend deployed on Vercel.

Node/Express backend deployed on Render.

Supports headed Playwright runs for the required reliability
demonstration.

Tech Stack

Frontend: React, Vite, JavaScript, CSS

Backend: Node.js, Express.js, Playwright, CORS, dotenv

Database: Supabase / PostgreSQL

Deployment: Vercel, Render, cron-job.org

Architecture

React/Vite (Vercel)
        |
        | REST API
        v
Node/Express (Render)
      /        /     Playwright  Supabase/PostgreSQL
   |
   v
INE Mock Store

Project Structure

ine-price-tracker/
├── backend/
│   ├── src/
│   │   ├── scraper.js
│   │   ├── server.js
│   │   └── supabase.js
│   ├── .env
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── package-lock.json
└── .gitignore

Database Schema

products

Stores tracked products.

id --- primary key

name --- product name

url --- product detail URL

sku --- product SKU

created_at --- tracking creation time

price_history

Stores only successful price/stock observations.

id --- primary key

product_id --- references products.id

price --- scraped price

stock --- scraped stock

scraped_at --- successful scrape time

scrape_logs

Stores every scrape attempt.

id --- primary key

product_id --- references products.id

attempted_at --- attempt time

status --- success/failure status

attempt_number --- retry number

error_message --- failure details

Local Setup

Backend

git clone https://github.com/Aditya-3110/ine-price-tracker.git
cd ine-price-tracker/backend
npm install
npx playwright install chromium

Create backend/.env:

SUPABASE_URL=https://reqggjxzvdddjnhqunhd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_Il_mQylCi52aVf-ySrYAyw_Fkz7rEVM

Start:

node src/server.js

Backend:

http://localhost:3000

Health:

http://localhost:3000/health

Frontend

cd frontend
npm install
npm run dev

For local development:

VITE_API_URL=http://localhost:3000

The Vite development server normally runs at:

http://localhost:5173

Environment Variables

Backend

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

Frontend

VITE_API_URL=...

Never commit .env files or Supabase service-role credentials.

API Endpoints

Health

GET /health

Search products

GET /api/search-products?q=<product-name>

Example:

/api/search-products?q=Nordkraft%20Smart%20Ring%20Mini

Get tracked products

GET /api/products

Track product

POST /api/products/track
Content-Type: application/json

Example:

{
  "name": "Nordkraft Smart Ring Mini",
  "url": "https://demo.inelabteamdev.com/product/99",
  "sku": "NOR-10099"
}

Price history

GET /api/products/:id/history

Scrape logs

GET /api/products/:id/logs

Run scraping

POST /scrape/run

This scrapes all currently tracked products.

Scheduled Scraping

The production scrape endpoint is:

https://ine-price-tracker-1.onrender.com/scrape/run

Configure an external scheduler such as cron-job.org to send a POST
request to this endpoint every 2 hours.

Recommended configuration:

URL: https://ine-price-tracker-1.onrender.com/scrape/run

Method: POST

Frequency: every 2 hours

Render's free instance may sleep after inactivity, so the first request
after inactivity can take longer.

Scraping Reliability

The scraper treats failure as an expected condition.

Retry strategy

Each scrape can be attempted up to three times, with a delay between
failed attempts.

Failure handling

When an attempt fails:

The attempt is written to scrape_logs.

The error is preserved.

No invalid price-history row is created.

Existing valid history remains unchanged.

Only a successful scrape creates a new price_history record.

Example:

Attempt 1 -> failed
Attempt 2 -> failed
Attempt 3 -> success -> save price/stock

If all attempts fail:

Attempt 1 -> failed
Attempt 2 -> failed
Attempt 3 -> failed

the failure is logged without adding fake historical price/stock data.

Product Search Design

The mock storefront contains 1000 products across 50 pages and does not
provide a normal search box.

The application therefore performs the search itself.

The backend:

Opens the storefront with Playwright.

Iterates through the catalogue pages.

Reads product names, brands and SKUs.

Matches the user's partial/full query.

Resolves the matching product to its detail URL.

Returns the result to the React frontend.

The search implementation also tolerates missing optional fields on
product cards.

Example:

{
  "name": "Nordkraft Smart Ring Mini",
  "brand": "Nordkraft",
  "sku": "NOR-10099",
  "url": "https://demo.inelabteamdev.com/product/99"
}

Scraper Design

The product detail page can hide the price behind an interaction.
Playwright is used to reproduce the browser interaction.

The scraper can:

Open the product detail page.

Handle the cookie popup when present.

Hover/interact with the price section.

Click the reveal-price control.

Extract the displayed price.

Extract stock.

Validate the values.

Retry when extraction fails.

Why Playwright?

Simple HTTP parsing is lighter, but the mock store uses browser
interactions for price visibility. Playwright provides reliable
browser-level interaction.

Trade-off: browser automation uses more resources and is slower than
direct HTTP parsing.

Deployment

Frontend

Vercel:

https://ine-price-tracker-six.vercel.app/

Environment variable:

VITE_API_URL=https://ine-price-tracker-1.onrender.com

Backend

Render:

https://ine-price-tracker-1.onrender.com

Build command:

npm install && npx playwright install chromium

Environment variable:

PLAYWRIGHT_BROWSERS_PATH=0

Start command:

node src/server.js

Health check:

/health

Testing Checklist

Backend health endpoint

Playwright Chromium on Render

Product search

Partial/full name matching

Search across the mock catalogue

Correct product detail URL

Product tracking

Supabase product storage

Price/stock scraping

Retry handling

Failure logging

Price history

Scrape logs

React frontend deployment

Render backend deployment

AI-Assisted Development Note

AI assistance was used for implementation guidance, debugging,
deployment troubleshooting and code iteration.

Implementation decisions were tested against the deployed mock
storefront and Render environment. One early assumption was that product
cards contained normal product links; inspection showed that the
storefront uses JavaScript buttons and pagination. The search
implementation was therefore revised to work with the actual storefront
structure.

Deployment testing also exposed Playwright browser-installation and
incomplete-card-field failures. These were handled explicitly rather
than hiding failed scrape results.

Trade-offs and Future Improvements

Current design favors correctness and honest history over maximum speed.

Possible improvements:

Cache the 1000-product catalogue to reduce repeated full-store
scans.

Add price/stock change detection.

Add email or other alerts.

Support multiple tracked products in a richer dashboard.

Allow configurable scrape frequency.

Add automated CI/CD tests.

Add authentication for multi-user deployments.

License

This project was created as an assignment submission for the INE
Software Engineer Intern evaluation.
