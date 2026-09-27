import type { CompanionAnswer, CompanionQuestion } from "@edgeever/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function CompanionQuestionForm({
  questions, busy, onSubmit,
}: {
  questions: CompanionQuestion[]; busy: boolean; onSubmit: (answers: CompanionAnswer[]) => void;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, { optionIds: string[]; text: string }>>({});
  const value = (id: string) => answers[id] ?? { optionIds: [], text: "" };
  const ready = questions.every(question => {
    const current = value(question.id);
    if (question.inputType === "free_text") return Boolean(current.text.trim());
    return current.optionIds.length > 0 || Boolean(current.text.trim());
  });
  return (
    <form className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-2.5" onSubmit={event => {
      event.preventDefault();
      if (!ready || busy) return;
      onSubmit(questions.map(question => {
        const current = value(question.id);
        return {
          questionId: question.id,
          ...(current.optionIds.length ? { optionIds: current.optionIds } : {}),
          ...(current.text.trim() ? { text: current.text.trim() } : {}),
        };
      }));
    }}>
      <p className="text-xs font-semibold text-slate-800">{t("companion.questions.title")}</p>
      {questions.map(question => (
        <fieldset key={question.id} className="space-y-1.5">
          <legend className="text-xs text-slate-700">{question.prompt}</legend>
          {question.inputType !== "free_text" && question.options?.map(option => (
            <label key={option.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type={question.inputType === "multi_select" ? "checkbox" : "radio"}
                name={question.id}
                checked={value(question.id).optionIds.includes(option.id)}
                disabled={busy}
                onChange={event => setAnswers(previous => {
                  const current = previous[question.id] ?? { optionIds: [], text: "" };
                  const optionIds = question.inputType === "multi_select"
                    ? (event.target.checked ? [...current.optionIds, option.id] : current.optionIds.filter(id => id !== option.id))
                    : [option.id];
                  return { ...previous, [question.id]: { ...current, optionIds } };
                })}
              />
              {option.label}
            </label>
          ))}
          {(question.inputType === "free_text" || question.inputType !== "multi_select") ? (
            <input
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-900"
              placeholder={question.inputType === "free_text" ? undefined : t("companion.questions.other")}
              disabled={busy}
              value={value(question.id).text}
              onChange={event => setAnswers(previous => ({
                ...previous, [question.id]: { ...value(question.id), text: event.target.value },
              }))}
            />
          ) : null}
        </fieldset>
      ))}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !ready}>{t("companion.questions.submit")}</Button>
      </div>
    </form>
  );
}
