/**
 * Recursively resolves a variable path in context.
 * Supports nested paths like 'request-1.body.title'
 * @param {object} context - the flow context object
 * @param {string} path - variable path, e.g. 'request-1.body.title'
 * @returns {any} - value at that path, or empty string if not found
 */
export function resolveVar(context, path) {
  if (!path) return "";
  const parts = path.split(".");
  let value = context;
  for (const part of parts) {
    if (value && part in value) {
      value = value[part];
    } else {
      return ""; // fallback if missing
    }
  }
  return value;
}

/**
 * Interpolates all {varName} placeholders in a string using context.
 * Handles nested paths: {request-1.body.title}, {userId}, etc.
 * @param {string} template - the string containing {vars}
 * @param {object} context - the flow context object
 * @returns {string} - string with all variables replaced
 */
export function interpolate(template, context) {
  if (!template) return "";
  return template.replace(/\{([^}]+)\}/g, (_, expr) => {
    expr = expr.trim();
    const val = resolveVar(context, expr);

    // If value is an object/array, stringify it
    if (typeof val === "object" && val !== null) return JSON.stringify(val);

    return val;
  });
}
