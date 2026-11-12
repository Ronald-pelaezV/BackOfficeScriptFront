# Script BackOffice.

Validación automática de la documentación de código (JSDoc) del BackOffice. Antes de cada `git push`, el hook revisa con ESLint los archivos `.js` modificados en los commits que se van a subir y cancela el push si la documentación no cumple la plantilla oficial.

Versiones utilizadas (las mismas del `package-lock.json` del proyecto):

| Componente | Versión |
|---|---|
| eslint | 8.57.1 |
| eslint-plugin-jsdoc | 51.4.1 |
| Node para ejecutar la validación | 20.11 o superior |

> El desarrollador **puede seguir trabajando con su versión de Node habitual** (por ejemplo, 16 o 18). El hook busca por su cuenta un Node 20 instalado y lo usa solo para la validación. No es necesario ejecutar `nvm use`.

Todos los comandos se ejecutan en la **raíz del proyecto**, desde **PowerShell** o **Git Bash** (no desde `cmd`).

### 1. Instalar Node 20

ESLint con las versiones del proyecto necesita Node 20.11 o superior. Se instala una sola vez por equipo, **sin activarlo**.

```
nvm list
```

Si en la lista no aparece una versión 20 o superior, se instala con:

```
nvm install 20
```

> No ejecutar `nvm use 20`. El Node activo del desarrollador no debe cambiar.

### 2. Instalar dependencias

Con este comando se agregan `eslint` y `eslint-plugin-jsdoc` al final de `devDependencies` del `package.json` y se instalan. No reordena ni modifica las demás dependencias. Si ya estaban declaradas, no cambia el `package.json`.

Se ejecuta con el Node que el desarrollador tenga activo:

```
node -e 'const fs=require(`fs`),f=`package.json`,t=fs.readFileSync(f,`utf8`),nl=t.includes(`\r\n`)?`\r\n`:`\n`,add={[`eslint`]:`8.57.1`,[`eslint-plugin-jsdoc`]:`51.4.1`},p=JSON.parse(t),d=p.devDependencies||{},n=Object.keys(add).filter(k=>!(k in d));if(!n.length){console.log(`Ya estaban en package.json`);process.exit(0)}const m=t.match(/(.devDependencies.\s*:\s*\{)([\s\S]*?)(\r?\n)(\s*)\}/),ind=(m[2].match(/\r?\n(\s+)./)||[0,`    `])[1],l=n.map(k=>ind+JSON.stringify(k)+`: `+JSON.stringify(add[k])).join(`,`+nl);fs.writeFileSync(f,t.replace(m[0],m[1]+m[2].replace(/\s*$/,``)+`,`+nl+l+m[3]+m[4]+`}`));console.log(`Agregados a devDependencies: `+n.join(`, `))'; npm install
```

> **No usar** `npm install -D eslint ...`: reordena alfabéticamente todas las dependencias del `package.json`.
>
> Cuando los cambios ya estén en `main` (después del despliegue), basta con traer `main` a la rama y ejecutar `npm install`, porque las dependencias ya vendrán declaradas.

Durante la instalación es normal ver estos avisos:

- `EBADENGINE ... required: { node: '>=20.11.0' }`: es solo un aviso. La validación se ejecuta con Node 20.
- `deprecated eslint@8.57.1`: es la versión del proyecto y funciona correctamente.
- `vulnerabilities`: corresponden a dependencias que el proyecto ya tenía. **No ejecutar `npm audit fix`**, porque cambiaría versiones de otras dependencias.

### 3. Archivo de configuración ESLint

Se debe crear un archivo llamado `eslint.config.mjs` en la raíz del proyecto.

En este archivo se establecen las reglas que tomará ESLint para validar la documentación del código según la plantilla oficial del BackOffice:

- Encabezado del archivo con `@file` y `@description`.
- Clases con línea de descripción, `@description` y `@extends` cuando heredan.
- Métodos, funciones y callbacks con descripción, `@param {tipo} nombre - Descripción.`, `@returns {tipo}` (se permite `{void}`) y `@throws` cuando lanzan errores.
- Descripciones que inician con mayúscula y terminan con punto.
- Documentación escrita en inglés.
- Mensajes de error en español.
- Los archivos con errores de sintaxis no bloquean el push (solo se valida la documentación).

> El archivo debe llamarse `eslint.config.mjs` (con extensión `.mjs`), porque el `package.json` del proyecto no tiene `"type": "module"`.

```javascript
import jsdoc from 'eslint-plugin-jsdoc';
import * as espree from 'espree';

/**
 * Intenta leer el archivo como módulo y luego como script. Si el código no se puede leer,
 * devuelve un programa vacío, así el archivo se omite en lugar de hacer fallar la validación.
 */
const tolerantParser = {
    meta: { name: 'tolerant-parser' },
    parseForESLint(code, options) {
        const sourceTypes = options.sourceType === 'script' ? ['script', 'module'] : ['module', 'script'];

        for (const sourceType of sourceTypes) {
            try {
                return { ast: espree.parse(code, { ...options, sourceType }) };
            } catch {
                // Intenta con el siguiente tipo de fuente.
            }
        }

        return {
            ast: {
                type: 'Program',
                body: [],
                sourceType: 'module',
                comments: [],
                tokens: [],
                range: [0, 0],
                loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
            },
        };
    },
};

/**
 * Contextos donde el bloque JSDoc es obligatorio para las funciones.
 * Incluye los callbacks inline declarados como propiedades de objetos (comunes en las configuraciones de Webix).
 */
const functionContexts = [
    'FunctionDeclaration',
    'MethodDefinition',
    'Property > ArrowFunctionExpression',
    'Property > FunctionExpression',
    'VariableDeclarator > ArrowFunctionExpression',
    'VariableDeclarator > FunctionExpression',
];

/**
 * Contextos donde se valida un bloque JSDoc que ya existe (@param, @returns, descripciones...).
 * No hace obligatorio el JSDoc en esos lugares: eso lo controla functionContexts.
 */
const documentedFunctionContexts = [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
];

/**
 * Bloque JSDoc escrito antes de una llamada que recibe un callback, por ejemplo:
 *     /** Adds the rows. ... *\/
 *     master.data.each(function (obj) {...});
 * eslint-plugin-jsdoc no relaciona ese bloque con el callback, por eso las reglas que solo leen el bloque
 * (descripciones y tipos) también se ejecutan sobre estas sentencias, y custom-backoffice/callback-doc revisa
 * el resto (@param, @returns y @throws comparados con el callback).
 */
const callbackStatement = 'ExpressionStatement[expression.type="CallExpression"]';
const documentedBlockContexts = [...documentedFunctionContexts, callbackStatement];

/**
 * Plugin propio con las reglas del BackOffice que eslint-plugin-jsdoc no cubre.
 */
const customBackOfficePlugin = {
    rules: {
        /**
         * Valida que el archivo inicie con el encabezado de documentación (@file + @description).
         */
        'file-header': {
            meta: { type: 'problem' },
            create(context) {
                return {
                    Program(node) {
                        const sourceCode = context.sourceCode || context.getSourceCode();
                        const firstToken = sourceCode.getFirstToken(node);

                        // Los archivos vacíos no necesitan encabezado.
                        if (!firstToken) return;

                        const header = sourceCode
                            .getCommentsBefore(firstToken)
                            .find(c => c.type === 'Block' && c.value.startsWith('*'));

                        if (!header || !/@file\s+\S+/.test(header.value)) {
                            context.report({
                                loc: { line: 1, column: 0 },
                                message: 'El archivo debe iniciar con el encabezado de documentación (@file y @description).',
                            });
                            return;
                        }

                        const match = header.value.match(/@description\s+([\s\S]*?)(?=\n\s*\*\s*@|\n\s*$|$)/);
                        const text = match ? match[1].replace(/\n\s*\*/g, ' ').trim() : '';

                        if (!text) {
                            context.report({
                                loc: header.loc,
                                message: 'El encabezado de documentación debe contener la etiqueta @description.',
                            });
                        } else if (!/^[A-Z][\s\S]*\.$/.test(text)) {
                            context.report({
                                loc: header.loc,
                                message: 'La descripción del encabezado debe iniciar con mayúscula y terminar con punto.',
                            });
                        }
                    },
                };
            },
        },

        /**
         * Valida el bloque JSDoc de las clases según la plantilla del BackOffice:
         * línea de descripción principal + etiqueta @description + @extends cuando la clase hereda.
         * Las clases sin bloque JSDoc las reporta jsdoc/require-jsdoc.
         */
        'class-doc': {
            meta: { type: 'problem' },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                /**
                 * Revisa el bloque JSDoc de una clase.
                 *
                 * @param {Object} node - El nodo de la clase.
                 * @returns {void}
                 */
                const checkClass = (node) => {
                    const target = /^Export(Default|Named)Declaration$/.test(node.parent.type) ? node.parent : node;
                    const comments = sourceCode.getCommentsBefore(target);
                    const jsdoc = comments[comments.length - 1];

                    if (!jsdoc || jsdoc.type !== 'Block' || !jsdoc.value.startsWith('*')) return;

                    const lines = jsdoc.value.split('\n').map(l => l.replace(/^\s*\*?\s?/, '').trim());
                    const firstTag = lines.findIndex(l => l.startsWith('@'));
                    const mainText = (firstTag === -1 ? lines : lines.slice(0, firstTag)).join(' ').trim();
                    // Un @description vacío lo reporta jsdoc/match-description (traducido como "está vacía").
                    const hasDescriptionTag = /@description\b/.test(jsdoc.value);

                    if (!mainText) {
                        // Se reporta en la primera línea dentro del bloque, donde también reporta jsdoc/match-description.
                        const line = jsdoc.loc.start.line + 1;
                        context.report({
                            loc: { start: { line, column: 0 }, end: { line, column: 0 } },
                            message: 'La documentación de la clase debe iniciar con una línea de descripción (antes de @description).',
                        });
                    }
                    if (!hasDescriptionTag) {
                        context.report({
                            loc: jsdoc.loc,
                            message: 'La documentación de la clase debe contener la etiqueta @description.',
                        });
                    }
                    if (node.superClass && !/@(extends|augments)\s+\S/.test(jsdoc.value)) {
                        context.report({
                            loc: jsdoc.loc,
                            message: 'La documentación de la clase debe contener la etiqueta @extends con la clase padre.',
                        });
                    }
                };

                return {
                    ClassDeclaration: checkClass,
                };
            },
        },

        /**
         * Valida el bloque JSDoc escrito antes de una llamada que recibe un callback
         * (ej. master.data.each(function (obj) {...})), que eslint-plugin-jsdoc no relaciona con el callback:
         * cada parámetro tiene su @param, no sobra ningún @param, existe @returns y existe @throws si lanza errores.
         */
        'callback-doc': {
            meta: { type: 'problem' },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();
                const isFunction = (n) => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');

                /**
                 * Revisa si el cuerpo de una función lanza un error, sin entrar en funciones anidadas.
                 *
                 * @param {Object} node - El nodo a revisar.
                 * @returns {boolean} True cuando encuentra una sentencia throw.
                 */
                const throwsError = (node) => {
                    if (!node || typeof node.type !== 'string') return false;
                    if (node.type === 'ThrowStatement') return true;
                    if (/Function/.test(node.type)) return false;
                    return Object.keys(node).some((key) => {
                        if (key === 'parent') return false;
                        const value = node[key];
                        return Array.isArray(value) ? value.some(throwsError) : throwsError(value);
                    });
                };

                return {
                    [callbackStatement](node) {
                        const callback = node.expression.arguments.find(isFunction);
                        if (!callback) return;

                        const comments = sourceCode.getCommentsBefore(node);
                        const jsdoc = comments[comments.length - 1];
                        if (!jsdoc || jsdoc.type !== 'Block' || !jsdoc.value.startsWith('*')) return;

                        const report = (message) => context.report({ loc: jsdoc.loc, message });
                        const documented = [...jsdoc.value.matchAll(/@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?\[?([\w$]+)/g)].map(m => m[1]);
                        const params = callback.params
                            .map(p => (p.type === 'AssignmentPattern' ? p.left : p))
                            .filter(p => p.type === 'Identifier')
                            .map(p => p.name);

                        for (const name of params.filter(p => !documented.includes(p))) {
                            report(`Falta documentar el parámetro "${name}" con @param {tipo} ${name} - Descripción.`);
                        }
                        if (callback.params.every(p => p.type === 'Identifier' || p.type === 'AssignmentPattern')) {
                            for (const name of documented.filter(d => !params.includes(d))) {
                                report(`El @param "${name}" no existe en la función; elimínalo o corrige el nombre.`);
                            }
                        }
                        if (!/@returns?\b/.test(jsdoc.value)) {
                            report('Falta la etiqueta @returns {tipo} Descripción. (usa @returns {void} si no retorna nada).');
                        }
                        if (!/@throws\b/.test(jsdoc.value) && throwsError(callback.body)) {
                            report('La función lanza un error (throw); agrega @throws {Error} Descripción.');
                        }
                    },
                };
            },
        },

        /**
         * Valida que la documentación esté escrita en inglés.
         * Heurística sin dependencias: un bloque falla si su texto tiene caracteres del español (á, é, ñ, ¿...)
         * o al menos 2 palabras comunes del español distintas. Se permite el texto entre comillas o backticks
         * (nombres del negocio), y se omiten las etiquetas con nombres o referencias (@file, @extends, @see...).
         */
        'english-only': {
            meta: { type: 'problem' },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();
                const spanishWords = new Set([
                    'el', 'la', 'los', 'las', 'del', 'que', 'para', 'con', 'una', 'unos', 'unas', 'por', 'según',
                    'cuando', 'como', 'esta', 'este', 'estos', 'estas', 'pero', 'entre', 'sobre', 'desde', 'hasta',
                    'cada', 'donde', 'también', 'retorna', 'devuelve', 'obtiene', 'carga', 'valida', 'muestra',
                    'maneja', 'crea', 'elimina', 'actualiza', 'guarda', 'configura', 'inicializa', 'selecciona',
                    'usuario', 'usuarios', 'datos', 'valor', 'valores', 'fecha', 'lista', 'tabla', 'objeto',
                    'parámetro', 'función', 'método', 'clase', 'archivo', 'identificador', 'nombre', 'cadena',
                    'número', 'verdadero', 'falso', 'vacío', 'vacía',
                ]);
                const skippedTags = /^@(file|fileoverview|extends|augments|author|see|example|module|requires|license|copyright|version|since)\b/;

                return {
                    'Program:exit'() {
                        for (const comment of sourceCode.getAllComments()) {
                            if (comment.type !== 'Block' || !comment.value.startsWith('*')) continue;

                            const found = [];
                            let reportLine = null;
                            let skipping = false;

                            comment.value.split('\n').forEach((rawLine, i) => {
                                let text = rawLine.replace(/^\s*\*?\s?/, '').trim();
                                if (text.startsWith('@')) skipping = skippedTags.test(text);
                                if (skipping || reportLine) return;

                                text = text
                                    .replace(/(["'`]).*?\1/g, ' ')                       // nombres entre comillas
                                    .replace(/\{[^}]*\}/g, ' ')                          // {tipos}
                                    .replace(/^@(param|arg|argument|property|prop)\s+\[?[\w$.]+\]?/, ' ') // nombre del parámetro
                                    .replace(/^@\w+/, ' ');                              // nombre de la etiqueta

                                const accented = text.match(/[\wáéíóúñü]*[áéíóúñ¿¡][\wáéíóúñü]*/i);
                                if (accented) found.push(accented[0].toLowerCase());
                                for (const word of text.toLowerCase().match(/[a-záéíóúñü]+/g) || []) {
                                    if (spanishWords.has(word) && !found.includes(word)) found.push(word);
                                }

                                if (accented || found.length >= 2) reportLine = comment.loc.start.line + i;
                            });

                            if (reportLine) {
                                context.report({
                                    loc: { start: { line: reportLine, column: 0 }, end: { line: reportLine, column: 0 } },
                                    message: `La documentación debe estar en inglés; se encontró texto en español: ${found.slice(0, 3).map(w => `"${w}"`).join(', ')}.`,
                                });
                            }
                        }
                    },
                };
            },
        },
    },
};

/**
 * Mensajes en español para las reglas de eslint-plugin-jsdoc: [regla, patrón del mensaje original, mensaje nuevo].
 * "$1" se reemplaza por el valor que captura el patrón (nombre del parámetro o de la etiqueta).
 * Los mensajes que no están en esta lista se muestran tal cual, así una traducción faltante nunca rompe la validación.
 */
const spanishMessages = [
    ['jsdoc/require-jsdoc', /./, 'Falta el bloque de documentación (/** ... */) de esta clase, método o función.'],
    ['jsdoc/require-description', /@description description/, 'La etiqueta @description está vacía; escribe la descripción después de la etiqueta.'],
    ['jsdoc/require-description', /./, 'Falta la descripción del bloque: escribe una línea que explique qué hace.'],
    ['jsdoc/match-description', /./, 'La descripción debe iniciar con mayúscula y terminar con punto.'],
    ['jsdoc/require-param', /"(.+)"/, 'Falta documentar el parámetro "$1" con @param {tipo} $1 - Descripción.'],
    ['jsdoc/require-param-type', /"(.+)"/, 'Falta el tipo del parámetro "$1"; ejemplo: @param {string} $1 - Descripción.'],
    ['jsdoc/require-param-description', /"(.+)"/, 'Falta la descripción del parámetro "$1"; ejemplo: @param {tipo} $1 - Descripción.'],
    ['jsdoc/check-param-names', /^Expected @param names? to be "(.+?)"/, 'Los nombres u orden de los @param no coinciden con la función; se esperaba: $1.'],
    ['jsdoc/check-param-names', /@param "(.+?)" does not match an existing/, 'El @param "$1" no existe en la función; elimínalo o corrige el nombre.'],
    ['jsdoc/check-param-names', /^Found more than one/, 'Hay un @param repetido; deja solo uno por parámetro.'],
    ['jsdoc/require-returns', /./, 'Falta la etiqueta @returns {tipo} Descripción. (usa @returns {void} si no retorna nada).'],
    ['jsdoc/require-returns-type', /./, 'Falta el tipo en @returns; ejemplo: @returns {Object} Descripción. o @returns {void}.'],
    ['jsdoc/require-throws', /./, 'La función lanza un error (throw); agrega @throws {Error} Descripción.'],
    ['jsdoc/require-asterisk-prefix', /./, 'Cada línea del bloque de documentación debe iniciar con " * ".'],
    ['jsdoc/check-alignment', /./, 'Los asteriscos (*) del bloque de documentación no están alineados.'],
    ['jsdoc/check-tag-names', /Replace "(.+?)" JSDoc tag with "(.+?)"/, 'Usa la etiqueta @$2 en lugar de @$1.'],
    ['jsdoc/check-tag-names', /tag name "(.+?)"/, 'La etiqueta @$1 no existe; revisa si está mal escrita (ej. @returns, @param, @description).'],
];

/**
 * Procesador que solo reemplaza los mensajes de las reglas de jsdoc por los mensajes en español.
 * El código no se modifica y las reglas siguen funcionando igual.
 */
const sourceTexts = new Map();
const spanishProcessor = {
    meta: { name: 'spanish-messages' },
    supportsAutofix: true,
    preprocess: (text, filename) => {
        sourceTexts.set(filename, text);
        return [text];
    },
    postprocess: (messages, filename) => {
        const lines = (sourceTexts.get(filename) || '').split(/\r?\n/);
        sourceTexts.delete(filename);

        // Líneas que ya reportó la regla de clases: el mensaje genérico de formato ahí sería un duplicado.
        const classLines = new Set(messages[0].filter(m => m.ruleId === 'custom-backoffice/class-doc').map(m => m.line));

        return messages[0].filter(m => !(m.ruleId === 'jsdoc/match-description' && classLines.has(m.line))).map((msg) => {
            // Una etiqueta escrita sin texto (ej. "* @description") se reporta como vacía, no como un problema de formato.
            const line = lines[msg.line - 1] || '';
            const emptyTag = line.match(/^\s*\*?\s*@(\w+)\s*(\{[^}]*\})?\s*$/);
            if (msg.ruleId === 'jsdoc/match-description' && emptyTag) {
                return { ...msg, message: `La etiqueta @${emptyTag[1]} está vacía; escribe la descripción después de la etiqueta.` };
            }
            // Un @param escrito sin descripción (ej. "* @param {Object} obj -").
            const emptyParam = line.match(/^\s*\*?\s*@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?\[?([\w$.]+)\]?\s*-?\s*$/);
            if (/^jsdoc\/(match-description|require-param-description)$/.test(msg.ruleId) && emptyParam) {
                return { ...msg, message: `Falta la descripción del parámetro "${emptyParam[1]}"; ejemplo: @param {tipo} ${emptyParam[1]} - Descripción.` };
            }

            const entry = spanishMessages.find(([rule, pattern]) => rule === msg.ruleId && pattern.test(msg.message));
            if (!entry) return msg;
            const match = msg.message.match(entry[1]) || [];
            return { ...msg, message: entry[2].replace(/\$(\d)/g, (_, n) => match[n] || '') };
        }).filter((msg, _, all) => {
            // El mismo texto en la misma línea se muestra una sola vez, conservando la regla específica sobre jsdoc/match-description.
            const same = all.filter(m => m.line === msg.line && m.message === msg.message);
            const keep = same.find(m => m.ruleId !== 'jsdoc/match-description') || same[0];
            return keep === msg;
        });
    },
};

export default [
    {
        ignores: [
            'eslint.config.mjs',
            'hooks/**',
            'node_modules/**',
            'dist/**',
            'build/**',
            '**/*.min.js',
        ],
    },
    {
        files: ['**/*.js'],
        processor: spanishProcessor,
        languageOptions: {
            parser: tolerantParser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        plugins: {
            jsdoc,
            'custom-backoffice': customBackOfficePlugin,
        },
        settings: {
            jsdoc: {
                mode: 'jsdoc',
                tagNamePreference: { augments: 'extends' },
                ignorePrivate: true,
                ignoreInternal: true,
            },
        },
        rules: {
            // Encabezado al inicio de cada archivo.
            'custom-backoffice/file-header': 'error',

            // Bloque de las clases según la plantilla: descripción + @description + @extends.
            'custom-backoffice/class-doc': 'error',

            // Documentación escrita solo en inglés.
            'custom-backoffice/english-only': 'error',

            // JSDoc escrito antes de una llamada que recibe un callback (ej. data.each(function (obj) {...})).
            'custom-backoffice/callback-doc': 'error',

            // Formato.
            'jsdoc/require-asterisk-prefix': 'error',
            'jsdoc/check-alignment': 'error',
            'jsdoc/check-tag-names': ['error', { definedTags: ['fileoverview'] }],

            // El bloque JSDoc es obligatorio en clases, métodos y funciones.
            'jsdoc/require-jsdoc': ['error', {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                    ClassDeclaration: true,
                    ArrowFunctionExpression: false,
                    FunctionExpression: false,
                },
                contexts: functionContexts,
                checkConstructors: false,
            }],

            // Todo elemento documentado debe tener descripción (texto principal o @description).
            'jsdoc/require-description': ['error', {
                descriptionStyle: 'any',
                contexts: ['any'],
            }],

            // Las descripciones inician con mayúscula y terminan con punto.
            'jsdoc/match-description': ['error', {
                mainDescription: '^(?:[A-Z][\\s\\S]*\\.\\s*)?$',
                matchDescription: '^[A-Z][\\s\\S]*\\.\\s*$',
                // "description: true" es necesario para que eslint-plugin-jsdoc 42 (Node 14) también valide la etiqueta @description.
                tags: {
                    param: true,
                    throws: true,
                    description: true,
                },
                // Por defecto solo se revisan funciones; se incluyen también las clases.
                contexts: ['ClassDeclaration', ...documentedBlockContexts],
            }],

            // Parámetros.
            'jsdoc/require-param': ['error', { contexts: documentedFunctionContexts }],
            'jsdoc/require-param-type': ['error', { contexts: documentedBlockContexts }],
            'jsdoc/require-param-description': ['error', { contexts: documentedBlockContexts }],
            'jsdoc/check-param-names': ['error', { checkDestructured: false, enableFixer: false }],

            // Valores de retorno: @returns es obligatorio en toda función (usar {void} cuando no retorna nada, como en la plantilla).
            'jsdoc/require-returns': ['error', { contexts: documentedFunctionContexts, forceRequireReturn: true }],
            'jsdoc/require-returns-type': ['error', { contexts: documentedBlockContexts }],

            // Errores.
            'jsdoc/require-throws': ['error', { contexts: documentedFunctionContexts }],
        },
    },
];
```

### 4. Hook

El hook ejecutará ESLint de manera automática antes de hacer el push. Si la validación encuentra errores de documentación, el hook cancelará el push.

Se debe crear el archivo `pre-push` (**sin extensión**) en la ruta `.git/hooks/` del proyecto.

> Copiar el archivo, no pegar su contenido en un editor ni en un chat. Si el archivo se guarda con fin de línea CRLF o con comillas tipográficas, el hook falla y bloquea todos los pushes. Para copiarlo:
>
> ```
> Copy-Item "<ruta del archivo original>\pre-push" .git\hooks\pre-push
> ```

Qué valida:

- Solo los archivos `.js` tocados por los commits que aún no están en el remoto (ramas nuevas, ramas antiguas, merges y rebase).
- El contenido del archivo **tal como quedó en el commit**. Lo que no esté commiteado no se tiene en cuenta.
- Los cambios traídos de otras ramas con `pull` o `merge` no se le validan a quien los trae.

```shellscript
#!/usr/bin/env bash
# ───────────────────────────────────────────────
# 📄 VALIDACIÓN DE DOCUMENTACIÓN (JSDoc) CON ESLINT
# ───────────────────────────────────────────────
# Bloquea el push solo si hay errores de documentación en los archivos .js modificados.
#
# Las versiones de ESLint que trae el package-lock.json del proyecto
# (eslint 8.57.1 + eslint-plugin-jsdoc 51.x) necesitan Node >= 20.11, pero el proyecto
# se trabaja con un Node más viejo (webpack 4). Por eso el hook NO usa el Node activo
# si es muy viejo: busca un Node >= 20.11 instalado en el equipo (nvm-windows, nvm o el
# del sistema) y ejecuta ESLint con ese. No hace falta cambiar de versión con "nvm use".
echo "🔍 Ejecutando validación de documentación con ESLint..."

# Rama principal contra la que se compara cuando la rama actual aún no existe en el remoto.
MAIN_BRANCH="main"

# Versión mínima de Node que exige eslint-plugin-jsdoc del package-lock.json.
MIN_NODE="20.11.0"

# ── Utilidades ──────────────────────────────────
# Devuelve 0 si la versión $1 (ej. v20.18.0) es >= MIN_NODE.
version_ok() {
    local v="${1#v}"
    local IFS=.
    read -r a b c <<< "$v"
    read -r x y z <<< "$MIN_NODE"
    [ "${a:-0}" -gt "$x" ] && return 0
    [ "${a:-0}" -lt "$x" ] && return 1
    [ "${b:-0}" -gt "$y" ] && return 0
    [ "${b:-0}" -lt "$y" ] && return 1
    [ "${c:-0}" -ge "$z" ]
}

# Busca un ejecutable de Node >= MIN_NODE. Primero el activo; luego los instalados con nvm.
find_node() {
    local candidates=()
    command -v node > /dev/null 2>&1 && candidates+=("$(command -v node)")

    # nvm-windows (NVM_HOME o la carpeta por defecto %APPDATA%\nvm).
    local nvm_dirs=()
    [ -n "$NVM_HOME" ] && nvm_dirs+=("$NVM_HOME")
    [ -n "$APPDATA" ] && nvm_dirs+=("$APPDATA/nvm")
    # nvm (Linux / macOS / WSL).
    nvm_dirs+=("${NVM_DIR:-$HOME/.nvm}/versions/node")

    local d f
    for d in "${nvm_dirs[@]}"; do
        command -v cygpath > /dev/null 2>&1 && d="$(cygpath -u "$d" 2>/dev/null || echo "$d")"
        # Ordena de la versión más nueva a la más vieja ("while read" soporta rutas con espacios).
        while IFS= read -r f; do
            [ -x "$f/node.exe" ] && candidates+=("$f/node.exe")
            [ -x "$f/bin/node" ] && candidates+=("$f/bin/node")
        done < <(ls -d "$d"/v* 2>/dev/null | sort -rV)
    done
    [ -x "/c/Program Files/nodejs/node.exe" ] && candidates+=("/c/Program Files/nodejs/node.exe")

    local n v
    for n in "${candidates[@]}"; do
        v="$("$n" --version 2>/dev/null)" || continue
        if version_ok "$v"; then
            echo "$n"
            return 0
        fi
    done
    return 1
}

# ── Verificación del entorno ────────────────────
ESLINT_BIN="./node_modules/eslint/bin/eslint.js"
if [ ! -f "$ESLINT_BIN" ]; then
    echo "❌ ESLint no está instalado en este proyecto."
    echo "👉 Ejecuta 'npm install' en la raíz del proyecto y vuelve a intentar el push."
    exit 1
fi

CONFIG_FOUND=0
for CONFIG in eslint.config.mjs eslint.config.js eslint.config.cjs; do
    if [ -f "./$CONFIG" ]; then
        CONFIG_FOUND=1
        break
    fi
done

if [ $CONFIG_FOUND -eq 0 ]; then
    echo "❌ No se encontró el archivo eslint.config.mjs en la raíz del proyecto."
    echo "👉 Trae los últimos cambios de '$MAIN_BRANCH' a tu rama (git pull origin $MAIN_BRANCH) y vuelve a intentar."
    exit 1
fi

NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
    echo "❌ La validación de documentación necesita Node $MIN_NODE o superior instalado en el equipo."
    echo "   Node activo: $(node --version 2>/dev/null || echo 'ninguno')."
    echo "👉 Instálalo una sola vez con 'nvm install 20' (no hace falta hacer 'nvm use'; el proyecto"
    echo "   puede seguir trabajando con su Node actual) y vuelve a intentar el push."
    exit 1
fi
echo "ℹ️  ESLint se ejecuta con Node $("$NODE_BIN" --version) ($NODE_BIN)."

# ── Qué se va a subir ───────────────────────────
# Git le pasa al hook una línea por cada rama del push: <ref local> <commit local> <ref remota> <commit remoto>.
# Se valida exactamente eso (no la rama actual ni la carpeta de trabajo):
#   - Commits: los que aún no existen en el remoto (sirve para ramas nuevas, antiguas, rebase y merges).
#   - Contenido: el archivo tal como quedó en el commit que se sube; lo que no esté commiteado no cuenta.
ZERO="0000000000000000000000000000000000000000"
DOC_ERROR=0
ENV_ERROR=0
VALIDATED=0

while read -r LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA; do
    # Borrado de una rama remota: no hay nada que validar.
    [ "$LOCAL_SHA" = "$ZERO" ] && continue

    BRANCH="${LOCAL_REF#refs/heads/}"
    [ "$REMOTE_SHA" = "$ZERO" ] && echo "ℹ️  La rama '$BRANCH' es nueva en el remoto. Se validan sus commits que aún no están en el remoto."

    # Archivos tocados por cualquier commit del push (también los cambios hechos al resolver un merge, --cc).
    FILES=$(git log --name-only --format= --diff-filter=ACMR --cc "$LOCAL_SHA" --not --remotes | grep -E '\.js$' | sort -u)
    [ -z "$FILES" ] && continue

    echo "📝 Archivos a validar en '$BRANCH':"
    echo "$FILES"

    # "while read" para soportar rutas con espacios.
    while IFS= read -r FILE; do
        # El archivo pudo borrarse en un commit posterior del mismo push.
        if ! git cat-file -e "$LOCAL_SHA:$FILE" 2>/dev/null; then
            echo "⚠️ Archivo omitido (no existe en el commit que se sube): $FILE"
            continue
        fi
        echo "📂 Validando $FILE ..."
        VALIDATED=1

        # Se valida el contenido del commit (git show), no el de la carpeta de trabajo.
        OUTPUT=$("$NODE_BIN" "$ESLINT_BIN" --no-warn-ignored --max-warnings 0 --stdin --stdin-filename "$FILE" < <(git show "$LOCAL_SHA:$FILE") 2>&1)
        STATUS=$?

        # ESLint: 0 = sin errores, 1 = errores de documentación, 2 = ESLint no pudo ejecutarse.
        if [ $STATUS -eq 1 ]; then
            DOC_ERROR=1
            echo "$OUTPUT"
        elif [ $STATUS -ne 0 ]; then
            ENV_ERROR=1
            echo "$OUTPUT" | head -5
        fi
    done <<< "$FILES"
done

if [ $VALIDATED -eq 0 ] && [ $DOC_ERROR -eq 0 ] && [ $ENV_ERROR -eq 0 ]; then
    echo "✅ No hay archivos JavaScript modificados para validar."
    exit 0
fi

if [ $ENV_ERROR -ne 0 ]; then
    echo "❌ ESLint no pudo ejecutarse (problema de instalación o configuración, no de tu documentación)."
    echo "👉 Ejecuta 'npm install' y vuelve a intentar. Si persiste, avisa al equipo de documentación."
    exit 1
fi

if [ $DOC_ERROR -ne 0 ]; then
    echo "❌ Se encontraron errores en la documentación. Corrige antes de hacer push."
    exit 1
fi

echo "✅ Validación exitosa. Continuando con el push."
exit 0
```

### 5. Verificación

1. Revisar que el `package.json` solo tenga las 2 líneas nuevas:

    ```
    git diff package.json
    ```

2. Revisar que el hook no tenga errores de sintaxis (en Git Bash, no debe mostrar nada):

    ```
    bash -n .git/hooks/pre-push
    ```

3. Probar sin subir nada al remoto, con `git push --dry-run` (ejecuta el hook pero no envía cambios). Hacerlo con el `git status` limpio:

    ```
    $base = git rev-parse HEAD
    ```

    - **Flujo feliz:** crear `prueba-doc.js` documentado según la plantilla, `git add prueba-doc.js`, `git commit -m "prueba"` y `git push --dry-run`. Debe mostrar `✅ Validación exitosa`.
    - **Flujo con fallo:** borrar la descripción de un `@param` en `prueba-doc.js`, `git commit -am "prueba fallo"` y `git push --dry-run`. Debe mostrar `❌ Se encontraron errores en la documentación`.
    - **Limpieza** (deja la rama como estaba):

        ```
        git reset $base
        Remove-Item prueba-doc.js
        git status
        ```

En todos los casos el log debe mostrar `ℹ️ ESLint se ejecuta con Node v20...`, aunque el desarrollador tenga otro Node activo.

### 6. Orden de instalación en los demás equipos

Una vez los cambios (`eslint.config.mjs`, `package.json` y `package-lock.json`) estén desplegados en `main`:

1. Traer `main` a la rama de trabajo.
2. Ejecutar `npm install`.
3. Copiar el hook a `.git/hooks/pre-push`.
4. Ejecutar `nvm install 20` si el equipo no tiene Node 20.

> Si el hook se instala **antes** de traer `main`, bloqueará todos los pushes con el mensaje "No se encontró el archivo eslint.config.mjs", porque la rama todavía no tiene la configuración.
