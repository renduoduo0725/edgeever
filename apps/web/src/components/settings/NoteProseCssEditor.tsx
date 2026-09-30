import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { githubDark, githubLightInit } from "@uiw/codemirror-themes-all";

const cssLanguage = css();
const lightTheme = githubLightInit();

const cssEditorChrome = EditorView.theme({
  "&": {
    fontSize: "12px",
  },
  ".cm-scroller": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: "1.25rem",
  },
  ".cm-content, .cm-gutter": {
    minHeight: "100%",
  },
  ".cm-content": {
    padding: "8px 12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export const NoteProseCssEditor = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  dark,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  dark: boolean;
}) => {
  const extensions = useMemo(() => [
    cssLanguage,
    cssEditorChrome,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      spellcheck: "false",
    }),
  ], [ariaLabel]);
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={dark ? githubDark : lightTheme}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLineGutter: false,
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={onChange}
      className="h-full overflow-hidden rounded-md border border-slate-200 focus-within:ring-2 focus-within:ring-slate-300"
    />
  );
};
