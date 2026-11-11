// Agrega eslint y eslint-plugin-jsdoc al final de devDependencies sin reordenar ni cambiar el formato.
const fs = require('fs');
const f = 'package.json';
const t = fs.readFileSync(f, 'utf8');
const nl = t.includes('\r\n') ? '\r\n' : '\n';
const pkg = JSON.parse(t);
const add = { 'eslint': '8.57.1', 'eslint-plugin-jsdoc': '51.4.1' };
const dev = pkg.devDependencies || {};
const nuevos = Object.keys(add).filter(k => !(k in dev) && !((pkg.dependencies || {})[k]));
if (!nuevos.length) { console.log('Ya estaban declarados, no se modifica package.json.'); process.exit(0); }
if (!pkg.devDependencies) { console.error('El package.json no tiene devDependencies; agrégalas a mano.'); process.exit(1); }
const m = t.match(/("devDependencies"\s*:\s*\{)([\s\S]*?)(\r?\n)(\s*)\}/);
const indent = (m[2].match(/\r?\n(\s+)"/) || [, '    '])[1];
const lineas = nuevos.map(k => `${indent}"${k}": "${add[k]}"`).join(',' + nl);
const cuerpo = m[2].trim() ? m[2].replace(/\s*$/, '') + ',' + nl + lineas : nl + lineas;
fs.writeFileSync(f, t.replace(m[0], m[1] + cuerpo + m[3] + m[4] + '}'));
console.log('Agregados a devDependencies: ' + nuevos.join(', '));