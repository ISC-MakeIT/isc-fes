import { SubmitButton } from "@/shared/ui/submit-button";

type ErrorViewProps = {
  retryFunction: () => void;
};

export function ErrorView({ retryFunction }: ErrorViewProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-3">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-primary text-shadow-secondary text-8xl font-bold text-shadow-[4px_4px_0] md:text-9xl">
          Error
        </h1>

        <p className="text-base md:text-xl">
          予期せぬエラーが発生しました。
          <br />
          時間をおいて再度お試しください。
        </p>
      </div>

      <SubmitButton
        isDot={false}
        className="px-10 py-4 text-base font-bold md:text-2xl"
        onClick={retryFunction}
      >
        リトライ
      </SubmitButton>
    </div>
  );
}
