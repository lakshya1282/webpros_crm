/**
 * Template renderer for WhatsApp message templates.
 *
 * Supported merge fields: {{name}}, {{company}}
 *
 * Rules:
 * - If a merge field value is missing or empty, use the provided fallback.
 * - If no fallback is provided, use a sensible default (e.g. "there" for name).
 * - NEVER print the literal {{fieldName}} in the final output.
 */

export interface TemplateVariables {
  name?: string | null;
  company?: string | null;
}

export interface TemplateFallbacks {
  name?: string;
  company?: string;
}

const DEFAULT_FALLBACKS: Required<TemplateFallbacks> = {
  name: "there",
  company: "your company",
};

/**
 * Renders a message template with the given variables.
 *
 * @param template - Message template with {{name}}, {{company}} placeholders
 * @param variables - Actual contact values
 * @param fallbacks - Optional fallback strings for missing values
 * @returns Rendered message string safe to send to the contact
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
  fallbacks: TemplateFallbacks = {}
): string {
  const resolvedFallbacks = { ...DEFAULT_FALLBACKS, ...fallbacks };

  let rendered = template;

  // Replace {{name}}
  const nameValue =
    variables.name?.trim() || resolvedFallbacks.name;
  rendered = rendered.replace(/\{\{name\}\}/gi, nameValue);

  // Replace {{company}}
  const companyValue =
    variables.company?.trim() || resolvedFallbacks.company;
  rendered = rendered.replace(/\{\{company\}\}/gi, companyValue);

  // Safety net: remove any remaining unresolved {{anything}} placeholders
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");

  return rendered.trim();
}

/**
 * Extracts all merge field names from a template string.
 *
 * @param template - Message template
 * @returns Array of unique field names found in the template
 */
export function extractMergeFields(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/gi);
  const fields = new Set<string>();
  for (const match of matches) {
    fields.add(match[1].toLowerCase().trim());
  }
  return Array.from(fields);
}

/**
 * Validates that a template only contains supported merge fields.
 *
 * @param template - Message template
 * @returns { valid: boolean, unknownFields: string[] }
 */
export function validateTemplate(template: string): {
  valid: boolean;
  unknownFields: string[];
} {
  const SUPPORTED_FIELDS = new Set(["name", "company"]);
  const fields = extractMergeFields(template);
  const unknownFields = fields.filter((f) => !SUPPORTED_FIELDS.has(f));
  return {
    valid: unknownFields.length === 0,
    unknownFields,
  };
}
