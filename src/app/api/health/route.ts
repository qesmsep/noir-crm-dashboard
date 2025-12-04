import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Health check endpoint
 * Returns system health status including database connectivity
 *
 * @returns Health status information
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks: {
      database: 'unknown',
      api: 'healthy',
    },
    responseTime: 0,
  };

  try {
    // Create supabase client inline to avoid import issues during build
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Test database connection with a simple query
      const { error } = await supabase
        .from('members')
        .select('count')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is actually OK for health check
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
      } else {
        health.checks.database = 'healthy';
      }
    } else {
      health.checks.database = 'not configured';
      health.status = 'degraded';
    }
  } catch (error) {
    console.error('Health check database error:', error);
    health.checks.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': health.status,
    }
  });
}

/**
 * HEAD request for simple health check
 * Returns 200 if service is running
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
