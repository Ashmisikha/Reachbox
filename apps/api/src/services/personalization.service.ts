import { SUPPORTED_PERSONALIZATION_VARIABLES, type PersonalizationVariable } from '@reachinbox/shared';

export interface RecipientPersonalizationContext {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  [key: string]: unknown;
}

export interface RenderResult {
  rendered: string;
  usedVariables: PersonalizationVariable[];
  missingVariables: PersonalizationVariable[];
}

/**
 * Deterministic Personalization Engine
 *
 * Requirements:
 * - Only supported variables: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{email}}
 * - Whitespace tolerance within brackets (e.g. {{ firstName }})
 * - Strictly no arbitrary expression execution (eval, Function, arithmetic, JS property lookups)
 * - Safe handling of null/undefined missing fields (replaces with empty string or empty fallback)
 * - Deterministic output
 */
export class PersonalizationService {
  private static readonly VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

  /**
   * Render template text replacing supported variables with recipient values.
   */
  public static render(
    templateText: string,
    context: RecipientPersonalizationContext = {},
    options: { fallbackValue?: string; preserveUnknown?: boolean } = {}
  ): RenderResult {
    if (!templateText) {
      return { rendered: '', usedVariables: [], missingVariables: [] };
    }

    const fallback = options.fallbackValue ?? '';
    const preserveUnknown = options.preserveUnknown ?? true;
    const usedVariables = new Set<PersonalizationVariable>();
    const missingVariables = new Set<PersonalizationVariable>();

    const rendered = templateText.replace(this.VARIABLE_REGEX, (match, varName: string) => {
      // Check if variable is one of the supported variables
      if (!SUPPORTED_PERSONALIZATION_VARIABLES.includes(varName as PersonalizationVariable)) {
        // Unknown variable: do not evaluate expressions, leave as-is or remove safely
        return preserveUnknown ? match : '';
      }

      const supportedVar = varName as PersonalizationVariable;
      usedVariables.add(supportedVar);

      const val = context[supportedVar];
      if (val !== undefined && val !== null && String(val).trim().length > 0) {
        return String(val);
      }

      missingVariables.add(supportedVar);
      return fallback;
    });

    return {
      rendered,
      usedVariables: Array.from(usedVariables),
      missingVariables: Array.from(missingVariables),
    };
  }

  /**
   * Personalize both subject and body in a single pass.
   */
  public static renderEmail(
    subject: string,
    body: string,
    context: RecipientPersonalizationContext = {},
    options: { fallbackValue?: string } = {}
  ): { subject: string; body: string; usedVariables: PersonalizationVariable[]; missingVariables: PersonalizationVariable[] } {
    const renderedSubject = this.render(subject, context, options);
    const renderedBody = this.render(body, context, options);

    const usedVars = new Set([...renderedSubject.usedVariables, ...renderedBody.usedVariables]);
    const missingVars = new Set([...renderedSubject.missingVariables, ...renderedBody.missingVariables]);

    return {
      subject: renderedSubject.rendered,
      body: renderedBody.rendered,
      usedVariables: Array.from(usedVars),
      missingVariables: Array.from(missingVars),
    };
  }
}
