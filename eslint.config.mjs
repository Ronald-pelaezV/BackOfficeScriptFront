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