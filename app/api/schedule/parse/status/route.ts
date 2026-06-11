import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { createAdminClient } from '@/src/lib/supabase-admin';

// Poll target for the async schedule parse (see ../route.ts). Quick and cheap
// by design — each poll is a fresh request, so VPNs/proxies that kill long
// idle connections never see one. Only the job's creator can read it.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get('job');
  if (!jobId) {
    return NextResponse.json({ error: 'missing_job' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from('schedule_parse_jobs')
    .select('status, result, error_code, error_detail')
    .eq('id', jobId)
    .eq('created_by', user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (job.status === 'done') {
    return NextResponse.json({ status: 'done', result: job.result });
  }
  if (job.status === 'error') {
    return NextResponse.json({
      status: 'error',
      error: job.error_code ?? 'server_error',
      detail: job.error_detail ?? undefined,
    });
  }
  return NextResponse.json({ status: 'working' });
}
