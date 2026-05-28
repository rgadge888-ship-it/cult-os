import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl w-full space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            cult marketers
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Cult OS</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            internal operating system. leads, clients, reports — all in one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
