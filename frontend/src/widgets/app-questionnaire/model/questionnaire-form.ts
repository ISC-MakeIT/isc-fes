import { v } from "@/shared/lib/valibot";

export const QuestionnaireFormValues = v.object({
  rating: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1, "評価を選択してください"),
    v.maxValue(5, "評価は5以下で選択してください"),
  ),
  comment: v.pipe(
    v.string(),
    v.maxLength(1000, "1000文字以内で入力してください"),
  ),
});

export type QuestionnaireFormValues = v.InferOutput<
  typeof QuestionnaireFormValues
>;

export const defaultQuestionnaireFormValues: QuestionnaireFormValues = {
  rating: 0,
  comment: "",
};
