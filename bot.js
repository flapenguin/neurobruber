const http = require('node:http');
const https = require('node:https');

const secrets = require('./secrets.json');
const args = require('node:util').parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        name: {type: 'string'},
        data: {type: 'string'}
    },
});

const base = 'https://api.telegram.org/bot' + secrets[args.values.name + ':tg:secret'];

async function tg(method, json) {
    const request = https.request(base + '/' + method, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!request.end(JSON.stringify(json))) throw new Error('wtf, drain');

    /** @type {http.IncomingMessage} */
    const response = await new Promise(r => request.on('response', r));
    const chunks = [];
    response.on('data', (chunk) => void chunks.push(chunk));
    await new Promise(r => response.on('end',  r));
    return JSON.parse(chunks.map(String).join(''));
}

main();
async function main() {
    const markov = require(args.values.data);
    const neurobruber = require('./neurobruber')(markov);

    const {result: me} = await tg('getMe');
    if (args.positionals[0] === 'nop') return console.log(me);
    if (args.positionals[0] === 'oneshot') return await tg('sendMessage', {chat_id: secrets[args.values.name + ':tg:chat_id'], text: neurobruber()});

    throw new Error(`i cant`);
}
