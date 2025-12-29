export type SqlParams = unknown[]

/**
 * Tiny tagged template helper that builds parameterized SQL.
 *
 * Usage:
 *   const q = sql`SELECT * FROM t WHERE id = ${id}`
 *   await pool.query(q.text, q.values)
 *
 * It safely turns each interpolation into a $1, $2, ... placeholder and returns
 * the final text and values array for pg's query() API.
 */
export const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  let text = ''
  const params: SqlParams = []

  strings.forEach((chunk, i) => {
    text += chunk
    if (i < values.length) {
      params.push(values[i])
      text += `$${params.length}`
    }
  })

  return { text, values: params }
}
