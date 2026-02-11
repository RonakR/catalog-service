# Catalog API — README.md

## Overview

The Catalog API manages products and product assignments. It is deployed by the `accounts-api` orchestrator.

### Endpoints

* POST `/products`
* GET `/products/all`
* GET `/products/:id`
* GET `/products?category=...`
* POST `/products/:id/assign`
* GET `/assignments?accountId=...`
* GET `/health`

### Local Development

```bash
npm install
node src/index.js
```

Default port: `3003`

Health check:

```bash
curl http://localhost:3003/health
```

### Kubernetes

Defines:

* Namespace: `catalog`
* Deployment: `catalog-api`
* Service: `catalog-api`

Cluster creation, ingress, and Insights agent installation are handled by `accounts-api`.