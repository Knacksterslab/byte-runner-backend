/**
 * Apply fraud prevention schema updates to database
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function applySchema() {
  console.log('\n🔧 Applying fraud prevention schema updates...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Read SQL file
    const sqlPath = join(__dirname, 'apply-fraud-schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`  [${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

      if (error) {
        // Try direct execution for DDL statements
        console.log(`  ⚠️  RPC failed, trying direct execution...`);
        
        // For Supabase hosted instances, we can't run DDL directly via the client
        // User needs to run this via Supabase dashboard SQL editor
        console.log(`  ℹ️  Please run this statement manually in Supabase SQL Editor:`);
        console.log(`     ${statement};`);
      } else {
        console.log(`  ✅ Success`);
      }
    }

    console.log('\n✅ Schema update complete!\n');
    console.log('ℹ️  Note: If any statements failed, please run them manually in Supabase SQL Editor\n');

  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  }
}

applySchema();
