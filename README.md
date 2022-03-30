# `neurobruber`

НейроБурдос на цепях маркова в каждый чат!

```sh
nvm use

# Секреты
cp secrets.sample.json secrets.json && vim secrets.json

# Сварить граф цепей маркова
mv tg_chat_export.json data/tg.json
npm run brew

# Запустить бота
npm run start

# Разово написать нейробрубером в чат
npm run oneshot
```