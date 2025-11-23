import type * as Monaco from "monaco-editor";

// Language ID for our custom assembler
export const ASSEMBLER_LANGUAGE_ID = "vc-asm";

// Language configuration for Monaco Editor
export const assemblerLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
    comments: {
        lineComment: ";",
    },
    brackets: [
        ["[", "]"],
        ["(", ")"],
    ],
    autoClosingPairs: [
        {open: "[", close: "]"},
        {open: "(", close: ")"},
        {open: '"', close: '"'},
        {open: "'", close: "'"},
    ],
    surroundingPairs: [
        {open: "[", close: "]"},
        {open: "(", close: ")"},
        {open: '"', close: '"'},
        {open: "'", close: "'"},
    ],
};

// Monarch tokenization provider for syntax highlighting
export const assemblerMonarchLanguage: Monaco.languages.IMonarchLanguage = {
    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: "invalid",
    ignoreCase: true,

    // Opcodes from CPU specification
    opcodes: [
        "NOP",
        "LD",
        "ST",
        "MOV",
        "ADD",
        "SUB",
        "AND",
        "OR",
        "XOR",
        "SHL",
        "SHR",
        "CMP",
        "JMP",
        "CALL",
        "RET",
        "RTI",
        "PUSH",
        "POP",
        "INC",
        "DEC",
        "ROL",
        "ROR",
        "SEI",
        "CLI",
    ],

    // Branch instructions (conditional jumps)
    branches: ["BRZ", "BRNZ", "BRC", "BRNC", "BRN", "BRNN", "BRV", "BRNV"],

    // Assembler directives
    directives: [
        ".org",
        ".byte",
        ".db",
        ".word",
        ".dw",
        ".string",
        ".asciiz",
        ".define",
        ".equ",
        ".res",
        ".dsb",
        ".align",
    ],

    // Registers
    registers: ["R0", "R1", "R2", "R3", "R4", "R5", "SP", "PC"],

    // Operators
    operators: [
        "+",
        "-",
        "*",
        "/",
        "%",
        "&",
        "|",
        "^",
        "~",
        "<<",
        ">>",
        "==",
        "!=",
        "<",
        ">",
        "<=",
        ">=",
        "&&",
        "||",
        "!",
    ],

    // Escape sequences for strings
    escapes: /\\(?:[nrt\\"'0]|x[0-9a-fA-F]{2})/,

    // The main tokenizer for our assembler language
    tokenizer: {
        root: [
            // Comments
            [/;.*$/, "comment"],

            // Directives (case-insensitive, start with .)
            [
                /\.[a-zA-Z_]\w*/,
                {
                    cases: {
                        "@directives": "keyword.directive",
                        "@default": "identifier",
                    },
                },
            ],

            // Labels (identifier followed by colon)
            [/[a-zA-Z_.][a-zA-Z0-9_.]*:/, "type.identifier"],

            // Opcodes and branch instructions (case-insensitive)
            [
                /[a-zA-Z_]\w*/,
                {
                    cases: {
                        "@opcodes": "keyword.opcode",
                        "@branches": "keyword.branch",
                        "@registers": "variable.register",
                        "@default": "identifier",
                    },
                },
            ],

            // Whitespace
            {include: "@whitespace"},

            // Numbers - Hexadecimal with $ prefix (6502 style)
            [/\$[0-9a-fA-F]+/, "number.hex"],

            // Numbers - Hexadecimal with 0x prefix (C style)
            [/0[xX][0-9a-fA-F]+/, "number.hex"],

            // Numbers - Binary with % prefix
            [/%[01]+/, "number.binary"],

            // Numbers - Binary with 0b prefix
            [/0[bB][01]+/, "number.binary"],

            // Numbers - Decimal
            [/\d+/, "number"],

            // Character literals (single quotes)
            [/'([^'\\]|@escapes)'/, "string.char"],
            [/'/, "string.invalid"],

            // Strings (double quotes)
            [/"/, {token: "string.quote", bracket: "@open", next: "@string"}],

            // Immediate mode indicator
            [/#/, "keyword.immediate"],

            // Memory addressing brackets
            [/[[\]]/, "@brackets"],

            // Register pair separator
            [/:/, "delimiter.colon"],

            // Operators
            [/[+\-*/%&|^~!<>=]+/, "operator"],

            // Delimiters
            [/,/, "delimiter.comma"],
        ],

        string: [
            [/[^\\"]+/, "string"],
            [/@escapes/, "string.escape"],
            [/\\./, "string.escape.invalid"],
            [/"/, {token: "string.quote", bracket: "@close", next: "@pop"}],
        ],

        whitespace: [[/[ \t\r\n]+/, "white"]],
    },
};

// Register the assembler language with Monaco
export function registerAssemblerLanguage(monaco: typeof Monaco) {
    // Register the language
    monaco.languages.register({id: ASSEMBLER_LANGUAGE_ID});

    // Set language configuration
    monaco.languages.setLanguageConfiguration(ASSEMBLER_LANGUAGE_ID, assemblerLanguageConfiguration);

    // Set monarch tokenizer
    monaco.languages.setMonarchTokensProvider(ASSEMBLER_LANGUAGE_ID, assemblerMonarchLanguage);
}
