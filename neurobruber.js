module.exports = ({markov, BOL, EOL}) => () => {
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

async function brew ({file, user, eolWeight}) {
    // Whatever. But must be consistent between data building and usage.
    const BOL = '§';
    const EOL = '∆';

    const fs = require('node:fs');

    function txt (x) {
        if (typeof x === 'string') return x;
        if (Array.isArray(x)) return x.map(x => txt(x));
        switch (x.type) {
            case 'mention':
            case 'mention_name':
            case 'hashtag':
            case 'italic':
            case 'bold':
                return x.text;
            case 'bot_command':
            case 'link':
            case 'pre':
            case 'email':
            case 'custom_emoji':
            case 'text_link':
            case 'strikethrough':
            case 'spoiler':
            case 'phone':
                return '';
            default:
                console.error(x)
                return '';
        }
    }

    const lines = JSON.parse(fs.readFileSync(file, 'utf8'))
        .filter(x => x.from_id === user && !x.forwarded_from && x.text)
        .map(x => [txt(x.text)].flat(Infinity).join(''));

    const markov = {};
    const store = (word, next, weight = 1) => {
        const wordKey = word.toLowerCase();
        const nextKey = next.toLowerCase();

        markov[wordKey] ??= {next: {}, vars: {}};
        markov[wordKey].vars[word] = 1;
        markov[wordKey].next[nextKey] ??= 0;
        markov[wordKey].next[nextKey] += weight;
    };

    for (const line of lines) {
        const words = line.split(/\s+|[,.?!]/g).filter(Boolean);
        if (words.length === 0) continue;

        store(BOL, words[0]);
        for (let i = 0; i < words.length - 1; i++) {
            store(words[i], words[i + 1]);
        }
        store(words[words.length - 1], EOL, eolWeight);
    }

    for (const key of Object.keys(markov)) {
        markov[key].total = Object.values(markov[key].next).reduce((s, x) => s + x, 0);
    }

    return {BOL, EOL, markov};
}

if (require.main === module) {
    (async () => {
        const fs = require('node:fs');
        const util = require('node:util');
        const args = util.parseArgs({
            args: process.argv.slice(2),
            options: {
                user: {type: 'string'},
                in: {type: 'string'},
                out: {type: 'string'},
                eolWeight: {type: 'string'}
            }
        });

        const markov = await brew({
            file: args.values.in,
            user: args.values.user,
            eolWeight: Number(args.values.eolWeight ?? '1')
        });
        fs.writeFileSync(args.values.out, JSON.stringify(markov));
    })();
}

