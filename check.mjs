import {access,readFile} from 'node:fs/promises';
for(const file of ['public/index.html','public/app.js','public/style.css','public/questions.mjs','netlify/functions/quiz.mjs','lib/game.mjs','lib/questions.mjs','netlify.toml'])await access(file);
JSON.parse(await readFile('package.json','utf8'));
console.log('Netlify assets and function source ready.');
