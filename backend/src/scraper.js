const { chromium } = require("playwright");
const supabase = require("./supabase");

async function acceptCookies(page) {
    const acceptButton = page.getByRole("button", {
        name: "ACCEPT",
        exact: true
    });

    if (await acceptButton.count() === 0) {
        console.log("No cookie popup detected.");
        return;
    }

    console.log("Cookie popup detected.");

    const button = acceptButton.first();

    await button.waitFor({
        state: "visible",
        timeout: 10000
    });

    // First try normal Playwright click
    try {
        await button.click({
            timeout: 5000
        });
    } catch {
        console.log("Normal cookie click failed.");
    }

    await page.waitForTimeout(1500);

    let stillVisible = await button.isVisible().catch(() => false);

    // Second attempt: real mouse click
    if (stillVisible) {
        console.log("Trying mouse click on ACCEPT...");

        const box = await button.boundingBox();

        if (box) {
            await page.mouse.click(
                box.x + box.width / 2,
                box.y + box.height / 2
            );
        }

        await page.waitForTimeout(1500);

        stillVisible = await button.isVisible().catch(() => false);
    }

    // Third attempt: DOM click
    if (stillVisible) {
        console.log("Trying DOM click on ACCEPT...");

        await button.evaluate((element) => {
            element.click();
        }).catch(() => {});

        await page.waitForTimeout(1500);

        stillVisible = await button.isVisible().catch(() => false);
    }

    if (stillVisible) {
        throw new Error("Cookie popup was not accepted");
    }

    console.log("Cookie ACCEPT successful.");
}

async function scrapeProduct(url, headed = false) {
    const browser = await chromium.launch({
        headless: !headed
    });

    const page = await browser.newPage({
        viewport: {
            width: 1440,
            height: 900
        }
    });

    try {
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        const title = (
            await page.locator("h1").first().textContent()
        )?.trim();

        console.log("Product:", title);

        // =============================
        // COOKIES
        // =============================

        await acceptCookies(page);

        // =============================
        // PRICE BLOCK
        // =============================

        const priceBlock = page.locator(".price-block").first();

        if (await priceBlock.count() === 0) {
            throw new Error("Price block not found");
        }

        await priceBlock.scrollIntoViewIfNeeded();

        let finalPriceBlockText = "";

        // =============================
        // PRICE REVEAL RETRIES
        // =============================

        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(
                `\nPrice reveal attempt ${attempt}/3`
            );

            // Hover over price block
            const box = await priceBlock.boundingBox();

            if (box) {
                await page.mouse.move(
                    box.x + 5,
                    box.y + 5
                );

                await page.mouse.move(
                    box.x + box.width / 2,
                    box.y + box.height / 2,
                    {
                        steps: 50
                    }
                );
            }

            await page.waitForTimeout(2000);

            // Additional mouse/pointer events
            await priceBlock.evaluate((element) => {
                element.dispatchEvent(
                    new MouseEvent("mouseover", {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    })
                );

                element.dispatchEvent(
                    new MouseEvent("mouseenter", {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    })
                );

                element.dispatchEvent(
                    new PointerEvent("pointerover", {
                        bubbles: true,
                        cancelable: true,
                        pointerType: "mouse"
                    })
                );

                element.dispatchEvent(
                    new PointerEvent("pointerenter", {
                        bubbles: true,
                        cancelable: true,
                        pointerType: "mouse"
                    })
                );
            }).catch(() => {});

            await page.waitForTimeout(1500);

            // =============================
            // REVEAL BUTTON
            // =============================

            const revealButton = page.getByRole("button", {
                name: /reveal price/i
            });

            if (await revealButton.count() === 0) {
                console.log("Reveal button not found.");
            } else {
                const enabled = await revealButton
                    .isEnabled()
                    .catch(() => false);

                console.log(
                    "Reveal button enabled:",
                    enabled
                );

                if (enabled) {
                    console.log(
                        "Clicking Reveal Price..."
                    );

                    try {
                        await revealButton.click({
                            timeout: 5000
                        });
                    } catch {
                        const revealBox =
                            await revealButton.boundingBox();

                        if (revealBox) {
                            await page.mouse.click(
                                revealBox.x +
                                    revealBox.width / 2,
                                revealBox.y +
                                    revealBox.height / 2
                            );
                        }
                    }

                    await page.waitForTimeout(4000);
                }
            }

            // =============================
            // READ PRICE BLOCK
            // =============================

            finalPriceBlockText =
                await priceBlock.innerText().catch(() => "");

            console.log(
                "\n===== PRICE BLOCK TEXT ====="
            );

            console.log(finalPriceBlockText);

            console.log(
                "===== END PRICE BLOCK TEXT =====\n"
            );

            // =============================
            // CHECK IF PRICE EXISTS
            // =============================

            if (/₹\s*[\d,]+/.test(finalPriceBlockText)) {
                console.log(
                    "Price successfully revealed."
                );

                break;
            }

            // =============================
            // CHALLENGE FAILED
            // =============================

            const challengeFailed =
                /challenge_failed/i.test(
                    finalPriceBlockText
                ) ||
                /couldn't load the price/i.test(
                    finalPriceBlockText
                );

            if (challengeFailed) {
                console.log(
                    "Store challenge failed."
                );

                const tryAgainButton =
                    page.getByRole("button", {
                        name: /try again/i
                    });

                if (
                    await tryAgainButton.count() > 0
                ) {
                    console.log(
                        "Clicking TRY AGAIN..."
                    );

                    await tryAgainButton
                        .first()
                        .click({
                            timeout: 5000
                        })
                        .catch(async () => {
                            await tryAgainButton
                                .first()
                                .click({
                                    force: true,
                                    timeout: 5000
                                });
                        });

                    await page.waitForTimeout(4000);

                    continue;
                }
            }

            await page.waitForTimeout(2000);
        }

        // =============================
        // FINAL PRICE TEXT
        // =============================

        finalPriceBlockText =
            await priceBlock.innerText().catch(() => "");

        console.log(
            "\n===== FINAL PRICE BLOCK ====="
        );

        console.log(finalPriceBlockText);

        console.log(
            "==============================\n"
        );

        // =============================
        // EXTRACT CURRENT DEAL PRICE
        // =============================

        let price = null;

        // BEST CASE:
        // "Deal price ₹50,363"
        const dealPriceMatch =
            finalPriceBlockText.match(
                /Deal\s*price\s*₹\s*([\d,]+)/i
            );

        if (dealPriceMatch) {
            price = Number(
                dealPriceMatch[1]
                    .replace(/,/g, "")
            );

            console.log(
                "Detected deal price:",
                price
            );
        }

        // Fallback if "Deal price" text is unavailable
        if (price === null) {
            const priceMatches =
                finalPriceBlockText.match(
                    /₹\s*([\d,]+)/g
                );

            if (
                !priceMatches ||
                priceMatches.length === 0
            ) {
                throw new Error("Price not found");
            }

            console.log(
                "All detected prices:",
                priceMatches
            );

            const currentPriceText =
                priceMatches[
                    priceMatches.length - 1
                ];

            price = Number(
                currentPriceText
                    .replace("₹", "")
                    .replace(/,/g, "")
                    .trim()
            );

            console.log(
                "Fallback current price:",
                price
            );
        }

        // =============================
        // STOCK
        // =============================

        const normalizedText =
            finalPriceBlockText
                .replace(/\s+/g, " ")
                .trim();

        let stock = null;

        if (
            /OUT\s+OF\s+STOCK/i.test(
                normalizedText
            )
        ) {
            stock = 0;
        } else {
            const stockPatterns = [
                /(\d+)\s+IN\s+STOCK/i,
                /JUST\s+(\d+)\s+LEFT/i,
                /(\d+)\s+LEFT/i
            ];

            for (
                const pattern of stockPatterns
            ) {
                const match =
                    normalizedText.match(pattern);

                if (match) {
                    stock = Number(match[1]);
                    break;
                }
            }
        }

        if (stock === null) {
            throw new Error("Stock not found");
        }

        console.log(
            "Detected stock:",
            stock
        );

        // =============================
        // VALIDATION
        // =============================

        if (
            !Number.isFinite(price) ||
            price <= 0
        ) {
            throw new Error("Invalid price");
        }

        if (
            !Number.isFinite(stock) ||
            stock < 0
        ) {
            throw new Error("Invalid stock");
        }

        return {
            title,
            price,
            stock
        };

    } finally {
        await browser.close();
    }
}

// =====================================================
// SAVE SUCCESSFUL SCRAPE
// =====================================================

async function saveScrape(
    url,
    result,
    attemptNumber
) {
    const {
        data: product,
        error: productError
    } = await supabase
        .from("products")
        .upsert(
            {
                name: result.title,
                url: url,
                sku: "NOR-10099"
            },
            {
                onConflict: "url"
            }
        )
        .select()
        .single();

    if (productError) {
        throw productError;
    }

    // Save ONLY successful scrape
    const {
        error: historyError
    } = await supabase
        .from("price_history")
        .insert({
            product_id: product.id,
            price: result.price,
            stock: result.stock
        });

    if (historyError) {
        throw historyError;
    }

    const {
        error: logError
    } = await supabase
        .from("scrape_logs")
        .insert({
            product_id: product.id,
            status: "success",
            attempt_number: attemptNumber
        });

    if (logError) {
        console.log(
            "Warning: success log failed:",
            logError.message
        );
    }

    console.log(
        "Saved to Supabase successfully."
    );
}

// =====================================================
// RETRY SCRAPER
// =====================================================

async function scrapeWithRetry(
    url,
    maxAttempts = 3,
    headed = false
) {
    let lastError;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {
        console.log(
            `\nScrape attempt ${attempt}/${maxAttempts}`
        );

        try {
            const result =
                await scrapeProduct(
                    url,
                    headed
                );

            console.log("SUCCESS");
            console.log(result);

            await saveScrape(
                url,
                result,
                attempt
            );

            return {
                success: true,
                attempts: attempt,
                ...result
            };

        } catch (error) {
            lastError = error;

            console.log(
                `FAILED: ${error.message}`
            );

            // Find existing product
            const {
                data: product
            } = await supabase
                .from("products")
                .select("id")
                .eq("url", url)
                .maybeSingle();

            // Log failed attempt
            if (product?.id) {
                await supabase
                    .from("scrape_logs")
                    .insert({
                        product_id: product.id,
                        status: "failed",
                        attempt_number: attempt,
                        error_message: error.message
                    });
            }

            if (attempt < maxAttempts) {
                const delay =
                    attempt * 2000;

                console.log(
                    `Retrying in ${delay / 1000} seconds...`
                );

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            delay
                        )
                );
            }
        }
    }

    return {
        success: false,
        attempts: maxAttempts,
        error:
            lastError?.message ||
            "Unknown scraping error"
    };
}

module.exports = {
    scrapeWithRetry
};