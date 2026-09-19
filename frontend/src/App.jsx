import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import "./App.css";

const API = "http://localhost:3000";

function App() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [trackingSku, setTrackingSku] = useState(null);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const selectedProduct = products.find(
    (product) =>
      String(product.id) === String(selectedId)
  );

  const loadTrackedProducts = async () => {
    try {
      const response = await fetch(
        `${API}/api/products`
      );

      const data = await response.json();

      const trackedProducts =
        data.products || [];

      setProducts(trackedProducts);

      if (
        trackedProducts.length > 0 &&
        !selectedId
      ) {
        setSelectedId(
          trackedProducts[0].id
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTrackedProducts()
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    fetch(
      `${API}/api/products/${selectedId}/history`
    )
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || []);
      })
      .catch((error) => {
        console.error(error);
      });

    fetch(
      `${API}/api/products/${selectedId}/logs`
    )
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs || []);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [selectedId]);

  const handleSearch = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setMessage("");

      const response = await fetch(
        `${API}/api/search-products?q=${encodeURIComponent(
          query
        )}`
      );

      const data = await response.json();

      if (data.success) {
        setSearchResults(
          data.products || []
        );
      } else {
        setSearchResults([]);
      }

    } catch (error) {
      console.error(error);

      setSearchResults([]);

      setMessage(
        "Unable to search products."
      );
    } finally {
      setSearching(false);
    }
  };

  const handleTrackProduct = async (product) => {
    try {
      setTrackingSku(product.sku);
      setMessage("");

      const response = await fetch(
        `${API}/api/products/track`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            name: product.name,
            brand: product.brand,
            sku: product.sku,
            url: product.url
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.error ||
            "Unable to track product"
        );
      }

      setMessage(
        `${product.name} is now being tracked.`
      );

      await loadTrackedProducts();

      setSelectedId(data.product.id);

    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Unable to track product."
      );
    } finally {
      setTrackingSku(null);
    }
  };

  const latest =
    history.length > 0
      ? history[history.length - 1]
      : null;

  const chartData = history.map(
    (item) => ({
      date: new Date(
        item.scraped_at
      ).toLocaleString(),
      price: Number(item.price)
    })
  );

  if (loading) {
    return (
      <div className="loading">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="app">

      <header className="header">

        <div>
          <h1>
            INE Price Tracker
          </h1>

          <p>
            Monitor product prices and
            stock over time
          </p>
        </div>

        <div className="status">
          <span></span>
          Live Tracking
        </div>

      </header>

      <main className="container">

        <div className="selector-card">

          <label>
            Search Products
          </label>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px"
            }}
          >

            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Search by product name, brand or SKU..."
              style={{
                flex: 1,
                padding: "12px",
                border:
                  "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px"
              }}
            />

            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding:
                  "12px 20px",
                border: "none",
                borderRadius: "8px",
                background:
                  "#6366f1",
                color: "white",
                cursor:
                  searching
                    ? "not-allowed"
                    : "pointer",
                fontSize: "16px"
              }}
            >
              {searching
                ? "Searching..."
                : "Search"}
            </button>

          </div>

        </div>

        {message && (
          <div
            style={{
              background:
                "#eef2ff",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              color: "#3730a3"
            }}
          >
            {message}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="history-card">

            <h2>
              Search Results (
              {searchResults.length})
            </h2>

            <table>

              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>SKU</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {searchResults.map(
                  (product) => {

                    const alreadyTracked =
                      products.some(
                        (item) =>
                          item.sku ===
                          product.sku
                      );

                    return (
                      <tr
                        key={
                          product.sku
                        }
                      >

                        <td>
                          {product.name}
                        </td>

                        <td>
                          {product.brand}
                        </td>

                        <td>
                          {product.sku}
                        </td>

                        <td>

                          <a
                            href={
                              product.url
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              marginRight:
                                "15px"
                            }}
                          >
                            View →
                          </a>

                          <button
                            onClick={() =>
                              handleTrackProduct(
                                product
                              )
                            }
                            disabled={
                              alreadyTracked ||
                              trackingSku ===
                                product.sku
                            }
                            style={{
                              padding:
                                "8px 12px",
                              border: "none",
                              borderRadius:
                                "6px",
                              background:
                                alreadyTracked
                                  ? "#9ca3af"
                                  : "#16a34a",
                              color:
                                "white",
                              cursor:
                                alreadyTracked
                                  ? "default"
                                  : "pointer"
                            }}
                          >
                            {trackingSku ===
                            product.sku
                              ? "Tracking..."
                              : alreadyTracked
                              ? "Tracked"
                              : "Track Product"}
                          </button>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

        {searchQuery &&
          !searching &&
          searchResults.length === 0 && (
            <div className="history-card">
              <p className="empty">
                No products found.
              </p>
            </div>
          )}

        <div className="selector-card">

          <label>
            Select Tracked Product
          </label>

          <select
            value={selectedId}
            onChange={(e) =>
              setSelectedId(
                e.target.value
              )
            }
          >

            {products.map(
              (product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                </option>
              )
            )}

          </select>

        </div>

        {selectedProduct && (
          <>

            <div className="product-card">

              <div>
                <h2>
                  {selectedProduct.name}
                </h2>

                <p>
                  SKU:{" "}
                  {selectedProduct.sku ||
                    "N/A"}
                </p>
              </div>

              <a
                href={
                  selectedProduct.url
                }
                target="_blank"
                rel="noreferrer"
              >
                View Store →
              </a>

            </div>

            <div className="stats">

              <div className="stat-card">
                <p>
                  Current Price
                </p>

                <h2>
                  {latest
                    ? `₹${Number(
                        latest.price
                      ).toLocaleString()}`
                    : "—"}
                </h2>
              </div>

              <div className="stat-card">
                <p>Stock</p>

                <h2>
                  {latest
                    ? latest.stock
                    : "—"}
                </h2>
              </div>

              <div className="stat-card">
                <p>
                  Total Scrapes
                </p>

                <h2>
                  {history.length}
                </h2>
              </div>

              <div className="stat-card">
                <p>
                  Last Updated
                </p>

                <h2 className="small">
                  {latest
                    ? new Date(
                        latest.scraped_at
                      ).toLocaleString()
                    : "—"}
                </h2>
              </div>

            </div>

            <div className="chart-card">

              <h2>
                Price History
              </h2>

              {chartData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={350}
                >
                  <LineChart
                    data={chartData}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="date"
                    />

                    <YAxis />

                    <Tooltip
                      formatter={(
                        value
                      ) =>
                        `₹${Number(
                          value
                        ).toLocaleString()}`
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />

                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">
                  No price history
                  available.
                </p>
              )}

            </div>

            <div className="history-card">

              <h2>
                Scrape History
              </h2>

              <table>

                <thead>
                  <tr>
                    <th>
                      Date & Time
                    </th>
                    <th>
                      Price
                    </th>
                    <th>
                      Stock
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {[...history]
                    .reverse()
                    .map((item) => (
                      <tr
                        key={item.id}
                      >

                        <td>
                          {new Date(
                            item.scraped_at
                          ).toLocaleString()}
                        </td>

                        <td>
                          ₹
                          {Number(
                            item.price
                          ).toLocaleString()}
                        </td>

                        <td>
                          {item.stock}
                        </td>

                      </tr>
                    ))}

                </tbody>

              </table>

            </div>

            <div className="history-card">

              <h2>
                Scrape Logs
              </h2>

              {logs.length > 0 ? (
                <table>

                  <thead>
                    <tr>
                      <th>
                        Date & Time
                      </th>
                      <th>
                        Attempt
                      </th>
                      <th>
                        Status
                      </th>
                      <th>
                        Error
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {logs.map(
                      (log) => (
                        <tr
                          key={
                            log.id
                          }
                        >

                          <td>
                            {new Date(
                              log.attempted_at
                            ).toLocaleString()}
                          </td>

                          <td>
                            #
                            {
                              log.attempt_number
                            }
                          </td>

                          <td>
                            {
                              log.status
                            }
                          </td>

                          <td>
                            {log.error_message ||
                              "—"}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>
              ) : (
                <p className="empty">
                  No scrape logs
                  available.
                </p>
              )}

            </div>

          </>
        )}

      </main>

    </div>
  );
}

export default App;