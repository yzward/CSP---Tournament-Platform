async function run() {
  const res = await fetch('http://localhost:3000/api/debug-db', { redirect: 'manual' });
  console.log(res.status);
  console.log(res.headers.get('location'));
  console.log(await res.text());
}
run();
