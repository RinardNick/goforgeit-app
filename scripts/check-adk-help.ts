import { spawn } from 'child_process';

const adk = spawn('adk', ['web', '--help']);

adk.stdout.on('data', (data) => console.log(data.toString()));
adk.stderr.on('data', (data) => console.error(data.toString()));
