
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Anon starts with:', anon ? anon.substring(0, 10) : 'N/A');
console.log('Service starts with:', service ? service.substring(0, 10) : 'N/A');
console.log('Are they the same?', anon === service);
