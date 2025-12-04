import { NextResponse } from 'next/server';
import ical from 'node-ical';
import { DateTime } from 'luxon';

interface MinakaEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  guest_count?: number;
  client_name?: string;
  client_email?: string;
  location?: string;
  minaka_url?: string;
  source: 'minaka';
}

export async function GET(request: Request) {
  try {
    const minakaCalendarUrl = process.env.MINAKA_CALENDAR_URL;
    
    if (!minakaCalendarUrl) {
      return NextResponse.json(
        { error: 'Minaka calendar URL not configured' },
        { status: 500 }
      );
    }

    // Fetch the iCal feed
    const response = await fetch(minakaCalendarUrl, {
      headers: {
        'Accept': 'text/calendar',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Minaka calendar: ${response.statusText}`);
    }

    const icalData = await response.text();
    
    // Parse the iCal data
    const parsed = ical.parseICS(icalData);
    
    // Convert to our event format
    const events: MinakaEvent[] = [];
    
    for (const key in parsed) {
      const event = parsed[key];
      
      // Only process VEVENT entries
      if (event.type === 'VEVENT') {
        // Parse dates - handle timezone
        let startDate: Date;
        let endDate: Date;
        
        if (event.start && event.end) {
          // node-ical parses iCal dates with timezone info
          // For dates with TZID=America/Chicago, we need to parse the date string manually
          // because JavaScript Date doesn't preserve the original timezone
          
          // Get the raw date string from the event if available
          // Format: DTSTART;TZID=America/Chicago:20251205T180000
          let startDateStr: string | undefined;
          let endDateStr: string | undefined;
          
          // Try to get the date string from the event properties
          if (event.start && typeof event.start === 'object' && 'val' in event.start) {
            startDateStr = (event.start as any).val;
          } else if (typeof event.start === 'string') {
            startDateStr = event.start;
          }
          
          if (event.end && typeof event.end === 'object' && 'val' in event.end) {
            endDateStr = (event.end as any).val;
          } else if (typeof event.end === 'string') {
            endDateStr = event.end;
          }
          
          let startUTC: string;
          let endUTC: string;
          
          // Parse date string in format: 20251205T180000 (YYYYMMDDTHHMMSS)
          // This is in America/Chicago timezone
          if (startDateStr && /^\d{8}T\d{6}$/.test(startDateStr)) {
            const year = parseInt(startDateStr.substring(0, 4), 10);
            const month = parseInt(startDateStr.substring(4, 6), 10);
            const day = parseInt(startDateStr.substring(6, 8), 10);
            const hour = parseInt(startDateStr.substring(9, 11), 10);
            const minute = parseInt(startDateStr.substring(11, 13), 10);
            const second = parseInt(startDateStr.substring(13, 15), 10);
            
            const startCST = DateTime.fromObject(
              { year, month, day, hour, minute, second },
              { zone: 'America/Chicago' }
            );
            startUTC = startCST.toUTC().toISO() || '';
          } else {
            // Fallback to Date object (node-ical may have parsed it)
            startDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
            startUTC = startDate.toISOString();
          }
          
          if (endDateStr && /^\d{8}T\d{6}$/.test(endDateStr)) {
            const year = parseInt(endDateStr.substring(0, 4), 10);
            const month = parseInt(endDateStr.substring(4, 6), 10);
            const day = parseInt(endDateStr.substring(6, 8), 10);
            const hour = parseInt(endDateStr.substring(9, 11), 10);
            const minute = parseInt(endDateStr.substring(11, 13), 10);
            const second = parseInt(endDateStr.substring(13, 15), 10);
            
            const endCST = DateTime.fromObject(
              { year, month, day, hour, minute, second },
              { zone: 'America/Chicago' }
            );
            endUTC = endCST.toUTC().toISO() || '';
          } else {
            endDate = typeof event.end === 'string' ? new Date(event.end) : event.end;
            endUTC = endDate.toISOString();
          }
          
          // Extract event details
          const summary = event.summary || 'Untitled Event';
          const description = event.description || '';
          const location = event.location || '';
          const uid = event.uid || key;
          
          // Parse description for guest count, client info, etc.
          let guestCount: number | undefined;
          let clientName: string | undefined;
          let clientEmail: string | undefined;
          let minakaUrl: string | undefined;
          
          if (description) {
            // Extract guest count
            const guestMatch = description.match(/Guest Count:\s*(\d+)/i);
            if (guestMatch) {
              guestCount = parseInt(guestMatch[1], 10);
            }
            
            // Extract client name
            const clientMatch = description.match(/Client:\s*([^\n]+)/i);
            if (clientMatch) {
              clientName = clientMatch[1].trim();
            }
            
            // Extract email
            const emailMatch = description.match(/Email:\s*([^\s\n]+)/i);
            if (emailMatch) {
              clientEmail = emailMatch[1].trim();
            }
            
            // Extract Minaka URL
            const urlMatch = description.match(/https?:\/\/[^\s\n]+/i);
            if (urlMatch) {
              minakaUrl = urlMatch[0].trim();
            }
          }
          
          events.push({
            id: `minaka-${uid}`,
            title: summary,
            start_time: startUTC,
            end_time: endUTC,
            description: description || undefined,
            guest_count: guestCount,
            client_name: clientName,
            client_email: clientEmail,
            location: location || undefined,
            minaka_url: minakaUrl,
            source: 'minaka',
          });
        }
      }
    }
    
    // Sort events by start time
    events.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    return NextResponse.json({ data: events });
  } catch (error: any) {
    console.error('Error fetching Minaka events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Minaka events', details: error.message },
      { status: 500 }
    );
  }
}

