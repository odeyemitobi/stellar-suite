import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-black/[.08] bg-white/80 backdrop-blur-md dark:border-white/[.145] dark:bg-black/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-black dark:text-zinc-50">
          <span className="text-xl">Stellar Suite</span>
        </Link>
        <div className="flex items-center gap-8 text-sm font-medium">
          <Link
            href="/"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Home
          </Link>
          <Link
            href="/changelog"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Changelog
          </Link>
        </div>
      </div>
    </nav>
  );
}
