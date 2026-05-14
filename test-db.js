const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
supabase.from('applicants').select('id').is('deleted_at', null).limit(1).then(r => console.log(JSON.stringify(r)))
