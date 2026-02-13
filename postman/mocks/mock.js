const http = require("http");

// Pre-seeded test accounts
const accounts = {
  "acc_123": { id: "acc_123", name: "Test User", balance: 200 },
  "acc_456": { id: "acc_456", name: "Premium User", balance: 500 },
  "acc_789": { id: "acc_789", name: "Low Balance User", balance: 10 },
  "acc_demo": { id: "acc_demo", name: "Demo Account", balance: 1000 }
};

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // GET /accounts/:accountId - Returns account details
  const getAccountMatch = url.match(/^\/accounts\/([^\/]+)$/);
  if (method === "GET" && getAccountMatch) {
    const accountId = decodeURIComponent(getAccountMatch[1]);
    const account = accounts[accountId];

    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "account not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ account }));
    return;
  }

  // POST /accounts/:accountId/credit - Charges or credits an account
  const creditMatch = url.match(/^\/accounts\/([^\/]+)\/credit$/);
  if (method === "POST" && creditMatch) {
    const accountId = decodeURIComponent(creditMatch[1]);
    const account = accounts[accountId];

    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "account not found" }));
      return;
    }

    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON body" }));
        return;
      }

      const { amount } = parsed;

      if (typeof amount !== "number" || Number.isNaN(amount)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "amount must be a number" }));
        return;
      }

      const newBalance = account.balance + amount;

      // Check for insufficient balance when charging (negative amount)
      if (amount < 0 && newBalance < 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "insufficient balance" }));
        return;
      }

      // Update the account balance
      account.balance = newBalance;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ balance: newBalance, currency: "USD" }));
    });
    return;
  }

  // Health check endpoint
  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "accounts-api-mock" }));
    return;
  }

  // Fallback for unmocked routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Mock route not defined", method, url }));
});

const PORT = process.env.PORT || 3002;
server.listen(PORT);
