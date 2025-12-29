
import ChatWidget from './chat/ChatWidget'
import { useEffect, useState } from 'react'
import { waitForBackend } from './chat/api'

function StartupLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
        <div className="text-sm text-zinc-600">Waking up support…</div>
      </div>
    </div>
  )
}

function App() {
  const [backendReady, setBackendReady] = useState(false)

  useEffect(() => {
    let active = true
    waitForBackend(90_000).then(() => {
      if (active) setBackendReady(true)
    })
    return () => { active = false }
  }, [])

  if (!backendReady) return <StartupLoader />

  return (
    <>
      <div className="relative h-screen overflow-hidden bg-zinc-50 text-zinc-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-fuchsia-300/45 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-[520px] w-[520px] rounded-full bg-indigo-300/35 blur-3xl" />
          <div className="absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-300/35 blur-3xl" />
        </div>

        <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
                <div className="h-3.5 w-3.5 rounded-sm bg-linear-to-br from-fuchsia-500 to-cyan-500" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">Spur</div>
                <div className="text-xs text-zinc-600">Modern essentials, elevated</div>
              </div>
            </div>

          </header>

          <main className="flex flex-1 items-center">
            <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-zinc-700 shadow-sm ring-1 ring-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Live support in the bottom-right
                </div>

                <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                  A premium storefront experience-
                  <span className="bg-linear-to-r from-fuchsia-600 via-zinc-900 to-cyan-600 bg-clip-text text-transparent">built for trust</span>
                </h1>

                <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-600">
                  Spur is your brand's clean, high-converting landing experience. Fast, minimal,
                  and ready for shoppers-plus instant support whenever they need it.
                </p>


                <div className="mt-7 grid max-w-xl grid-cols-3 gap-3 text-xs text-zinc-700">
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                    <div className="font-semibold text-zinc-900">Fast</div>
                    <div className="mt-1 text-zinc-600">Optimized UX</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                    <div className="font-semibold text-zinc-900">Secure</div>
                    <div className="mt-1 text-zinc-600">Built for trust</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                    <div className="font-semibold text-zinc-900">Support</div>
                    <div className="mt-1 text-zinc-600">Instant help</div>
                  </div>
                </div>
              </div>

              <div className="relative hidden md:block">
                <div className="absolute -inset-6 rounded-[28px] bg-linear-to-br from-fuchsia-300/35 to-cyan-300/25 blur-2xl" />
                <div className="relative rounded-[28px] bg-white/70 p-6 shadow-sm ring-1 ring-zinc-200 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Spur Preview</div>
                    <div className="text-xs text-zinc-600">Demo UI</div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="h-10 rounded-2xl bg-white ring-1 ring-zinc-200" />
                    <div className="h-24 rounded-2xl bg-linear-to-br from-fuchsia-300/45 to-cyan-300/35 ring-1 ring-zinc-200" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-16 rounded-2xl bg-white ring-1 ring-zinc-200" />
                      <div className="h-16 rounded-2xl bg-white ring-1 ring-zinc-200" />
                    </div>
                    <div className="h-10 rounded-2xl bg-white ring-1 ring-zinc-200" />
                  </div>
                  <div className="mt-6 rounded-2xl bg-white p-4 text-xs text-zinc-600 ring-1 ring-zinc-200">
                    Tip: Try the chat widget for shipping/returns questions.
                  </div>
                </div>
              </div>
            </div>
          </main>

          <footer className="flex items-center justify-between border-t border-zinc-200 py-4 text-xs text-zinc-500">
            <div>© {new Date().getFullYear()} Spur</div>
            <div className="hidden sm:block">Privacy · Terms · Contact</div>
          </footer>
        </div>
      </div>
      <ChatWidget />
    </>
  )
}

export default App
