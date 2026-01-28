import {
    Activity,
    GitBranch,
    MoreHorizontal,
    Plus,
    Server,
    Terminal,
  } from "lucide-react"
  
  import { Button } from "@/components/ui/button"
  import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
  import { cn } from "@/lib/utils"
  
  // Mock Data
  const projects = [
    {
      id: "my-blog",
      name: "my-blog",
      repo: "heejunp/astro-blog",
      status: "running", // running, building, error
      url: "https://my-blog.foundry.app",
      lastCommit: "feat: update bio",
      time: "2m ago",
    },
    {
      id: "api-server",
      name: "api-server",
      repo: "heejunp/go-api",
      status: "building",
      url: "https://api.foundry.app",
      lastCommit: "fix: db connection",
      time: "15s ago",
    },
    {
      id: "legacy-app",
      name: "legacy-app",
      repo: "heejunp/old",
      status: "error",
      url: "https://legacy.foundry.app",
      lastCommit: "chore: cleanup",
      time: "1h ago",
    },
  ]
  
  const statusColors: Record<string, string> = {
    running: "bg-emerald-500",
    building: "bg-amber-500 animate-pulse",
    error: "bg-red-500",
  }
  
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
// ... imports

  export function MyPage() {
    const navigate = useNavigate()
    const token = localStorage.getItem("foundry_token")
    
    useEffect(() => {
        if (!token) {
            navigate("/login")
        }
    }, [token, navigate])

    if (!token) return null // Prevent flash

    return (
      <div className="space-y-8 p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">My Fleet</h2>
            <p className="text-muted-foreground">
              Manage your deployed services and monitor their health.
            </p>
          </div>
          <div className="flex items-center space-x-4">
               {/* Resource Gauge Mockup */}
               <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
                  <Activity className="w-4 h-4" />
                  <span>CPU: 12%</span>
                  <span className="text-border">|</span>
                  <span>RAM: 24%</span>
              </div>
          </div>
        </div>
  
        {/* Project Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group hover:shadow-md transition-all dark:hover:border-zinc-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {project.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                   <div className={cn("w-2.5 h-2.5 rounded-full", statusColors[project.status])} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View Logs</DropdownMenuItem>
                      <DropdownMenuItem>Redeploy</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                   <GitBranch className="h-4 w-4" />
                   <span className="truncate">{project.repo}</span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                   <div className="flex items-center gap-2 truncate max-w-[70%]">
                      <Terminal className="h-3 w-3" />
                      <span className="truncate">{project.lastCommit}</span>
                   </div>
                   <span>{project.time}</span>
                </div>
  
              </CardContent>
              <CardFooter>
                   <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild>
                      <a href={project.url} target="_blank" rel="noreferrer">
                          Visit Deployment <Server className="ml-2 h-3 w-3"/>
                      </a>
                   </Button>
              </CardFooter>
            </Card>
          ))}
  
          {/* New Project Card */}
           <Button variant="outline" className="h-full min-h-[180px] flex flex-col gap-4 border-dashed border-2 hover:border-primary/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Plus className="h-6 w-6" />
              </div>
              <span className="text-lg font-medium">Deploy New Project</span>
           </Button>
        </div>
      </div>
    )
  }
