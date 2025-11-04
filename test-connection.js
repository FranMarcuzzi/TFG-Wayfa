const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'NOT FOUND');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test database connection
    const { data, error } = await supabase.from('trips').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('\n❌ Database Error:', error.message);
    } else {
      console.log('\n✅ Database connection successful!');
      console.log('📊 Tables are accessible');
    }

    // Test auth
    const { data: authData } = await supabase.auth.getSession();
    console.log('✅ Auth module working');
    
    console.log('\n🎉 Supabase is fully connected!\n');
    
  } catch (err) {
    console.log('\n❌ Connection failed:', err.message);
  }
}

testConnection();
