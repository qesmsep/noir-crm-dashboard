import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { questionnaireId, eventType, sessionId, completionTime, referrer } = await request.json();

    // Validate required fields
    if (!questionnaireId || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate event type
    const validEventTypes = ['view', 'start', 'complete', 'abandon'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Store analytics event
    const { error } = await supabase
      .from('questionnaire_analytics')
      .insert({
        questionnaire_id: questionnaireId,
        event_type: eventType,
        session_id: sessionId,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer: referrer,
        completion_time: completionTime,
      });

    if (error) {
      console.error('Error storing analytics event:', error);
      return NextResponse.json({ error: 'Failed to store analytics event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
} 