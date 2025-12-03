import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 font-sans dark:from-black dark:to-zinc-900">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center gap-12 px-6 py-16 sm:px-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Language Noob
          </h1>
          <p className="max-w-md text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            Chọn phương thức dịch thuật phù hợp với nhu cầu của bạn
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {/* Chat Translation Card */}
          <Link
            href="/chat"
            className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                Dịch theo Chat
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              Dịch thuật theo dạng hội thoại chat với 2 chế độ: Tự phát hiện
              ngôn ngữ (dịch sang Tiếng Việt) hoặc chọn ngôn ngữ đích (dịch từ
              Tiếng Việt sang ngôn ngữ khác).
            </p>
            <div className="mt-auto flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <span>Bắt đầu</span>
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Screen Scan Translation Card */}
          <Link
            href="/screen-scan"
            className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                Dịch theo Quét Màn hình
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              Chọn và quét màn hình máy tính cần dịch, tự động nhận diện và dịch
              nội dung trên màn hình.
            </p>
            <div className="mt-auto flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
              <span>Bắt đầu</span>
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
