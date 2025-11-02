import { staticVars } from "./staticVars.js";

/**
 * Resolves a variable path in context, with fallback to defaults from the flow
 * @param {object} context - flow context (e.g., { variables: { name: "Ali" } })
 * @param {string} path - variable path, e.g., 'variables.name' or 'request-1.body.title'
 * @param {object} defaults - fallback defaults (e.g., flow defaults like { name: "Mustapha" })
 * @returns {any} - resolved value
 */
export function resolveVar(context, path, defaults = {}) {
  if (!path) return "";

  const parts = path.split(".");
  let value = context;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (value && typeof value === "object" && part in value) {
      value = value[part];
    } 
    else if (i === 0 && (part in context)) {
      // ✅ allow top-level namespaces: local, params, result, variables, etc.
      value = context[part];
    } 
    else if (i === parts.length - 1 && context.variables && part in context.variables) {
      value = context.variables[part];
    } 
    else if (i === parts.length - 1 && part in defaults) {
      value = defaults[part];
    } 
    else if (i === parts.length - 1 && part in staticVars) {
      const val = staticVars[part];
      value = typeof val === "function" ? val() : val;
    } 
    else {
      return "";
    }
  }

  return value;
}

/**
 * Interpolates all {varName} placeholders in a string using context,
 * falling back to defaults when the variable is missing.
 * @param {string} template - string containing {vars}
 * @param {object} context - flow context (e.g., { variables: { name: "Ali" } })
 * @param {object} defaults - fallback defaults (e.g., flow defaults like { name: "Mustapha" })
 * @returns {string} - string with variables replaced
 */
export function interpolate(template, context, defaults = {}) {
  if (!template) return "";

  return template.replace(/\{([^}]+)\}/g, (_, expr) => {
    expr = expr.trim();

    let val = resolveVar(context, expr, defaults);

    // Handle arrays nicely
    if (Array.isArray(val)) return val.join(", "); // join with commas or choose another separator

    // Handle plain objects
    if (val && typeof val === "object") return JSON.stringify(val);

    // fallback to empty string if undefined/null
    return val != null ? val : "";
  });
}