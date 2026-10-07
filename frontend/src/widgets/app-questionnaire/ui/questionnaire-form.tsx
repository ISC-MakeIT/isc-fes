"use client";

import { useMutation } from "@tanstack/react-query";
import { QuestionnaireTrigger } from "../config/questionnaire";
import { createReview } from "../api/create-review";
import { useAppForm } from "@/shared/lib/form-hook";
import {
  defaultQuestionnaireFormValues,
  QuestionnaireFormValues,
} from "../model/questionnaire-form";
import { v } from "@/shared/lib/valibot";
import { Textarea } from "@/shared/ui/textarea";
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/field";
import { ActionButton } from "@/shared/ui/action-button";
import { Rating } from "@/shared/ui/rating";
import { trackEvent } from "@/shared/lib/analytics";

type QuestionnaireFormProps = {
  trigger: QuestionnaireTrigger;
  onSubmitted: () => void;
};

export function QuestionnaireForm({
  trigger,
  onSubmitted,
}: QuestionnaireFormProps) {
  const mutation = useMutation({
    mutationFn: createReview,
    onSuccess: (_result, variables) => {
      trackEvent("submit_review", {
        trigger: variables.trigger,
        rating: variables.rating,
      });
      onSubmitted();
    },
  });

  const form = useAppForm({
    defaultValues: defaultQuestionnaireFormValues,

    validators: {
      onChange: QuestionnaireFormValues,
      onSubmit: QuestionnaireFormValues,
    },

    onSubmit: async ({ value }) => {
      const formValues = v.parse(QuestionnaireFormValues, value);
      const comment = formValues.comment.trim();

      await mutation.mutateAsync({
        rating: formValues.rating,
        comment,
        trigger,
      });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="space-y-6">
        <form.Field
          name="rating"
          children={(field) => (
            <Field>
              <FieldLabel
                className="text-lg font-semibold"
                htmlFor={field.name}
              >
                満足度
              </FieldLabel>
              <FieldContent>
                <Rating
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  max={5}
                  precision={1}
                  size={35}
                  variant="yellow"
                  className="sm:gap-4"
                  disabled={mutation.isPending}
                  onValueChange={(rating) => field.handleChange(rating)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <form.Field
          name="comment"
          children={(field) => (
            <Field>
              <FieldLabel
                className="text-lg font-semibold"
                htmlFor={field.name}
              >
                ご意見やご要望があれば、お気軽にお願いします。
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  className="border-primary rounded-sm border"
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                />
                {field.state.meta.isTouched && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </FieldContent>
            </Field>
          )}
        />
      </div>

      <div className="flex flex-col items-center pt-5">
        {mutation.isError && (
          <FieldError className="text-center">
            {mutation.error.message}
          </FieldError>
        )}
        <ActionButton
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md px-14 py-4 shadow-none"
        >
          送信
        </ActionButton>
      </div>
    </form>
  );
}
