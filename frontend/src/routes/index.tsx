import { OrganizationSwitcher, Show, SignInButton, UserButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Construction</h1>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700">
            Sign in
          </button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <OrganizationSwitcher />
            <UserButton />
          </div>
        </div>
      </Show>
    </div>
  )
}
