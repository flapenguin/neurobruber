// Whatever. But must be consistent between data building and usage.
const BOL = '§';
const EOL = '∆';

module.exports = (markov) => () => {
    const res = [];
    for (let prev = BOL; prev != EOL; ) {
        const word = markov[prev];
        let ix = Math.floor(word.total * Math.random());
        const [next] = Object.entries(word.next).find(([_, cc]) => {
            if (ix < cc) return true;
            ix -= cc;
        });
        res.push(next);
        prev = next;
    }
    res.pop();
    return res.join(' ');
};

async function brew (file, user_id) {
    const {spawn} = require('node:child_process');
    const readline = require('node:readline');
    const events = require('node:events');

    // TODO: refactor
    const jq = spawn('jq', [`
        def txt:
            if   . | type == "array"
                then map(txt)
            elif . | type == "object" and (.type == "bot_command" or .type == "link" or .type == "pre" or .type == "email")
                then empty
            elif . | type == "object" and (.type == "mention" or .type == "mention_name" or .type == "hashtag" or .type == "italic" or .type == "bold")
                then .text
            else .
            end;

        .
        | .messages
        | .[]
        | select(
                .from_id == $user_id
            and (.forwarded_from | type != "string")
            and .text != ""
        )
        | .text
        | txt
        | if (. | type == "array") then join("") else . end
    `, './data/cs_chat.json', '--arg', 'user_id', user_id], {stdio: ['ignore', 'pipe', 'inherit']});

    const rl = readline.createInterface({
        input: jq.stdout,
        crlfDelay: Infinity
    });

    const markov = {};
    const store = (word, next) => {
        const wordKey = word.toLowerCase();
        const nextKey = next.toLowerCase();

        markov[wordKey] ??= {next: {}, vars: {}};
        markov[wordKey].vars[word] = 1;
        markov[wordKey].next[nextKey] ??= 0;
        markov[wordKey].next[nextKey] += 1;
    };

    rl.on('line', (line) => {
        const msg = JSON.parse(line);
        const words = msg.split(/\s+|[,.?!]/g).filter(Boolean);
        if (words.length === 0) return;

        store(BOL, words[0]);
        for (let i = 0; i < words.length - 1; i++) {
            store(words[i], words[i + 1]);
        }
        store(words[words.length - 1], EOL);
    });

    await events.once(rl, 'close');

    for (const key of Object.keys(markov)) {
        markov[key].total = Object.values(markov[key].next).reduce((s, x) => s + x, 0);
    }

    return markov;
}

if (require.main === module) {
    (async () => {
        const fs = require('node:fs');
        const markov = await brew('./data/tg.json', require('./secrets.json')['brew:user_id']);
        fs.writeFileSync('./data/markov.json', JSON.stringify(markov));
    })();
}

