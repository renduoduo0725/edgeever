import { getTemplate, getTheme, getTemplates, getThemes, parseSyntax } from "@antv/infographic";
import type { InfographicSyntaxAdapter } from "@edgeever/shared";

export const infographicSyntaxAdapter: InfographicSyntaxAdapter = {
  parse: syntax => {
    const parsed = parseSyntax(syntax);
    return { options: parsed.options as ReturnType<InfographicSyntaxAdapter["parse"]>["options"], errors: parsed.errors, warnings: parsed.warnings };
  },
  hasTemplate: template => Boolean(getTemplate(template)),
  hasTheme: theme => Boolean(getTheme(theme)),
};

export const infographicCapabilities = () => ({ templates: getTemplates(), themes: getThemes(), maxOperations: 100 });
