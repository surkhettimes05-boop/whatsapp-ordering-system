# Khaacho Website

Production-grade informational website for Khaacho, a WhatsApp-based B2B commerce platform in Nepal. Khaacho is a brand under New Bihani Group.

## Overview

Khaacho connects retailers and wholesalers using WhatsApp as the primary interface. This website serves as the informational and lead generation platform to establish brand credibility and convert visitors to WhatsApp onboarding.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React Icons**

## Project Structure

```
website/
├── app/
│   ├── api/
│   │   └── leads/
│   │       └── route.ts          # Lead capture API endpoint
│   ├── about/
│   │   └── page.tsx              # About New Bihani Group
│   ├── contact/
│   │   └── page.tsx              # Contact/Get Started page
│   ├── credit-records/
│   │   └── page.tsx              # Credit & Records System
│   ├── for-retailers/
│   │   └── page.tsx              # For Retailers page
│   ├── for-wholesalers/
│   │   └── page.tsx              # For Wholesalers page
│   ├── how-it-works/
│   │   └── page.tsx              # How It Works page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with Header/Footer
│   └── page.tsx                  # Home page
├── components/
│   ├── FlowDiagram.tsx           # Visual flow diagram component
│   ├── Footer.tsx                # Site footer
│   ├── Header.tsx                # Site header/navigation
│   ├── TrustIndicator.tsx        # Trust indicators component
│   └── WhatsAppButton.tsx        # WhatsApp deep link button
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Features

### Pages

1. **Home** - Value proposition, flow visualization, trust indicators
2. **How It Works** - Step-by-step explanation of the ordering process
3. **For Retailers** - Benefits and features for retailers
4. **For Wholesalers** - Benefits and features for wholesalers
5. **Credit & Records** - Explanation of credit management system
6. **About** - New Bihani Group overview and business credibility
7. **Contact** - Lead capture form and WhatsApp CTA

### Components

- **Header** - Responsive navigation with mobile menu
- **Footer** - Site links and contact information
- **WhatsAppButton** - Reusable WhatsApp deep link button
- **FlowDiagram** - Visual representation of the ordering flow
- **TrustIndicator** - Trust-building elements

### API Routes

- **POST /api/leads** - Captures lead information (name, phone, role)
  - Validates input
  - Returns success/error response
  - Ready for database integration

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the website directory:
```bash
cd website
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Configuration

### WhatsApp Phone Number

Update the WhatsApp phone number in:
- `components/WhatsAppButton.tsx` (default: `977XXXXXXXXX`)
- Replace with actual business WhatsApp number

### Lead Capture API

The `/api/leads` endpoint currently logs leads to console. To integrate with your backend:

1. Update `app/api/leads/route.ts`
2. Add database connection (e.g., Prisma, MongoDB)
3. Add notification service (email, SMS, WhatsApp Business API)

Example integration:
```typescript
// In app/api/leads/route.ts
import { saveLeadToDatabase } from '@/lib/database'
import { sendNotification } from '@/lib/notifications'

// In POST handler:
await saveLeadToDatabase({ name, phone, role })
await sendNotification({ name, phone, role })
```

## Design Guidelines

- **Professional & Minimal** - Clean, trustworthy design
- **No Hype Language** - Clear, factual copy
- **No Flashy Animations** - Subtle, professional interactions
- **Fintech + Supply Chain** - Visual language appropriate for B2B commerce
- **Fully Responsive** - Works on all device sizes

## SEO Optimization

- All pages include proper metadata
- Semantic HTML structure
- Descriptive page titles and descriptions
- Open Graph tags for social sharing

## Customization

### Colors

Update `tailwind.config.ts` to change the color scheme:
- Primary colors: Blue tones (currently `primary-*`)
- Accent colors: Purple tones (currently `accent-*`)

### Content

All content is in the page components. Update text directly in:
- `app/*/page.tsx` files for page content
- `components/*.tsx` for reusable component content

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Deploy automatically

### Other Platforms

The site can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- DigitalOcean App Platform
- Self-hosted with Node.js

## Notes

- **No Mobile App** - This is an informational website only
- **WhatsApp IS the Product** - All CTAs lead to WhatsApp
- **Nepal Context** - Content assumes Nepal market (Surkhet pilot)
- **Trust-Focused** - Design emphasizes credibility and transparency

## License

Private - New Bihani Group

## Support

For questions or issues, contact the development team.

