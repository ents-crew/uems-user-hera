module.exports = {
    env: {
        es2020: true,
        node: true,
    },
    extends: [
        'airbnb-typescript/base',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: [
        '@typescript-eslint',
    ],
    rules: {
        indent: ['error', 4, {
        	'SwitchCase': 1,
        }],
        'max-len': ['error', 120],
        'padded-blocks': 'off',
        'object-curly-newline': ['error', {
        	'ImportDeclaration': 'never',
        }],
        'linebreak-style': 'off',

        'no-unused-vars': 'off',
        'no-restricted-syntax': 'off',
        'no-use-before-define': 'off',
        'no-plusplus': ['error', {
            allowForLoopAfterthoughts: true,
        }],
        'no-underscore-dangle': 'off',
        'no-continue': 'off',
        'import/extensions': 0,
        'import/no-unresolved': 0,
        'import/prefer-default-export': 0,

        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/indent': ['error', 4],
    },
    settings: {
        'import/resolver': {
            node: {
                paths: ['src'],
            },
        },
    },
};
