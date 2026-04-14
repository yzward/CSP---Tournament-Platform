import { getSupabaseAdmin, getSupabase } from './lib/supabase';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testAdminInsert() {
  console.log('--- Testing Admin Insert ---');
  const supabase = getSupabaseAdmin();
  
  const testName = 'QC TEST ' + new Date().toISOString();
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: testName,
      held_at: new Date().toISOString().split('T')[0],
      format: 'swiss', // Required by live schema
      stage1_format: 'swiss',
      status: 'active',
      is_ranking_tournament: true,
      stage_type: 'single'
    })
    .select()
    .single();

  if (error) {
    console.error('Admin Insert Error:', error);
  } else {
    console.log('Admin Insert Success:', data.id);
    // Cleanup
    await supabase.from('tournaments').delete().eq('id', data.id);
    console.log('Admin Cleanup Success');
  }
}

async function testAnonSelect() {
  console.log('--- Testing Anon Select ---');
  const supabase = getSupabase();
  const { data, error } = await supabase.from('tournaments').select('id').limit(1);
  
  if (error) {
    console.error('Anon Select Error:', error);
  } else {
    console.log('Anon Select Success, found:', data.length);
  }
}

async function main() {
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY set:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  if (process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('WARNING: Service role key and Anon key are identical!');
  }

  await testAdminInsert();
  await testAnonSelect();
}

main();
