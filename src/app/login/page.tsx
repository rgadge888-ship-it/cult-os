import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-orange-500">
            cult os
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Sign in
          </h1>
          <p className="text-sm text-zinc-500">
            admin and client logins. accounts are issued by your team.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
