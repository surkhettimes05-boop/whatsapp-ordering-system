# Khaacho Website Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd website
   npm install
   ```

2. **Configure WhatsApp Number** (Optional)
   Create a `.env.local` file:
   ```
   NEXT_PUBLIC_WHATSAPP_NUMBER=977XXXXXXXXX
   ```
   Replace with your actual WhatsApp Business number.

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Build
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Deploy to Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variable `NEXT_PUBLIC_WHATSAPP_NUMBER`
4. Deploy

## Customization Checklist

- [ ] Update WhatsApp phone number in `.env.local` or `components/WhatsAppButton.tsx`
- [ ] Update contact email in `components/Footer.tsx`
- [ ] Customize colors in `tailwind.config.ts` if needed
- [ ] Update company information in `app/about/page.tsx`
- [ ] Integrate lead capture API with your backend/database
- [ ] Add analytics (Google Analytics, etc.) if needed
- [ ] Update meta descriptions for SEO
- [ ] Add actual business address/contact details

## Lead Capture Integration

The `/api/leads` endpoint currently logs to console. To integrate:

1. **Add Database**
   - Install Prisma or your preferred ORM
   - Create `Lead` model
   - Update `app/api/leads/route.ts` to save to database

2. **Add Notifications**
   - Email notification to sales team
   - WhatsApp Business API integration
   - CRM system integration (e.g., HubSpot, Salesforce)

3. **Example Integration**
   ```typescript
   // In app/api/leads/route.ts
   import { prisma } from '@/lib/prisma'
   import { sendEmail } from '@/lib/email'
   
   // Save to database
   await prisma.lead.create({
     data: { name, phone, role }
   })
   
   // Send notification
   await sendEmail({
     to: 'sales@khaacho.com',
     subject: 'New Lead',
     body: `New ${role}: ${name} - ${phone}`
   })
   ```

## Testing

### Test Lead Capture
1. Navigate to `/contact`
2. Fill out the form
3. Submit and check console for logged lead
4. Verify form validation works

### Test WhatsApp Links
1. Click any WhatsApp button
2. Verify it opens WhatsApp with correct number and message
3. Test on mobile device to ensure deep linking works

### Test Responsive Design
1. Test on mobile (375px width)
2. Test on tablet (768px width)
3. Test on desktop (1024px+ width)
4. Verify navigation menu works on mobile

## Troubleshooting

### Build Errors
- Ensure Node.js 18+ is installed
- Delete `node_modules` and `.next` folder, then reinstall
- Check TypeScript errors: `npm run lint`

### WhatsApp Links Not Working
- Verify phone number format (country code + number, no + or spaces)
- Test on actual device (desktop may not support deep links)
- Check `NEXT_PUBLIC_WHATSAPP_NUMBER` environment variable

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check `tailwind.config.ts` paths
- Verify `globals.css` is imported in `layout.tsx`

## Next Steps

1. **Content Review**
   - Review all page content for accuracy
   - Update with real business information
   - Add actual testimonials/case studies if available

2. **SEO Optimization**
   - Add structured data (JSON-LD)
   - Submit sitemap to Google Search Console
   - Optimize images (add actual images if available)

3. **Analytics**
   - Add Google Analytics
   - Track form submissions
   - Monitor WhatsApp link clicks

4. **Performance**
   - Optimize images
   - Enable Next.js Image Optimization
   - Test Lighthouse scores

5. **Security**
   - Add rate limiting to API routes
   - Add CAPTCHA to form (optional)
   - Implement CSRF protection

## Support

For issues or questions, contact the development team.

