import { AST_NODE_TYPE, TirParser } from './parsers/tir-parser.js'

const TABULAR_DATA_KEY = '$tabular_data'

class TireProperties extends Map {
  constructor(iterable) {
    super(iterable)
  }

  /**
   * Parses a TIR file and loads its sections and properties into a Map.
   *
   * @param {string} fileString - The contents of a TIR file.
   */
  fromTirFile(fileString) {
    const ast = TirParser.parse(fileString)
    for (const commentOrSection of ast.details.commentsOrSections) {
      if (commentOrSection.type === AST_NODE_TYPE.SECTION) {
        const sectionName =
          commentOrSection.details.header.details.symbol.details.value
        const sectionMap = new Map()

        for (
          const sectionBodyLine of commentOrSection.details.body.details
            .lines
        ) {
          const line = sectionBodyLine.details.line
          if (line.type === AST_NODE_TYPE.GENERIC_STATEMENT) {
            const statement = line.details.statement
            switch (statement.type) {
              case AST_NODE_TYPE.ASSIGNMENT_STATEMENT: {
                const { symbol, value } = statement.details
                sectionMap.set(
                  symbol.details.value.toUpperCase(),
                  value.details.value,
                )
                break
              }
              case AST_NODE_TYPE.TABULAR_STATEMENT: {
                const { leftNum, rightNum } = statement.details

                if (sectionMap.has(TABULAR_DATA_KEY)) {
                  const existingTuples = sectionMap.get(TABULAR_DATA_KEY)
                  sectionMap.set(TABULAR_DATA_KEY, [
                    ...existingTuples,
                    [leftNum.details.value, rightNum.details.value],
                  ])
                } else {
                  sectionMap.set(TABULAR_DATA_KEY, [
                    [leftNum.details.value, rightNum.details.value],
                  ])
                }
                break
              }
              default: {
                // Do nothing
              }
            }
          }
        }
        this.set(sectionName.toUpperCase(), sectionMap)
      }
    }
  }
}

export { TABULAR_DATA_KEY, TireProperties }
