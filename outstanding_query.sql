-- Query to fetch outstanding balances per retailer per wholesaler
-- Uses PostgreSQL DISTINCT ON to get the latest entry for each pair

SELECT DISTINCT ON ("retailerId", "wholesalerId")
    "retailerId",
    "wholesalerId",
    "balanceAfter" as "outstandingBalance",
    "createdAt" as "lastUpdated"
FROM "LedgerEntry"
ORDER BY "retailerId", "wholesalerId", "createdAt" DESC;
