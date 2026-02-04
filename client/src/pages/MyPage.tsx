import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LogsModal } from "@/components/LogsModal"
import { Sidebar } from "@/components/Sidebar"
import { EnvironmentList } from "@/components/EnvironmentList"
import { Badge } from "@/components/ui/badge"

interface Project {
  id: string
  name: string
  repoUrl: string
  status: string
  deployUrl: string
  port: number
  createdAt: string
}

interface EnvironmentShort {
    id: string
    name: string
}

export function MyPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [logsProjectId, setLogsProjectId] = useState<string | null>(null)
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"projects" | "environments" | "storage">("projects")

  // Create Form
  const [newProjectName, setNewProjectName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [port, setPort] = useState(80)
  const [branch, setBranch] = useState("main")
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }])
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>([])
  
  // Available Envs for Selection
  const [availableEnvs, setAvailableEnvs] = useState<EnvironmentShort[]>([])

  const token = localStorage.getItem("foundry_token")

  useEffect(() => {
    if (!token) {
      navigate("/login")
      return
    }
    fetchProjects()
    fetchAvailableEnvs()
  }, [token])

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/my/projects", {
        headers: { "X-User-ID": token || "" },
      })
      if (res.ok) {
        setProjects(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableEnvs = async () => {
      try {
          const res = await fetch("/api/environments", { headers: { "X-User-ID": token || "" } })
          if (res.ok) setAvailableEnvs(await res.json())
      } catch (e) { console.error(e) }
  }

  const handleCreateProject = async () => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": token || "",
        },
        body: JSON.stringify({
          name: newProjectName,
          repoUrl,
          port,
          branch,
          envVars: envVars.filter((e) => e.key && e.value),
          environmentIds: selectedEnvIds,
        }),
      })

      if (res.ok) {
        setCreateOpen(false)
        fetchProjects()
        // Reset form
        setNewProjectName("")
        setRepoUrl("")
        setPort(80)
        setBranch("main")
        setEnvVars([{ key: "", value: "" }])
        setSelectedEnvIds([])
      } else {
        alert("Failed to create project")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteProject = async (id: string) => {
      if (!confirm("Are you sure?")) return
      try {
          await fetch(`/api/projects/${id}`, {
              method: "DELETE",
              headers: { "X-User-ID": token || "" }
          })
          fetchProjects()
      } catch (e) {
          console.error(e)
      }
  }

  const toggleEnvSelection = (id: string) => {
      if (selectedEnvIds.includes(id)) {
          setSelectedEnvIds(selectedEnvIds.filter(e => e !== id))
      } else {
          setSelectedEnvIds([...selectedEnvIds, id])
      }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 p-8 overflow-auto">
            <LogsModal 
                projectId={logsProjectId} 
                isOpen={!!logsProjectId} 
                onClose={() => setLogsProjectId(null)} 
            />

            {activeTab === "projects" && (
                <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
                            <p className="text-muted-foreground">Manage and deploy your applications.</p>
                        </div>
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" /> New Project
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create New Project</DialogTitle>
                                    <DialogDescription>
                                        Deploy a new application from a GitHub repository.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Project Name</Label>
                                        <Input
                                            id="name"
                                            value={newProjectName}
                                            onChange={(e) => setNewProjectName(e.target.value)}
                                            placeholder="my-awesome-app"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="repo">Repository URL</Label>
                                        <Input
                                            id="repo"
                                            value={repoUrl}
                                            onChange={(e) => setRepoUrl(e.target.value)}
                                            placeholder="https://github.com/user/repo"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="port">Container Port</Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={port}
                                                onChange={(e) => setPort(Number(e.target.value))}
                                                placeholder="80"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="branch">Branch</Label>
                                            <Input
                                                id="branch"
                                                value={branch}
                                                onChange={(e) => setBranch(e.target.value)}
                                                placeholder="main"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Environment Selection */}
                                    <div className="grid gap-2">
                                        <Label>Attach Environments (Secrets)</Label>
                                        <div className="flex flex-wrap gap-2 border p-3 rounded-md min-h-[60px] content-start bg-muted/20">
                                            {availableEnvs.length === 0 && <span className="text-xs text-muted-foreground w-full text-center py-2">No environments found. Create one in Environments tab!</span>}
                                            {availableEnvs.map(env => (
                                                <Badge 
                                                    key={env.id} 
                                                    variant={selectedEnvIds.includes(env.id) ? "default" : "outline"}
                                                    className="cursor-pointer select-none hover:bg-primary/80 transition-colors"
                                                    onClick={() => toggleEnvSelection(env.id)}
                                                >
                                                    {env.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Custom Environment Variables</Label>
                                        {envVars.map((env, i) => (
                                            <div key={i} className="flex gap-2">
                                                <Input
                                                    placeholder="KEY"
                                                    value={env.key}
                                                    onChange={(e) => {
                                                        const newEnvs = [...envVars]
                                                        newEnvs[i].key = e.target.value
                                                        setEnvVars(newEnvs)
                                                    }}
                                                    className="font-mono text-xs"
                                                />
                                                <Input
                                                    placeholder="VALUE"
                                                    value={env.value}
                                                    onChange={(e) => {
                                                        const newEnvs = [...envVars]
                                                        newEnvs[i].value = e.target.value
                                                        setEnvVars(newEnvs)
                                                    }}
                                                    className="font-mono text-xs"
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
                                        >
                                            Add Variable
                                        </Button>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreateProject}>Create & Deploy</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {loading ? (
                            <div>Loading...</div>
                        ) : projects.map((project) => (
                            <Card 
                                key={project.id} 
                                className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 cursor-pointer group"
                                onClick={() => navigate(`/projects/${project.id}`)}
                            >
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4 text-muted-foreground" />
                                            {project.name}
                                        </div>
                                    </CardTitle>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation()
                                                setLogsProjectId(project.id)
                                            }}>
                                                View Logs
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600 focus:text-red-500" onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteProject(project.id)
                                            }}>
                                                Delete Project
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-2xl font-bold capitalize">{project.status}</div>
                                        {project.port !== 80 && <span className="text-xs text-muted-foreground">:{project.port}</span>}
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                         <GitBranch className="mr-1 h-3 w-3" />
                                         main
                                         <span className="mx-2">•</span>
                                         {new Date(project.createdAt).toLocaleDateString()}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    {project.deployUrl && (
                                        <a 
                                            href={project.deployUrl} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-xs text-blue-500 hover:underline flex items-center bg-blue-500/10 px-2 py-1 rounded-full"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Terminal className="mr-1 h-3 w-3" />
                                            Visit App
                                        </a>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === "environments" && (
                <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
                    <EnvironmentList />
                </div>
            )}

            {activeTab === "storage" && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground animate-in fade-in duration-500">
                    <Server className="h-12 w-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">Storage Management</h3>
                    <p>Persistent Volume management coming soon.</p>
                </div>
            )}
        </div>
    </div>
  )
}
