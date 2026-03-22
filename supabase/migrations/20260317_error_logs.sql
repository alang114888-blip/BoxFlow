-- Error logging table for diagnostics
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "Super admins can view error logs" ON error_logs
  FOR SELECT USING (public.get_my_role() = 'super_admin');

-- Anyone authenticated can insert logs
CREATE POLICY "Authenticated can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

GRANT ALL ON error_logs TO authenticated;
NOTIFY pgrst, 'reload schema';
