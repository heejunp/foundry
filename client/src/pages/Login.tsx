import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Github } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"

export function LoginPage() {
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  
  const token = localStorage.getItem("foundry_token")

  const handleGithubLogin = () => {
    // Redirect to backend auth (Relative path)
    window.location.href = `/api/auth/github/login`
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setIsLoading(true)
    setError("")

    try {
        const res = await fetch(`/api/activate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // "X-User-ID": "mock-jwt-token-for-12345".split("for-")[1] || "mock-user-id", // Removed duplicate
                 "X-User-ID": token.replace("mock-jwt-token-for-", "")
            },
            body: JSON.stringify({ inviteCode }),
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Failed to activate")
        }
        
        // Success
        navigate("/dashboard")

    } catch (err: any) {
        setError(err.message)
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)]">
      <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome to Foundry
          </CardTitle>
          <CardDescription>
            {token 
                ? "Enter your invite code to activate your account" 
                : "Login via GitHub to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {!token ? (
            <Button variant="outline" className="w-full" type="button" onClick={handleGithubLogin}>
                <Github className="mr-2 h-4 w-4" />
                Login with GitHub
            </Button>
          ) : (
             <form onSubmit={handleActivate} className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-md mb-4 text-sm text-center text-muted-foreground">
                    Logged in as <strong>park-dev</strong> (GitHub)
                </div>
                <div className="space-y-2">
                <Input
                    type="text"
                    placeholder="Enter Invite Code (FOUNDRY-VIP)"
                    value={inviteCode}
                    onChange={(e) => {
                    setInviteCode(e.target.value)
                    setError("")
                    }}
                    className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
                    disabled={isLoading}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Activating..." : "Access Dashboard"}
                </Button>
            </form>
          )}

        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
            Project Foundry &copy; 2026
        </CardFooter>
      </Card>
    </div>
  )
}
