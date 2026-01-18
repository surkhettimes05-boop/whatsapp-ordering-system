# Migration Commands - Multi-Vendor System Setup

## Prerequisites
- PostgreSQL/SQLite database running
- Backend dependencies installed
- `.env` file configured with DATABASE_URL

---

## Step-by-Step Migration

### 1. Install Required Packages
```bash
cd backend
npm install geolib node-schedule lodash bcryptjs
```

**What this does:**
- `geolib`: Calculate distances between geographic coordinates
- `node-schedule`: Schedule tasks (timeout handling)
- `lodash`: Utility functions for data manipulation
- `bcryptjs`: Hash passwords for admin user (if not already installed)

---

### 2. Create Prisma Migration

```bash
npx prisma migrate dev --name add_multi_vendor_system
```

**What this does:**
- Reads the updated `schema.prisma`
- Creates SQL migration files
- Applies changes to your database
- Generates new Prisma Client

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

Applying migration `20260112_add_multi_vendor_system`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260112_add_multi_vendor_system/
      └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (5.x.x) to .\node_modules\@prisma\client
```

---

### 3. Verify Migration

```bash
npx prisma studio
```

**What this does:**
- Opens Prisma Studio in your browser (http://localhost:5555)
- Allows you to visually inspect the new tables:
  - ✓ Wholesaler
  - ✓ WholesalerProduct
  - ✓ OrderRouting
  - ✓ WholesalerRating

**Expected Tables:**
- Should see 4 new tables
- Updated Order table with `wholesalerId` field
- Updated Retailer table with location fields

---

### 4. Run Seed Data

```bash
node prisma/seed-wholesalers.js
```

**What this does:**
- Creates 4 test wholesalers with realistic data
- Creates 3 categories (Electronics, Groceries, FMCG)
- Creates 6 products
- Links products to wholesalers with different prices
- Creates 2 test retailers with GPS coordinates
- Creates admin user

**Expected Output:**
```
🌱 Starting seed...

📦 Creating wholesalers...
✅ Created 4 wholesalers

📂 Creating categories...
✅ Created 3 categories

📱 Creating products...
✅ Created 6 products

🏪 Linking products to wholesalers...
✅ Created wholesaler product listings

👥 Creating test retailers...
✅ Created 2 test retailers

👨‍💼 Creating admin user...
✅ Created admin user (Phone: 9779812345678, Password: admin123)

═══════════════════════════════════════
✨ SEED COMPLETED SUCCESSFULLY! ✨
═══════════════════════════════════════
```

---

### 5. Regenerate Prisma Client (if needed)

```bash
npx prisma generate
```

**What this does:**
- Regenerates the Prisma Client with new models
- Updates TypeScript types
- Ensures all relationships are properly typed

---

### 6. Verify Seed Data

```bash
npx prisma studio
```

**Check in Prisma Studio:**

1. **Wholesaler table** - Should have 4 entries:
   - Kathmandu Electronics Hub
   - Pokhara Premium Suppliers
   - Lalitpur Wholesale Mart
   - Bhaktapur Tech Solutions

2. **WholesalerProduct table** - Should have ~11 entries linking products to wholesalers

3. **Product table** - Should have 6 products:
   - iPhone 15 Pro
   - Samsung Galaxy S24
   - Dell Inspiron 15 Laptop
   - Basmati Rice 25kg
   - Sunflower Oil 5L
   - Tide Detergent 1kg

4. **Retailer table** - Should have 2 test retailers with coordinates

5. **User table** - Should have admin user

---

### 7. Test Database Connection

Create a test file: `backend/test-wholesaler-query.js`

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQueries() {
  // Test: Get all wholesalers
  const wholesalers = await prisma.wholesaler.findMany({
    include: {
      products: {
        include: {
          product: true
        }
      }
    }
  });
  
  console.log('Wholesalers:', wholesalers.length);
  console.log('First wholesaler:', JSON.stringify(wholesalers[0], null, 2));
  
  // Test: Find wholesalers near Kathmandu
  const kathmanduWholesalers = await prisma.wholesaler.findMany({
    where: {
      city: 'Kathmandu',
      isActive: true
    }
  });
  
  console.log('\nKathmandu wholesalers:', kathmanduWholesalers.length);
  
  await prisma.$disconnect();
}

testQueries();
```

Run it:
```bash
node test-wholesaler-query.js
```

**Expected Output:**
```
Wholesalers: 4
First wholesaler: {
  "id": "...",
  "businessName": "Kathmandu Electronics Hub",
  "city": "Kathmandu",
  ...
}

Kathmandu wholesalers: 1
```

---

## Troubleshooting

### Error: "Migration failed"
**Solution:**
```bash
# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Then re-run migration
npx prisma migrate dev --name add_multi_vendor_system
```

---

### Error: "bcryptjs not found" during seed
**Solution:**
```bash
npm install bcryptjs
```

---

### Error: "Cannot find module '@prisma/client'"
**Solution:**
```bash
npx prisma generate
npm install @prisma/client
```

---

### Error: "Database connection failed"
**Solution:**
1. Check `.env` file has correct `DATABASE_URL`
2. For SQLite: `DATABASE_URL="file:./dev.db"`
3. For PostgreSQL: `DATABASE_URL="postgresql://user:password@localhost:5432/dbname"`

---

### Error: "Seed fails on unique constraint"
**Solution:**
```bash
# Clear existing data first
npx prisma migrate reset --skip-seed

# Then run seed again
node prisma/seed-wholesalers.js
```

---

## Rollback (If Needed)

### To undo the migration:

```bash
# This will remove the last migration
npx prisma migrate dev --skip-seed
# When prompted, enter the name of the migration to remove
```

### To completely reset:

```bash
npx prisma migrate reset
```

**WARNING:** This deletes ALL data in your database!

---

## Next Steps After Migration

1. ✅ Migration complete
2. ✅ Seed data loaded
3. 🔄 Implement `orderRoutingService.js`
4. 🔄 Update WhatsApp controller
5. 🔄 Create wholesaler admin endpoints
6. 🔄 Test routing algorithm

---

## Verification Checklist

- [ ] Migration completed without errors
- [ ] Prisma Studio shows 4 new tables
- [ ] Seed script ran successfully
- [ ] 4 wholesalers created
- [ ] 6 products created
- [ ] WholesalerProduct links exist
- [ ] 2 retailers with coordinates
- [ ] Admin user exists (can log in with test credentials)
- [ ] Test query script runs successfully

---

## Database Backup (Recommended)

Before migration:
```bash
# For SQLite
cp prisma/dev.db prisma/dev.db.backup

# For PostgreSQL
pg_dump dbname > backup.sql
```

After migration (if successful):
```bash
# For SQLite
rm prisma/dev.db.backup

# For PostgreSQL
# Keep backup.sql for safety
```

---

## Support

If you encounter issues:
1. Check error messages carefully
2. Verify all prerequisites are met
3. Ensure database is running
4. Check `.env` configuration
5. Try `npx prisma migrate reset` and start fresh
