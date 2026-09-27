import { LoginButton } from "@/_pages/login/ui/login-button";

type LoginViewProps = {
  redirectTo?: string;
};

export async function LoginView({ redirectTo }: LoginViewProps) {
  return (
    <div className="m-auto space-y-9 text-center font-bold">
      <h1 className="text-4xl sm:text-6xl">ふぇすNavi</h1>
      <LoginButton redirectTo={redirectTo} />
    </div>
  );
}
