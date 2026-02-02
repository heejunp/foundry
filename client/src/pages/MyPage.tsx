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

import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

interface Project {
    id: string
    name: string
    repo: string
    url?: string
    status: string // "building", "running", "error"
    lastCommit?: string
    time: string
}

const statusColors: Record<string, string> = {
    running: "bg-emerald-500",
    building: "bg-amber-500 animate-pulse",
    error: "bg-red-500",
}

export function MyPage() {
    const navigate = useNavigate()
    const token = localStorage.getItem("foundry_token")
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) {
            navigate("/login")
            return
        }

        const fetchProjects = async () => {
             try {
                 const res = await fetch(`/api/projects/my`, {
                     headers: { "X-User-ID": token }
                 })
                 if (res.ok) {
                     const data = await res.json()
                     // Map backend fields to UI fields if necessary
                     // Backend Project: { ID, Name, RepoURL, Status, CreatedAt, ... }
                     setProjects((data || []).map((p: any) => ({
                         id: p.id,
                         name: p.name,
                         repo: p.repoUrl,
                         status: p.status || "building",
                         url: p.deployUrl || "", 
                         lastCommit: "Initial commit", // Backend might not send this yet
                         time: new Date(p.createdAt).toLocaleDateString()
                     })))
                 }
             } catch (e) {
                 console.error("Failed to fetch my projects")
             } finally {
                 setLoading(false)
             }
        }
        
        fetchProjects()
        // Poll for updates every 5 seconds if there are building projects
        const interval = setInterval(fetchProjects, 5000)
        return () => clearInterval(interval)

    }, [token, navigate])

    const handleDeleteProject = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project? This will stop the running service.")) return
        
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: "DELETE",
                headers: { "X-User-ID": token || "" }
            })
            if (res.ok) {
                // Remove from state
                setProjects(prev => prev.filter(p => p.id !== id))
            } else {
                alert("Failed to delete project")
            }
        } catch (e) {
            console.error(e)
            alert("Error deleting project")
        }
    }

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
  
        {/* Project Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
             // Loading Skeletons
             Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 w-2/3 bg-muted rounded"></div></CardHeader>
                    <CardContent><div className="h-4 w-full bg-muted rounded mb-2"></div><div className="h-4 w-1/2 bg-muted rounded"></div></CardContent>
                    <CardFooter><div className="h-8 w-full bg-muted rounded"></div></CardFooter>
                </Card>
             ))
          ) : (
            <>
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
                            <DropdownMenuItem className="text-red-600 focus:text-red-500" onClick={() => handleDeleteProject(project.id)}>
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
            </>
          )}
  
          {/* New Project Card - Always show unless loading maybe? No, show always to be actionable */}
          {!loading && (
            <Button variant="outline" className="h-full min-h-[180px] flex flex-col gap-4 border-dashed border-2 hover:border-primary/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all" onClick={() => navigate("/new")}>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <Plus className="h-6 w-6" />
                </div>
                <span className="text-lg font-medium">Deploy New Project</span>
            </Button>
          )}
        </div>
      </div>
    )
  }
