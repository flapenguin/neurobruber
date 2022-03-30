const http = require('node:http');
const https = require('node:https');

const secrets = require('./secrets.json');
const markov = require('./data/markov.json');

const neurobruber = require('./neurobruber')(markov);

const base = 'https://api.telegram.org/bot' + secrets['tg:secret'];

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
    const {result: me} = await tg('getMe');
    if (process.argv[2] === 'nop') return console.log(me);
    if (process.argv[2] === 'oneshot') return await tg('sendMessage', {chat_id: secrets['tg:chat_id'], text: neurobruber()});

    // TODO: webhooks
    async function poll(offset) {
        const {result: updates} = await tg('getUpdates', {offset});
        if (!updates.length) return {newOffset: offset};

        for (const update of updates.sort((a, b) => a.update_id - b.update_id)) {
            const {message} = update;
            if (!message?.text) continue;
            if (message.chat.id !== secrets['tg:chat_id']) continue;

            const mentioned = message.entities?.some(x => x.type === 'mention' && message.text.substring(x.offset, x.offset + x.length) === '@' + me.username);
            if (mentioned) {
                return {newOffset: update.update_id + 1, send: {chat_id: message.chat_id, text: neurobruber(), reply_to_message_id: message.message_id}};
            }

            // > Denis: хуево шо он на реплаи отзывается
            // > Denis: а то слишком дохуя его будет
            if (false && message.reply_to_message?.from.id === me.id) {
                return {newOffset: update.update_id + 1, send: {chat_id: message.chat_id, text: neurobruber()}};
            }
        }

        return  {newOffset: updates[updates.length - 1].update_id + 1};
    }

    // TODO: store offset somewhere
    let offset = 550970740 + 1;
    while (true) {
        console.log(offset);
        const {newOffset, send} = await poll(offset);
        offset = newOffset;
        if (send) {
            console.log(send);
            await tg('sendMessage', send);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}
