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
            const emptyTag = (lines[msg.line - 1] || '').match(/^\s*\*?\s*@(\w+)\s*$/);
            if (msg.ruleId === 'jsdoc/match-description' && emptyTag) {
                return { ...msg, message: `La etiqueta @${emptyTag[1]} está vacía; escribe la descripción después de la etiqueta.` };
            }

            const entry = spanishMessages.find(([rule, pattern]) => rule === msg.ruleId && pattern.test(msg.message));
            if (!entry) return msg;
            const match = msg.message.match(entry[1]) || [];
            return { ...msg, message: entry[2].replace(/\$(\d)/g, (_, n) => match[n] || '') };
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
                contexts: ['ClassDeclaration', ...functionContexts],
            }],

            // Parameters.
            'jsdoc/require-param': ['error', { contexts: functionContexts }],
            'jsdoc/require-param-type': ['error', { contexts: functionContexts }],
            'jsdoc/require-param-description': ['error', { contexts: functionContexts }],
            'jsdoc/check-param-names': ['error', { checkDestructured: false, enableFixer: false }],

            // Return values: @returns is mandatory in every function (use {void} when nothing is returned, as in the template).
            'jsdoc/require-returns': ['error', { contexts: functionContexts, forceRequireReturn: true }],
            'jsdoc/require-returns-type': ['error', { contexts: functionContexts }],

            // Errors.
            'jsdoc/require-throws': ['error', { contexts: functionContexts }],
        },
    },
];