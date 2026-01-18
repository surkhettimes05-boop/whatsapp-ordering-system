# Setup Guide

## Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Setup Database**
```bash
# Make sure PostgreSQL is running
# Update DATABASE_URL in .env

# Run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

4. **Create Admin User** (Optional - via API or database)
```sql
-- Insert admin user directly into database
-- Password should be hashed with bcrypt
```

5. **Start Server**
```bash
npm run dev
```

## WhatsApp Business API Setup

1. **Get WhatsApp Business API Credentials**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a Business App
   - Add WhatsApp Product
   - Get Phone Number ID and Access Token

2. **Configure Webhook**
   - Webhook URL: `https://your-domain.com/api/v1/whatsapp/webhook`
   - Verify Token: Set in `.env` as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to `messages` events

3. **Test Webhook**
   - Send a message to your WhatsApp Business number
   - Check server logs for incoming messages

## Database Migrations

After updating `schema.prisma`:

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy
```

## File Storage

By default, files are stored in `backend/uploads/`. For production:

1. **Use Cloud Storage (S3/Cloudinary)**
   - Update `fileStorage.service.js` to use cloud storage
   - Configure credentials in `.env`

2. **Serve Static Files**
   - Already configured in `app.js`
   - Files accessible at `/uploads/*`

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET`
- [ ] Configure HTTPS/SSL
- [ ] Set up proper CORS origins
- [ ] Use production database
- [ ] Configure cloud file storage
- [ ] Set up monitoring/logging
- [ ] Configure backup strategy
- [ ] Set up rate limiting
- [ ] Enable request validation

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` format
- Ensure PostgreSQL is running
- Verify database exists
- Check firewall/network settings

### WhatsApp Webhook Not Working
- Verify webhook URL is accessible
- Check `WHATSAPP_VERIFY_TOKEN` matches
- Ensure HTTPS is configured
- Check Meta App permissions

### Prisma Client Not Found
```bash
npx prisma generate
```

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process using the port

