import { LoginButton } from "@/_pages/login/ui/login-button";

export async function LoginView() {
  return (
    <div className="m-auto space-y-9 text-center font-bold">
      {/* TODO: アプリ名が決まったら書き換える */}
      <h1 className="text-4xl sm:text-6xl">アプリ名があれば</h1>
      <LoginButton />
    </div>
  );
}
