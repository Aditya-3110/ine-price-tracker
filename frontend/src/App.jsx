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
  const [loading, setLoading] = useState(true);

  const selectedProduct = products.find(
    (product) => String(product.id) === String(selectedId)
  );

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);

        if (data.products?.length > 0) {
          setSelectedId(data.products[0].id);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    fetch(`${API}/api/products/${selectedId}/history`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || []);
      })
      .catch((error) => console.error(error));
  }, [selectedId]);

  const latest = history.length > 0 ? history[history.length - 1] : null;

  const chartData = history.map((item) => ({
    date: new Date(item.scraped_at).toLocaleString(),
    price: Number(item.price)
  }));

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>INE Price Tracker</h1>
          <p>Monitor product prices and stock over time</p>
        </div>

        <div className="status">
          <span></span>
          Live Tracking
        </div>
      </header>

      <main className="container">
        <div className="selector-card">
          <label>Select Product</label>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <>
            <div className="product-card">
              <div>
                <h2>{selectedProduct.name}</h2>
                <p>SKU: {selectedProduct.sku || "N/A"}</p>
              </div>

              <a
                href={selectedProduct.url}
                target="_blank"
                rel="noreferrer"
              >
                View Store →
              </a>
            </div>

            <div className="stats">
              <div className="stat-card">
                <p>Current Price</p>
                <h2>
                  {latest ? `₹${Number(latest.price).toLocaleString()}` : "—"}
                </h2>
              </div>

              <div className="stat-card">
                <p>Stock</p>
                <h2>{latest ? latest.stock : "—"}</h2>
              </div>

              <div className="stat-card">
                <p>Total Scrapes</p>
                <h2>{history.length}</h2>
              </div>

              <div className="stat-card">
                <p>Last Updated</p>
                <h2 className="small">
                  {latest
                    ? new Date(latest.scraped_at).toLocaleString()
                    : "—"}
                </h2>
              </div>
            </div>

            <div className="chart-card">
              <h2>Price History</h2>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        `₹${Number(value).toLocaleString()}`
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
                <p className="empty">No price history available.</p>
              )}
            </div>

            <div className="history-card">
              <h2>Scrape History</h2>

              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>

                <tbody>
                  {[...history].reverse().map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.scraped_at).toLocaleString()}
                      </td>
                      <td>₹{Number(item.price).toLocaleString()}</td>
                      <td>{item.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;