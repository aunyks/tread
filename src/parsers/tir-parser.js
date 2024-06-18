import { grammar } from '../../vendor/ohm-17.js'

/**
 * The types of nodes that may comprise a Tire Properties File (.tir)
 * abstract syntax tree (AST).
 */
const AST_NODE_TYPE = Object.freeze({
  FILE: 'tir_file',
  SECTION: 'section',
  SECTION_HEADER: 'section_header',
  SECTION_BODY: 'section_body',
  SECTION_BODY_LINE: 'section_body_line',
  GENERIC_STATEMENT: 'stmt_generic',
  COMMENT: 'comment',
  TABULAR_STATEMENT: 'stmt_tabular',
  ASSIGNMENT_STATEMENT: 'stmt_assign',
  SYMBOL: 'symbol',
  STRING_LITERAL: 'number_literal',
  NUMBER_LITERAL: 'number_literal',
})

const grammarDefinition = String.raw`
Tir {
  TirFile = (comment | Section)+
  Section = bracketedHeader SectionBody?
  SectionBody = SectionBodyLine*
  SectionBodyLine = comment | GenericStatement
  GenericStatement = AssignmentStatement | TabularStatement
  bracketedHeader = "[" symbol "]"
  comment = ("!" | "$" | "{") (~newLine space)* (~newLine any)* newLine
  TabularStatement = number number 
  AssignmentStatement = symbol "=" value 
  symbol = letter (alnum | "_")*
  value = string | number
  string = quoteMark (~quoteMark any)* quoteMark
  number =  scientificNotation | float | integer
  scientificNotation = (float | integer) ("e" | "E") ("+" | "-")? digit+
  float = ("+" | "-")? digit+ "." digit+
  integer = ("+" | "-")? digit+
  quoteMark = "'"

  newLine = "\r"? "\n"
}
`

const tirGrammar = grammar(grammarDefinition)

const tirSemantics = tirGrammar.createSemantics()
tirSemantics.addOperation('parse', {
  TirFile(commentsOrSections) {
    return {
      type: AST_NODE_TYPE.FILE,
      details: {
        commentsOrSections: commentsOrSections.children.map((cOS) =>
          cOS.parse()
        ),
      },
    }
  },
  Section(header, body) {
    return {
      type: AST_NODE_TYPE.SECTION,
      details: {
        header: header.parse(),
        body: body.child(0)?.parse() || null,
      },
    }
  },
  SectionBody(body) {
    const lines = body.children
    return {
      type: AST_NODE_TYPE.SECTION_BODY,
      details: {
        lines: lines.map((l) => l.parse()),
      },
    }
  },
  SectionBodyLine(line) {
    return {
      type: AST_NODE_TYPE.SECTION_BODY_LINE,
      details: {
        line: line.parse(),
      },
    }
  },
  GenericStatement(stmt) {
    return {
      type: AST_NODE_TYPE.GENERIC_STATEMENT,
      details: {
        statement: stmt.parse(),
      },
    }
  },
  bracketedHeader(_openBracket, symbol, _closeBracket) {
    return {
      type: AST_NODE_TYPE.SECTION_HEADER,
      details: {
        symbol: symbol.parse(),
      },
    }
  },
  comment(commentVariant, _space, commentContents, _newLine) {
    return {
      type: AST_NODE_TYPE.COMMENT,
      details: {
        variant: commentVariant.sourceString,
        contents: commentContents.sourceString,
      },
    }
  },
  TabularStatement(numL, numR) {
    return {
      type: AST_NODE_TYPE.TABULAR_STATEMENT,
      details: {
        leftNum: numL.parse(),
        rightNum: numR.parse(),
      },
    }
  },
  AssignmentStatement(symbol, _equals, value) {
    return {
      type: AST_NODE_TYPE.ASSIGNMENT_STATEMENT,
      details: {
        symbol: symbol.parse(),
        value: value.parse(),
      },
    }
  },
  string(_openQuote, str, _closeQuote) {
    return {
      type: AST_NODE_TYPE.STRING_LITERAL,
      details: {
        value: str.sourceString,
      },
    }
  },
  symbol(_startLetter, _restOfCharacters) {
    return {
      type: AST_NODE_TYPE.SYMBOL,
      details: {
        value: this.sourceString,
      },
    }
  },
  number(_a) {
    return {
      type: AST_NODE_TYPE.NUMBER_LITERAL,
      details: {
        value: parseFloat(this.sourceString),
      },
    }
  },
  _iter(...nodes) {
    const parsedNodes = []
    for (const node of nodes) {
      parsedNodes.push(node.parse())
    }
    return parsedNodes
  },
})

/**
 * A parser for Tire Properties Files (.tir).
 */
class TirParser {
  constructor() {}

  /**
   * Creates a TIR file AST.
   *
   * @param {string} tirFile - The TIR file contents.
   * @returns an abstract syntax tree representing the provided TIR file string.
   */
  static parse(tirFile) {
    const matchResult = tirGrammar.match(tirFile)
    if (matchResult.succeeded()) {
      const ohmAdapter = tirSemantics(matchResult)
      return ohmAdapter.parse()
    }
    throw new Error(matchResult.message)
  }
}

export { AST_NODE_TYPE, TirParser }
