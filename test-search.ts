import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

async function run() {
  const { data, error } = await adminClient
    .from('staff_profiles')
    .select('*')
    .or('first_name.ilike.%john%,last_name.ilike.%john%,email.ilike.%john%,job_role.ilike.%john%')
  console.log("STAFF", data?.length, error)
  
  const { data: d2, error: e2 } = await adminClient
    .from('clients')
    .select('*')
    .or('first_name.ilike.%john%,last_name.ilike.%john%,preferred_name.ilike.%john%,postcode.ilike.%john%,phone.ilike.%john%')
  console.log("CLIENTS", d2?.length, e2)
}
run()
