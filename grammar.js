/**
 * @file Grammar for the code generation of Onyx
 * @author ak-elements <akelements.dev@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const SEMICOLON = ';';
const decimalDigitSequence = /([0-9][0-9_]*[0-9]|[0-9])/;

const scalarTypes = [
    'u8','u16','u32','u64',
    's8','s16','s32','s64','s128',
    'f32','f64'
  ];

// taken from c# grammar
const PREC = {
    GENERIC: 19,
    DOT: 18,
    INVOCATION: 18,
    POSTFIX: 18,
    PREFIX: 17,
    UNARY: 17,
    CAST: 17,
    RANGE: 16,
    SWITCH: 15,
    WITH: 14,
    MULT: 13,
    ADD: 12,
    SHIFT: 11,
    REL: 10,
    EQUAL: 9,
    AND: 8,
    XOR: 7,
    OR: 6,
    LOGICAL_AND: 5,
    LOGICAL_OR: 4,
    COALESCING: 3,
    CONDITIONAL: 2,
    ASSIGN: 1,
    SELECT: 0,
  };

export default grammar({
  name: "onyx",

  conflicts: $ => [
  ],

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\r?\n/,
    $.line_continuation,
  ],

  inline: $ => [
  ],

  supertypes: $ => [
    $.expression,
    $.declaration,
    $.literal,
  ],

  rules: {
    compilation_unit: $ => repeat($.type_declaration),

    declaration: $ => choice(
        $.type_declaration,
        $.field_declaration,
        $.enum_declaration,
    ),

    type_declaration: $ => choice(
        $.component_declaration,
        $.enum_declaration
    ),

    component_declaration: $ => seq(
      repeat($.attribute_list),
      'component',
      field('name', $.identifier),
      field('body', $.declaration_list)
    ),

    declaration_list: $ => seq(
      '{',
      repeat(choice($.field_declaration, $.enum_declaration)),
      '}'
    ),

    field_declaration: $ => seq(
        repeat($.attribute_list),
        field('type', $.type_identifier),
        field('name', $.identifier),
        optional(field("value", $.field_initializer)),
        optional(SEMICOLON),
        $._newline
    ),

    field_initializer: $ => choice(
        $.assignment_expression,
        $.initializer_list
    ),

    assignment_expression: $ => seq(
        '=',
        $.expression
    ),

    initializer_list: $ => seq(
        '{',
        commaSep($.expression),
        '}'
    ),

    enum_declaration: $ => seq(
        $._enum_declaration_initializer,
        choice(
            seq(field('body', $.enum_member_declaration_list), optional(',')),
            SEMICOLON
        )
    ),

    _enum_declaration_initializer: $ => seq(
        repeat($.attribute_list),
        'enum',
        field('name', $.identifier)
      ),

    enum_member_declaration_list: $ => seq(
        '{',
        commaSep($.enum_member_declaration),
        optional(','),
        '}',
    ),

    enum_member_declaration: $ => seq(
        repeat($.attribute_list),
        field('name', $.identifier),
        optional(seq('=', field('value', $.integer_literal))),
    ),

    // =====================
    // Attributes
    // =====================

    attribute_list: $ => seq(
      '[',
      commaSep1($.attribute),
      ']'
    ),

    attribute: $ => seq(
        $.attribute_name,
        optional($.attribute_arguments),
    ),

    attribute_name: $ => $.identifier,

    attribute_arguments: $ => seq(
      '(',
      commaSep1($.expression),
      ')'
    ),

    type_identifier: $ => choice($._name, $._primitive_type, $._vector_type,),

    _vector_type: _ => token(
        new RegExp(`Vector[234](${scalarTypes.join('|')}|onyx(${scalarTypes.map(t => t[0].toUpperCase() + t.slice(1)).join('|')}))`)
    ),

    _primitive_type: _ => token(choice(
        'bool',
        new RegExp(`(${scalarTypes.join('|')}|onyx(${scalarTypes.map(t => t[0].toUpperCase() + t.slice(1)).join('|')}))`),
        'String',
        'StringView',
      )),

    expression: $ => choice(
        $.literal,
        $.identifier,
        $.initializer_list
    ),

    initializer_list: $ => seq(
    '{',
    commaSep($.expression),
    '}'
    ),

    _name: $ => choice(
        $.alias_qualified_name,
        $.qualified_name,
        $._simple_name,
      ),
  
    alias_qualified_name: $ => seq(
        field('alias', $.identifier),
        '::',
        field('name', $._simple_name),
    ),

    _simple_name: $ => choice(
        $.identifier,
        $.template_type,
    ),

    qualified_name: $ => prec(PREC.DOT, seq(
        field('qualifier', $._name),
        '.',
        field('name', $._simple_name),
    )),

    template_type: $ => seq($.identifier, $.type_argument_list),

    type_argument_list: $ => seq(
        '<',
        choice(
            repeat(','),
            commaSep1($.type_identifier),
        ),
        '>',
    ),

    _identifier_token: _ => token(seq(optional('@'), /(\p{XID_Start}|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/)),
    identifier: $ => $._identifier_token,

    literal: $ => choice(
        $.integer_literal,
        $.float_literal,
        $.boolean_literal,
        $.string_literal,
      ),

    string_literal: $ => seq(
        '"',
        repeat(choice(
          $.string_literal_content,
          $.escape_sequence,
        )),
        '"'
    ),

    string_literal_content: _ => choice(
        token.immediate(prec(1, /[^"\\\n]+/)),
        prec(2, token.immediate(seq('\\', /[^abefnrtv'\"\\\?0]/))),
    ),
  
    escape_sequence: _ => token(choice(
        /\\x[0-9a-fA-F]{1,4}/,
        /\\u[0-9a-fA-F]{4}/,
        /\\U[0-9a-fA-F]{8}/,
        /\\[abefnrtv'\"\\\?0]/,
    )),

    boolean_literal: _ => choice('true', 'false'),
    
    float_literal: $ => /\d+\.\d+f?/,
    
    integer_literal: _ => token(seq(
        choice(
            decimalDigitSequence, // Decimal
            (/0[xX][0-9a-fA-F_]*[0-9a-fA-F]+/), // Hex
            (/0[bB][01_]*[01]+/), // Binary
        ),
        optional(/([uU][lL]?|[lL][uU]?)/),
    )),

    _newline: $ => /\r?\n+/,

    line_continuation: _ => token(seq('\\', choice(seq(optional('\r'), '\n'), '\0'))),

    comment: _ => token(choice(
        seq('//', /[^\n\r]*/),
        seq(
          '/*',
          /[^*]*\*+([^/*][^*]*\*+)*/,
          '/',
        ),
    )),
  }
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @returns {SeqRule}
 */
function commaSep(rule) {
    return optional(sep1(rule, ','));
  }

/**
 * Creates a rule to match two or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
    return sep1(rule, ',');
  }
  
  /**
   * Creates a rule to match one or more occurrences of `rule` separated by `sep`
   *
   * @param {RuleOrLiteral} rule
   *
   * @param {RuleOrLiteral} separator
   *
   * @returns {SeqRule}
   */
  function sep1(rule, separator) {
    return seq(rule, repeat(seq(separator, rule)));
  }