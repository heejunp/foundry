import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      // In a real app, verify token or exchange code here
      // Here we just store the mock token
      localStorage.setItem("foundry_token", token)
      
      // Extract User ID from mock token if possible to check status?
      // Or just go to login -> check status flow.
      // Let's redirect to login which will now see the token and check 'Me'
      navigate("/login") 
    } else {
      // Failed
      navigate("/login?error=auth_failed")
    }
  }, [searchParams, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Authenticating with GitHub...</p>
      </div>
    </div>
  )
}
