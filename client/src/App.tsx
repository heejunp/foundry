import { BrowserRouter, Routes, Route, Outlet, Navigate, Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ThemeProvider } from "@/lib/theme-provider"
import { ThemeToggle } from "@/components/ui/theme-toggle"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LoginPage } from "@/pages/Login"
import { DashboardPage } from "@/pages/Dashboard"
import { MyPage } from "@/pages/MyPage"
import { NewProjectPage } from "@/pages/NewProject"
import { ProjectDetailPage } from "@/pages/ProjectDetail"
import { AuthCallbackPage } from "@/pages/AuthCallback"
import { Blocks, Rocket, LogOut, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function RootLayout() {
  const navigate = useNavigate()
  // Simple check for now. In real app, check expiration or use a custom hook from context.
  const isAuthenticated = !!localStorage.getItem("foundry_token")

  // State for user data
  const [user, setUser] = useState<{avatarUrl?: string, username?: string} | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
        const fetchUser = async () => {
             const token = localStorage.getItem("foundry_token")
             try {
                // Use relative path for maximum portability
                const res = await fetch(`/api/me`, {
                   headers: { "X-User-ID": token || "" }
                })
                if (res.ok) {
                    const data = await res.json()
                    setUser(data)
                }
             } catch (e) {
                 console.error("Failed to fetch user")
             }
        }
        fetchUser()
    }
  }, [isAuthenticated])
  
  const handleLogout = () => {
    localStorage.removeItem("foundry_token")
    navigate("/login")
  }


  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action is irreversible.")) return

    try {
        const token = localStorage.getItem("foundry_token")
        const res = await fetch(`/api/me`, {
            method: "DELETE",
            headers: {
                "X-User-ID": token || ""
            }
        })

        if (res.ok) {
            alert("Account deleted successfully.")
            handleLogout()
        } else {
            alert("Failed to delete account.")
        }
    } catch (e) {
        alert("Error deleting account")
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center mx-auto px-4 md:px-8">
          <div className="mr-4 flex">
            <Link className="mr-6 flex items-center space-x-2" to="/dashboard">
              <span className="font-bold tracking-tight text-xl">Foundry</span>
            </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
             {/* Navigation Links */}
             <nav className="flex items-center gap-6 text-sm font-medium">
                <Link to="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                    <Blocks className="h-4 w-4" /> Explore
                </Link>
                {isAuthenticated && (
                  <Link to="/mypage" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                     <Rocket className="h-4 w-4" /> My Fleet
                  </Link>
                )}
            </nav>

            <div className="flex items-center gap-2 ml-4">
               {isAuthenticated && (
                  <Link to="/new">
                     <Button size="sm" variant="default" className="hidden md:flex">
                        <Plus className="mr-2 h-4 w-4" /> New Project
                     </Button>
                  </Link>
               )}
               
               <ThemeToggle />
               
               {isAuthenticated ? (
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Avatar className="h-8 w-8 ml-2 cursor-pointer border hover:border-primary/50 transition-colors">
                          <AvatarImage src={user?.avatarUrl || "https://github.com/shadcn.png"} alt="@user" />
                          <AvatarFallback>CN</AvatarFallback>
                       </Avatar>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                       <DropdownMenuLabel>My Account</DropdownMenuLabel>
                       <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={handleLogout} className="focus:text-accent-foreground">
                          <LogOut className="mr-2 h-4 w-4" /> Logout
                       </DropdownMenuItem>
                       <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={handleDeleteAccount} className="text-red-600 focus:text-red-500">
                          <LogOut className="mr-2 h-4 w-4" /> Withdraw
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                  </DropdownMenu>
               ) : (
                 <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
                    Login
                 </Button>
               )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="foundry-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/login" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          
          <Route path="/" element={<RootLayout />}>
             <Route index element={<Navigate to="/dashboard" replace />} />
             <Route path="dashboard" element={<DashboardPage />} />
             <Route path="mypage" element={<MyPage />} />
             <Route path="new" element={<NewProjectPage />} />
             <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
