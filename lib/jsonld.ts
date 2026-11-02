/**
 * JSON-LD helpers.
 *
 * `JSON.stringify` leaves `<` untouched, so a dataset string containing
 * `</script>` would close the `application/ld+json` block and the rest would be
 * parsed as HTML. Escaping `<` as `\u003c` keeps the JSON valid and inert.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
