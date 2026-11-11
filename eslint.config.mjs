import jsdoc from 'eslint-plugin-jsdoc';
import * as espree from 'espree';

/**
 * Parser that never reports syntax errors.
 * Tries to read the file as a module, then as a script. If the code cannot be read,
 * it returns an empty program, so the file is skipped instead of failing the validation.
 */
const tolerantParser = {
    meta: { name: 'tolerant-parser' },
    parseForESLint(code, options) {
        const sourceTypes = options.sourceType === 'script' ? ['script', 'module'] : ['module', 'script'];

        for (const sourceType of sourceTypes) {
            try {
                return { ast: espree.parse(code, { ...options, sourceType }) };
            } catch {
                // Try the next source type.
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
 * Contexts where a JSDoc block is mandatory for functions.
 * Includes inline callbacks declared as object properties (common in Webix configs).
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
 * Contexts where an existing JSDoc block is validated (@param, @returns, descriptions...).
 * It does not make the JSDoc mandatory there: that is controlled by functionContexts.
 */
const documentedFunctionContexts = [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
];

/**
 * A JSDoc block written before a call that receives a callback, e.g.:
 *     /** Adds the rows. ... *\/
 *     master.data.each(function (obj) {...});
 * eslint-plugin-jsdoc does not link that block to the callback, so the rules that only read the block
 * (descriptions and types) also run on these statements, and custom-backoffice/callback-doc checks
 * the rest (@param, @returns and @throws against the callback).
 */
const callbackStatement = 'ExpressionStatement[expression.type="CallExpression"]';
const documentedBlockContexts = [...documentedFunctionContexts, callbackStatement];

/**
 * Custom plugin with the BackOffice rules that eslint-plugin-jsdoc does not cover.
 */
const customBackOfficePlugin = {
    rules: {
        /**
         * Validates that the file starts with the documentation header (@file + @description).
         */
        'file-header': {
            meta: { type: 'problem' },
            create(context) {
                return {
                    Program(node) {
                        const sourceCode = context.sourceCode || context.getSourceCode();
                        const firstToken = sourceCode.getFirstToken(node);

                        // Empty files do not need a header.
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
         * Validates the class JSDoc block as in the BackOffice template:
         * main description line + @description tag + @extends when the class inherits.
         * Classes without a JSDoc block are reported by jsdoc/require-jsdoc.
         */
        'class-doc': {
            meta: { type: 'problem' },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                /**
                 * Checks the JSDoc block of a class.
                 *
                 * @param {Object} node - The class node.
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
                    // An empty @description is reported by jsdoc/match-description (translated as "está vacía").
                    const hasDescriptionTag = /@description\b/.test(jsdoc.value);

                    if (!mainText) {
                        // Reported on the first line inside the block, where jsdoc/match-description also reports.
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
         * Validates the JSDoc block written before a call that receives a callback
         * (e.g. master.data.each(function (obj) {...})), which eslint-plugin-jsdoc does not link to the callback:
         * every parameter has its @param, no @param is left over, @returns exists and @throws exists if it throws.
         */
        'callback-doc': {
            meta: { type: 'problem' },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();
                const isFunction = (n) => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');

                /**
                 * Checks if a function body throws, without entering nested functions.
                 *
                 * @param {Object} node - The node to inspect.
                 * @returns {boolean} True when a throw statement is found.
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
         * Validates that the documentation is written in English.
         * Heuristic without dependencies: a block fails if its text has Spanish characters (á, é, ñ, ¿...)
         * or at least 2 different common Spanish words. Text between quotes or backticks is allowed
         * (business names), and tags with names or references (@file, @extends, @see...) are skipped.
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
                                    .replace(/(["'`]).*?\1/g, ' ')                       // quoted names
                                    .replace(/\{[^}]*\}/g, ' ')                          // {types}
                                    .replace(/^@(param|arg|argument|property|prop)\s+\[?[\w$.]+\]?/, ' ') // param name
                                    .replace(/^@\w+/, ' ');                              // tag name

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
 * Spanish messages for the eslint-plugin-jsdoc rules: [rule, pattern of the original message, new message].
 * "$1" is replaced with the value captured by the pattern (parameter or tag name).
 * Messages not listed here are shown as they are, so a missing entry never breaks the validation.
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
 * Processor that only replaces the messages of the jsdoc rules with the Spanish ones.
 * The code is not modified and the rules keep working the same way.
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

        // Lines already reported by the class rule: the generic format message there would be a duplicate.
        const classLines = new Set(messages[0].filter(m => m.ruleId === 'custom-backoffice/class-doc').map(m => m.line));

        return messages[0].filter(m => !(m.ruleId === 'jsdoc/match-description' && classLines.has(m.line))).map((msg) => {
            // A tag written without text (e.g. "* @description") is reported as empty, not as a format problem.
            const line = lines[msg.line - 1] || '';
            const emptyTag = line.match(/^\s*\*?\s*@(\w+)\s*(\{[^}]*\})?\s*$/);
            if (msg.ruleId === 'jsdoc/match-description' && emptyTag) {
                return { ...msg, message: `La etiqueta @${emptyTag[1]} está vacía; escribe la descripción después de la etiqueta.` };
            }
            // A @param written without description (e.g. "* @param {Object} obj -").
            const emptyParam = line.match(/^\s*\*?\s*@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?\[?([\w$.]+)\]?\s*-?\s*$/);
            if (/^jsdoc\/(match-description|require-param-description)$/.test(msg.ruleId) && emptyParam) {
                return { ...msg, message: `Falta la descripción del parámetro "${emptyParam[1]}"; ejemplo: @param {tipo} ${emptyParam[1]} - Descripción.` };
            }

            const entry = spanishMessages.find(([rule, pattern]) => rule === msg.ruleId && pattern.test(msg.message));
            if (!entry) return msg;
            const match = msg.message.match(entry[1]) || [];
            return { ...msg, message: entry[2].replace(/\$(\d)/g, (_, n) => match[n] || '') };
        }).filter((msg, _, all) => {
            // Same text on the same line is shown once, keeping the specific rule over jsdoc/match-description.
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
            // Header at the top of every file.
            'custom-backoffice/file-header': 'error',

            // Class block as in the template: description + @description + @extends.
            'custom-backoffice/class-doc': 'error',

            // Documentation written in English only.
            'custom-backoffice/english-only': 'error',

            // JSDoc written before a call that receives a callback (e.g. data.each(function (obj) {...})).
            'custom-backoffice/callback-doc': 'error',

            // Format.
            'jsdoc/require-asterisk-prefix': 'error',
            'jsdoc/check-alignment': 'error',
            'jsdoc/check-tag-names': ['error', { definedTags: ['fileoverview'] }],

            // A JSDoc block is mandatory for classes, methods and functions.
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

            // Every documented element must have a description (main text or @description).
            'jsdoc/require-description': ['error', {
                descriptionStyle: 'any',
                contexts: ['any'],
            }],

            // Descriptions start with an uppercase letter and end with a period.
            'jsdoc/match-description': ['error', {
                mainDescription: '^(?:[A-Z][\\s\\S]*\\.\\s*)?$',
                matchDescription: '^[A-Z][\\s\\S]*\\.\\s*$',
                // "description: true" is required so eslint-plugin-jsdoc 42 (Node 14) also validates the @description tag.
                tags: {
                    param: true,
                    throws: true,
                    description: true,
                },
                // By default only functions are checked; include classes too.
                contexts: ['ClassDeclaration', ...documentedBlockContexts],
            }],

            // Parameters.
            'jsdoc/require-param': ['error', { contexts: documentedFunctionContexts }],
            'jsdoc/require-param-type': ['error', { contexts: documentedBlockContexts }],
            'jsdoc/require-param-description': ['error', { contexts: documentedBlockContexts }],
            'jsdoc/check-param-names': ['error', { checkDestructured: false, enableFixer: false }],

            // Return values: @returns is mandatory in every function (use {void} when nothing is returned, as in the template).
            'jsdoc/require-returns': ['error', { contexts: documentedFunctionContexts, forceRequireReturn: true }],
            'jsdoc/require-returns-type': ['error', { contexts: documentedBlockContexts }],

            // Errors.
            'jsdoc/require-throws': ['error', { contexts: documentedFunctionContexts }],
        },
    },
];