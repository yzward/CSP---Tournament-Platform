const { spawn } = require('child_process');

const args = process.argv.slice(2).map(arg => {
  if (arg === '--host') return '--hostname';
  if (arg.startsWith('--host=')) return arg.replace('--host=', '--hostname=');
  return arg;
});

const child = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000', ...args], { stdio: 'inherit', shell: true });

child.on('exit', code => {
  if (code !== null) process.exit(code);
});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, () => {
    child.kill(signal);
    process.exit(0);
  });
});
