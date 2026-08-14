import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Construction</h1>
      <p className="text-muted-foreground">Sites, spending and what everyone is owed.</p>

      <Show when="signed-out">
        <div className="flex gap-3">
          <SignInButton mode="modal">
            <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 font-medium transition-colors">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="border-border hover:bg-accent hover:text-accent-foreground rounded-lg border px-6 py-2 font-medium transition-colors">
              Create an account
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <UserButton />
      </Show>
    </main>
  )
}
