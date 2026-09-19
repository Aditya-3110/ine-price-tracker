const express = require("express");
const cors = require("cors");
const supabase = require("./supabase");
const { scrapeWithRetry } = require("./scraper");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

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

app.post("/scrape/run", async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from("products")
            .select("id, name, url, sku");

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!products || products.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No products found"
            });
        }

        const results = [];

        for (const product of products) {
            console.log(`\nScraping: ${product.name}`);

            const result = await scrapeWithRetry(
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

        const successful = results.filter(
            result => result.success
        ).length;

        const failed = results.filter(
            result => !result.success
        ).length;

        res.json({
            success: failed === 0,
            total_products: products.length,
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});