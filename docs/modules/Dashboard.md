# Dashboard Module

**Version:** 1.0.0
**Status:** Approved
**Sprint:** Sprint 09
**Last Updated:** 2026-07-10
**Owner:** Zaping Team

---

# 1. Overview

## Purpose

The Dashboard module provides a real-time overview of the company's operational and commercial performance.

Its objective is to transform operational data into actionable information for managers, sales representatives and administrators.

The Dashboard does not store information.

It consumes data from other modules and presents aggregated metrics.

---

## Business Goals

- Display business health.
- Detect operational problems quickly.
- Support business decisions.
- Improve productivity.
- Centralize KPIs.
- Reduce time spent generating reports.

---

# 2. Scope

### Included

- KPI cards
- Charts
- Operational alerts
- Activity timeline
- Inventory alerts
- Sales summary
- Purchase summary

### Excluded

- Report generation
- Data exports
- Advanced Business Intelligence
- Predictive analytics

---

# 3. Dashboard Layout

```
──────────────────────────────────────────

Header

Global Filters

KPI Cards

Sales Charts

Purchases Charts

Inventory Charts

Recent Activity

Alerts

Quick Actions

──────────────────────────────────────────
```

---

# 4. KPI Cards

Initial KPIs

- Today's Sales
- Monthly Sales
- Active Customers
- Products
- Inventory Value
- Low Stock
- Quotes Pending
- Purchases This Month

Each KPI should display:

- Current value
- Comparison vs previous period
- Trend indicator
- Percentage variation

---

# 5. Charts

Sales

- Daily Sales
- Monthly Sales
- Sales by Customer
- Sales by Salesperson

Purchases

- Monthly Purchases
- Purchases by Supplier

Inventory

- Top Products
- Low Stock
- Inventory Value
- Products Near Expiration

---

# 6. Activity Timeline

Display the latest system events.

Examples:

- Purchase created.
- Sale confirmed.
- Inventory adjusted.
- Customer registered.
- Quote accepted.

---

# 7. Alerts

The Dashboard should show business alerts.

Examples

- Product out of stock.
- Product expiring soon.
- Pending quotes.
- Inventory mismatch.
- Failed synchronization.
- High sales volume.
- Purchase awaiting approval (future).

Alerts should be prioritized by severity:

Critical

High

Medium

Low

---

# 8. Quick Actions

Allow direct access to common operations.

- New Sale
- New Purchase
- New Customer
- New Product
- Create Quote
- Inventory Adjustment

---

# 9. Business Rules

The Dashboard never modifies data.

It only consumes information.

All calculations should come from centralized services.

Business logic must never exist inside dashboard components.

---

# 10. Permissions

| Permission | Description |
|------------|-------------|
| dashboard.read | View Dashboard |
| dashboard.export | Export metrics |

---

# 11. Integrations

| Module | Information |
|---------|-------------|
| Sales | Revenue |
| Purchases | Expenses |
| Inventory | Stock |
| Products | Catalog |
| Customers | Customer metrics |
| Suppliers | Supplier metrics |
| Audit | Activity timeline |
| Notifications | Alerts |

---

# 12. KPIs

Commercial

- Revenue
- Quotes
- Conversion Rate
- Average Ticket

Inventory

- Current Stock
- Low Stock
- Inventory Value

Customers

- New Customers
- Active Customers
- Top Customers

Purchases

- Purchase Volume
- Top Suppliers

System

- Active Users
- API Requests
- Errors (future)

---

# 13. Technical Architecture

```
Sales Service
Purchases Service
Inventory Service
Customers Service
Products Service
        │
        ▼
Dashboard Service
        │
        ▼
Dashboard API
        │
        ▼
Frontend Dashboard
```

DashboardService should aggregate data from multiple modules.

Frontend components should never query each module independently.

---

# 14. Performance

Dashboard requests should complete in under 500 ms under normal operating conditions.

Metrics should be computed using optimized aggregate queries.

Expensive calculations should be cached when appropriate.

---

# 15. Future Roadmap

Phase 1

- KPI Cards
- Charts
- Timeline
- Alerts

Phase 2

- Custom Dashboards
- Favorite Widgets
- Saved Filters

Phase 3

- Drag & Drop Widgets
- Role-based Dashboards
- Export to PDF
- Export to Excel

Phase 4

- AI Insights
- Predictive Analytics
- Smart Recommendations
- Natural Language Queries

---

# 16. Future Improvements

- Multi-company dashboards.
- Branch comparison.
- Geographic maps.
- Executive dashboard.
- Financial dashboard.
- Warehouse dashboard.
- Mobile dashboard.