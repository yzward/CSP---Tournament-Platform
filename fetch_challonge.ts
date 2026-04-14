async function run() {
  const res = await fetch('https://api.challonge.com/v1/tournaments/1.json');
  console.log(await res.text());
}
run();
