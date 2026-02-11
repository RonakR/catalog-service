const express = require("express");

const app = express();
app.use(express.json());

const ACCOUNTS_BASE_URL =
  process.env.ACCOUNTS_BASE_URL || "http://accounts-api:3002";
const CHARGE_ON_ASSIGN = process.env.CHARGE_ON_ASSIGN === "true";

const productsById = new Map();
const assignmentsByAccountId = new Map();
let productCounter = 1;
let assignmentCounter = 1;

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const error = new Error(data.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function ensureAccountExists(accountId) {
  const data = await fetchJson(
    `${ACCOUNTS_BASE_URL}/accounts/${encodeURIComponent(accountId)}`
  );
  return data.account || data;
}

function createProduct({ name, price, category }) {
  const id = `p${productCounter++}`;
  const product = { id, name, price, category };
  productsById.set(id, product);
  return product;
}

function createAssignment({ accountId, productId }) {
  const id = `as${assignmentCounter++}`;
  const assignment = {
    id,
    accountId,
    productId,
    createdAt: new Date().toISOString(),
  };
  const existing = assignmentsByAccountId.get(accountId) || [];
  existing.push(assignment);
  assignmentsByAccountId.set(accountId, existing);
  return assignment;
}

/**
 * POST /products
 * Create a product.
 *
 * Request body:
 * {
 *   "name": "Pro plan",
 *   "price": 49,
 *   "category": "subscriptions"
 * }
 *
 * Response 201:
 * {
 *   "product": {
 *     "id": "p1",
 *     "name": "Pro plan",
 *     "price": 49,
 *     "category": "subscriptions"
 *   }
 * }
 *
 * Errors:
 * 400 { "error": "name is required" }
 * 400 { "error": "price must be a number" }
 */
app.post("/products", (req, res) => {
  const { name, price = 0, category = "general" } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  if (typeof price !== "number" || Number.isNaN(price)) {
    return res.status(400).json({ error: "price must be a number" });
  }
  const product = createProduct({ name, price, category });
  return res.status(201).json({ product });
});

/**
 * GET /products/all
 * Return all products.
 *
 * Response 200:
 * {
 *   "products": [
 *     { "id": "p1", "name": "Pro plan", "price": 49, "category": "subscriptions" }
 *   ]
 * }
 */
app.get("/products/all", (_req, res) => {
  const products = Array.from(productsById.values());
  return res.json({ products });
});

/**
 * GET /products/:id
 * Return a single product by id.
 *
 * Response 200:
 * {
 *   "product": { "id": "p1", "name": "Pro plan", "price": 49, "category": "subscriptions" }
 * }
 *
 * Error 404:
 * { "error": "product not found" }
 */
app.get("/products/:id", (req, res) => {
  const product = productsById.get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: "product not found" });
  }
  return res.json({ product });
});

/**
 * GET /products?category=...
 * Return products filtered by category. If category is omitted, all products are returned.
 *
 * Response 200:
 * {
 *   "products": [
 *     { "id": "p1", "name": "Pro plan", "price": 49, "category": "subscriptions" }
 *   ]
 * }
 */
app.get("/products", (req, res) => {
  const { category } = req.query || {};
  const products = Array.from(productsById.values()).filter((product) => {
    if (!category) {
      return true;
    }
    return product.category === category;
  });
  return res.json({ products });
});

/**
 * POST /products/:id/assign
 * Assign a product to an account. If CHARGE_ON_ASSIGN=true and price is numeric,
 * the accounts service is charged.
 *
 * Request body:
 * { "accountId": "acc_123" }
 *
 * Response 201:
 * {
 *   "assignment": {
 *     "id": "as1",
 *     "accountId": "acc_123",
 *     "productId": "p1",
 *     "createdAt": "2026-02-10T12:00:00.000Z"
 *   },
 *   "charge": {
 *     "balance": 151,
 *     "currency": "USD"
 *   }
 * }
 *
 * Errors:
 * 400 { "error": "accountId is required" }
 * 404 { "error": "product not found" }
 */
app.post("/products/:id/assign", async (req, res) => {
  try {
    const product = productsById.get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "product not found" });
    }
    const { accountId } = req.body || {};
    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }
    await ensureAccountExists(accountId);
    const assignment = createAssignment({
      accountId,
      productId: product.id,
    });

    let charge;
    if (CHARGE_ON_ASSIGN && typeof product.price === "number") {
      charge = await fetchJson(
        `${ACCOUNTS_BASE_URL}/accounts/${encodeURIComponent(
          accountId
        )}/credit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: -product.price }),
        }
      );
    }

    return res.status(201).json({ assignment, charge });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * GET /assignments?accountId=...
 * Return assignments for an account.
 *
 * Response 200:
 * {
 *   "assignments": [
 *     {
 *       "id": "as1",
 *       "accountId": "acc_123",
 *       "productId": "p1",
 *       "createdAt": "2026-02-10T12:00:00.000Z"
 *     }
 *   ]
 * }
 *
 * Error 400:
 * { "error": "accountId query is required" }
 */
app.get("/assignments", (req, res) => {
  const { accountId } = req.query || {};
  if (!accountId) {
    return res.status(400).json({ error: "accountId query is required" });
  }
  const assignments = assignmentsByAccountId.get(accountId) || [];
  return res.json({ assignments });
});

/**
 * GET /health
 * Service health check.
 *
 * Response 200:
 * { "status": "ok", "service": "catalog-api" }
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "catalog-api" });
});

const port = Number(process.env.PORT) || 3003;
app.listen(port, () => {
  console.log(`catalog-api listening on port ${port}`);
});
