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
import { FieldError } from "@/shared/ui/field";
import { ActionButton } from "@/shared/ui/action-button";
import { Rating } from "@/shared/ui/rating";

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
    onSuccess: onSubmitted,
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
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="rating"
        children={(field) => (
          <Rating
            name={field.name}
            value={field.state.value}
            max={5}
            precision={1}
            size={40}
            variant="yellow"
            disabled={mutation.isPending}
            onValueChange={(rating) => field.handleChange(rating)}
            onBlur={field.handleBlur}
          />
        )}
      />

      <form.Field
        name="comment"
        children={(field) => (
          <Textarea
            id="comment"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(event.target.value);
            }}
          />
        )}
      />

      {mutation.isError && <FieldError>{mutation.error.message}</FieldError>}

      <ActionButton
        type="submit"
        disabled={mutation.isPending}
        className="w-full"
      >
        送信
      </ActionButton>
    </form>
  );
}
