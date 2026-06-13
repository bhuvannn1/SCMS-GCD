require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://xyzxyz.supabase.co
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

const sql = `
CREATE TABLE IF NOT EXISTS public.buyer_warehouses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text,
  pincode text,
  contact_name text,
  contact_phone text,
  notes text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.buyer_warehouses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Buyers can manage their own warehouses" ON public.buyer_warehouses;
DROP POLICY IF EXISTS "Sellers can view all buyer warehouses" ON public.buyer_warehouses;

-- Buyers can CRUD their own warehouses
CREATE POLICY "Buyers can manage their own warehouses"
  ON public.buyer_warehouses
  FOR ALL
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

-- All authenticated users (sellers) can view buyer warehouses
CREATE POLICY "Sellers can view all buyer warehouses"
  ON public.buyer_warehouses
  FOR SELECT
  USING (auth.role() = 'authenticated');
`;

const body = JSON.stringify({ query: sql });

const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);

// Try management API
const mgmtBody = JSON.stringify({ query: sql });
const mgmtReq = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Length': Buffer.byteLength(mgmtBody)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

mgmtReq.on('error', (e) => console.error('Request error:', e.message));
mgmtReq.write(mgmtBody);
mgmtReq.end();
