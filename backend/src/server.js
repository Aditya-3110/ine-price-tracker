require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const supabase = require("./supabase");
const { scrapeWithRetry } = require("./scraper");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "INE Price Tracker API is running"
    });
});

/* =========================
   GET ALL TRACKED PRODUCTS
========================= */

app.get("/api/products", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            products: data || []
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================
   SEARCH PRODUCTS
========================= */

app.get("/api/search-products", async (req, res) => {
    let browser;

    try {
        const query = (req.query.q || "")
            .trim()
            .toLowerCase();

        if (!query) {
            return res.json({
                success: true,
                query: "",
                count: 0,
                products: []
            });
        }

        browser = await chromium.launch({
            headless: true
        });

        const page = await browser.newPage({
            viewport: {
                width: 1440,
                height: 900
            }
        });

        await page.goto("https://demo.inelabteamdev.com/", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        await page.waitForTimeout(3000);

        const products = await page.evaluate(() => {
            const result = [];

            const links = Array.from(
                document.querySelectorAll('a[href*="/product/"]')
            );

            for (const link of links) {
                const href = link.href;

                if (!href) continue;

                const text = link.innerText
                    .replace(/\s+/g, " ")
                    .trim();

                if (!text) continue;

                const match = href.match(/\/product\/([^/?#]+)/);

                if (!match) continue;

                result.push({
                    name: text,
                    url: href,
                    productId: match[1]
                });
            }

            return result;
        });

        const uniqueProducts = Array.from(
            new Map(
                products.map(product => [product.url, product])
            ).values()
        );

        const matchedProducts = uniqueProducts.filter(product =>
            product.name.toLowerCase().includes(query)
        );

        res.json({
            success: true,
            query,
            count: matchedProducts.length,
            products: matchedProducts.slice(0, 20)
        });

    } catch (error) {
        console.error("Product search error:", error);

        res.status(500).json({
            success: false,
            message: "Product search failed",
            error: error.message
        });

    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

/* =========================
   TRACK PRODUCT
========================= */

app.post("/api/products/track", async (req, res) => {
    try {
        const { name, url, sku } = req.body;

        if (!name || !url) {
            return res.status(400).json({
                success: false,
                message: "Product name and URL are required"
            });
        }

        const { data: existingProduct, error: existingError } =
            await supabase
                .from("products")
                .select("*")
                .eq("url", url)
                .maybeSingle();

        if (existingError) {
            return res.status(500).json({
                success: false,
                message: existingError.message
            });
        }

        if (existingProduct) {
            return res.json({
                success: true,
                message: "Product is already being tracked",
                product: existingProduct
            });
        }

        const { data, error } = await supabase
            .from("products")
            .insert({
                name,
                url,
                sku: sku || null
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: "Product added for tracking",
            product: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================
   PRODUCT PRICE HISTORY
========================= */

app.get("/api/products/:id/history", async (req, res) => {
    try {
        const productId = req.params.id;

        const { data, error } = await supabase
            .from("price_history")
            .select("*")
            .eq("product_id", productId)
            .order("scraped_at", { ascending: true });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            history: data || []
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================
   PRODUCT SCRAPE LOGS
========================= */

app.get("/api/products/:id/logs", async (req, res) => {
    try {
        const productId = req.params.id;

        const { data, error } = await supabase
            .from("scrape_logs")
            .select("*")
            .eq("product_id", productId)
            .order("attempted_at", {
                ascending: false
            });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            logs: data || []
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================
   RUN SCRAPE FOR ALL PRODUCTS
========================= */

app.post("/scrape/run", async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from("products")
            .select("*");

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        if (!products || products.length === 0) {
            return res.json({
                success: true,
                message: "No products are being tracked",
                results: []
            });
        }

        const results = [];

        for (const product of products) {
            console.log(`Scraping: ${product.name}`);

            try {
                const result = await scrapeWithRetry(
                    product.url,
                    3,
                    true,
                    product.sku
                );

                results.push({
                    product_id: product.id,
                    product_name: product.name,
                    success: result.success,
                    price: result.price || null,
                    stock: result.stock || null,
                    error: result.error || null
                });

            } catch (error) {
                results.push({
                    product_id: product.id,
                    product_name: product.name,
                    success: false,
                    price: null,
                    stock: null,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: "Scraping completed",
            results
        });

    } catch (error) {
        console.error("Scrape run error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "INE Price Tracker API"
    });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});