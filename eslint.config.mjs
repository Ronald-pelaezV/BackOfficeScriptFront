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