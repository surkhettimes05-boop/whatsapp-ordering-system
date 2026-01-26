import { NextRequest, NextResponse } from 'next/server'

interface LeadData {
  name: string
  phone: string
  role: 'retailer' | 'wholesaler'
}

export async function POST(request: NextRequest) {
  try {
    const body: LeadData = await request.json()
    const { name, phone, role } = body

    // Validate required fields
    if (!name || !phone || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate role
    if (role !== 'retailer' && role !== 'wholesaler') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Basic phone validation (Nepal format)
    const phoneRegex = /^9[6-8]\d{8}$/
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // In a production environment, you would:
    // 1. Save to database (e.g., PostgreSQL, MongoDB)
    // 2. Send notification email/SMS
    // 3. Create task in CRM system
    // 4. Send to WhatsApp Business API for follow-up

    // For now, we'll log the lead (in production, save to database)
    console.log('New lead received:', {
      name,
      phone,
      role,
      timestamp: new Date().toISOString(),
    })

    // TODO: Integrate with your backend/database
    // Example:
    // await saveLeadToDatabase({ name, phone, role })
    // await sendNotification({ name, phone, role })

    return NextResponse.json(
      { 
        message: 'Lead captured successfully',
        data: { name, phone, role }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

