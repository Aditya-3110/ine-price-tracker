const express = require("express");
const cors = require("cors");
const supabase = require("./supabase");
const { scrapeWithRetry } = require("./scraper");
const { chromium } = require("playwright");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STORE_URL = "https://demo.inelabteamdev.com";

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "INE Price Tracker API is running"
    });
});

app.get("/api/products", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            products: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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

        const productsMap = new Map();

        const MAX_PAGES = 50;

        for (
            let pageNumber = 1;
            pageNumber <= MAX_PAGES;
            pageNumber++
        ) {
            const url =
                pageNumber === 1
                    ? STORE_URL
                    : `${STORE_URL}/?page=${pageNumber}`;

            console.log(
                `Searching store page ${pageNumber}...`
            );

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForTimeout(1000);

            const cards = await page
                .locator("article.tile")
                .evaluateAll((articles) => {
                    return articles.map((article) => {
                        const name =
                            article
                                .querySelector(".tile-name")
                                ?.textContent
                                ?.trim() || "";

                        const brand =
                            article
                                .querySelector(".tile-brand")
                                ?.textContent
                                ?.trim() || "";

                        const skuText =
                            article
                                .querySelector(".tile-sku")
                                ?.textContent
                                ?.trim() || "";

                        const skuMatch =
                            skuText.match(
                                /SKU\s+([A-Z0-9-]+)/i
                            );

                        return {
                            name,
                            brand,
                            sku: skuMatch
                                ? skuMatch[1]
                                : null
                        };
                    });
                });

            if (cards.length === 0) {
                break;
            }

            for (const product of cards) {
                const searchableText = `
                    ${product.name}
                    ${product.brand}
                    ${product.sku || ""}
                `.toLowerCase();

                if (
                    searchableText.includes(query) &&
                    product.sku
                ) {
                    const skuParts =
                        product.sku.split("-");

                    const skuNumber =
                        Number(skuParts[1]);

                    if (
                        Number.isFinite(skuNumber) &&
                        skuNumber >= 10000
                    ) {
                        const productId =
                            skuNumber - 10000;

                        productsMap.set(
                            product.sku,
                            {
                                name: product.name,
                                brand: product.brand,
                                sku: product.sku,
                                url:
                                    `${STORE_URL}/product/${productId}`
                            }
                        );
                    }
                }

                if (productsMap.size >= 20) {
                    break;
                }
            }

            if (productsMap.size >= 20) {
                break;
            }
        }

        const matches = Array.from(
            productsMap.values()
        ).slice(0, 20);

        res.json({
            success: true,
            query,
            count: matches.length,
            products: matches
        });

    } catch (error) {
        console.error(
            "Product search error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.post("/api/products/track", async (req, res) => {
    try {
        const {
            name,
            brand,
            sku,
            url
        } = req.body;

        if (!name || !sku || !url) {
            return res.status(400).json({
                success: false,
                error:
                    "name, sku and url are required"
            });
        }

        const { data, error } = await supabase
            .from("products")
            .upsert(
                {
                    name,
                    sku,
                    url
                },
                {
                    onConflict: "url"
                }
            )
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            message: "Product is now being tracked",
            product: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/products/:id/history", async (req, res) => {
    try {
        const productId = req.params.id;

        const { data, error } = await supabase
            .from("price_history")
            .select("*")
            .eq("product_id", productId)
            .order("scraped_at", {
                ascending: true
            });

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            history: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
                error: error.message
            });
        }

        res.json({
            success: true,
            logs: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/scrape/run", async (req, res) => {
    try {
        const {
            data: products,
            error
        } = await supabase
            .from("products")
            .select(
                "id, name, url, sku"
            );

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (
            !products ||
            products.length === 0
        ) {
            return res.status(404).json({
                success: false,
                error: "No products found"
            });
        }

        const results = [];

        for (const product of products) {
            console.log(
                `\nScraping: ${product.name}`
            );

            const result =
                await scrapeWithRetry(
                    product.url,
                    3,
                    req.query.headed === "true"
                );

            results.push({
                product_id: product.id,
                product_name: product.name,
                ...result
            });
        }

        const successful =
            results.filter(
                result => result.success
            ).length;

        const failed =
            results.filter(
                result => !result.success
            ).length;

        res.json({
            success: failed === 0,
            total_products:
                products.length,
            successful,
            failed,
            results
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Server running on port ${PORT}`
    );
});