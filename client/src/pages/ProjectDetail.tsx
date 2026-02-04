import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
    ArrowLeft, 
    Loader2, 
    Play, 
    Square, 
    ExternalLink, 
    Activity, 
    Cpu, 
    CircuitBoard,
    Globe,
    Settings,
    Database,
    Clock,
    TerminalSquare
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LogsModal } from "@/components/LogsModal"

interface ProjectEnv {
    id: number
    key: string
    value: string
}

interface ProjectData {
    id: string
    name: string
    repoUrl: string
    port: number
    deployUrl: string
    status: string
    createdAt: string
}

export function ProjectDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [project, setProject] = useState<ProjectData | null>(null)
    const [envVars, setEnvVars] = useState<ProjectEnv[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [showLogs, setShowLogs] = useState(false)
    
    // Edit States
    const [editPort, setEditPort] = useState<number>(80)
    const [newEnvKey, setNewEnvKey] = useState("")
    const [newEnvVal, setNewEnvVal] = useState("")

    // Stats
    const [stats, setStats] = useState({ cpu: "0%", ram: "0Mi" })

    const token = localStorage.getItem("foundry_token")

    useEffect(() => {
        if (!token) {
            navigate("/login")
            return
        }
        fetchProject()
    }, [id])

    // Poll for stats
    useEffect(() => {
        if (project?.status === 'running') {
            const fetchStats = async () => {
                try {
                    const res = await fetch(`/api/projects/${id}/stats`, {
                        headers: { "X-User-ID": token || "" }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setStats({ 
                            cpu: data.cpu === "0" ? "0%" : data.cpu, 
                            ram: data.memory === "0" ? "0Mi" : data.memory 
                        })
                    }
                } catch (e) {
                    console.error("Stats fetch error", e)
                }
            }
            fetchStats()
            const interval = setInterval(fetchStats, 3000)
            return () => clearInterval(interval)
        } else {
            setStats({ cpu: "Off", ram: "Off" })
        }
    }, [project?.status, id, token])

    const fetchProject = async () => {
        try {
            const res = await fetch(`/api/projects/${id}`, {
                headers: { "X-User-ID": token || "" }
            })
            if (!res.ok) throw new Error("Failed to load project")
            const data = await res.json()
            setProject(data.project)
            setEditPort(data.project.port)
            setEnvVars(data.envVars || [])
        } catch (e) {
            console.error(e)
            navigate("/mypage")
        } finally {
            setIsLoading(false)
        }
    }

    const handleAction = async (action: "start" | "stop") => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    "X-User-ID": token || "" 
                },
                body: JSON.stringify({ action })
            })
            if (res.ok) {
                // Optimistic update
                setProject(prev => prev ? ({ ...prev, status: action === "stop" ? "stopped" : "running" }) : null)
            }
        } catch (e) {
            alert("Failed to change status")
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveConfig = async () => {
        if (!confirm("Updates will trigger a redeployment. Continue?")) return
        
        setIsSaving(true)
        try {
             const envPayload = envVars.map(e => ({ key: e.key, value: e.value }))
             const res = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    "X-User-ID": token || "" 
                },
                body: JSON.stringify({ 
                    port: editPort,
                    envVars: envPayload 
                })
            })
            if (res.ok) {
                alert("Configuration saved. Redeploying...")
                navigate("/mypage")
            }
        } catch (e) {
            alert("Error updating config")
        } finally {
             setIsSaving(false)
        }
    }

    const addEnv = () => {
        if (newEnvKey && newEnvVal) {
            setEnvVars([...envVars, { id: Date.now(), key: newEnvKey, value: newEnvVal }])
            setNewEnvKey("")
            setNewEnvVal("")
        }
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
    if (!project) return <div>Project not found</div>

    const isRunning = project.status === "running";

    return (
        <div className="container max-w-6xl mx-auto py-8 space-y-8 animate-in fade-in duration-500">
            <LogsModal projectId={id || null} isOpen={showLogs} onClose={() => setShowLogs(false)} />
            
            {/* Top Navigation & Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate("/mypage")} className="h-9 w-9">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                            <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "bg-green-600 hover:bg-green-700" : ""}>
                                {project.status.toUpperCase()}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                             <div className="flex items-center gap-1">
                                <CircuitBoard className="h-3 w-3" /> {project.repoUrl}
                             </div>
                             <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {new Date(project.createdAt).toLocaleDateString()}
                             </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowLogs(true)}>
                        <TerminalSquare className="h-4 w-4 mr-2" /> Logs
                    </Button>
                    {project.deployUrl && (
                        <Button variant="outline" asChild>
                            <a href={project.deployUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" /> Visit
                            </a>
                        </Button>
                    )}
                    {isRunning ? (
                        <Button variant="destructive" onClick={() => handleAction("stop")} disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Square className="h-4 w-4 mr-2 fill-current" />}
                            Stop
                        </Button>
                    ) : (
                        <Button onClick={() => handleAction("start")} disabled={isSaving}>
                             {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Play className="h-4 w-4 mr-2 fill-current" />}
                            Start
                        </Button>
                    )}
                </div>
            </div>

            <Separator />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Stats & Config */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Resource Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.cpu}</div>
                                <p className="text-xs text-muted-foreground">Limit: 1 Core</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                <Cpu className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.ram}</div>
                                <p className="text-xs text-muted-foreground">Limit: 1 GiB</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Configuration */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                <CardTitle>Configuration</CardTitle>
                            </div>
                            <CardDescription>Update networking and build settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-2">
                                <Label htmlFor="port">Container Port</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="port"
                                        type="number" 
                                        value={editPort} 
                                        onChange={(e) => setEditPort(parseInt(e.target.value))}
                                        className="max-w-[120px]"
                                    />
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        Internal port exposed by your Docker container.
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-2">
                                        <Database className="h-4 w-4" /> Environment Variables
                                    </Label>
                                </div>
                                <div className="border rounded-md divide-y">
                                    {envVars.length === 0 && (
                                        <div className="p-4 text-center text-sm text-muted-foreground">No environment variables set.</div>
                                    )}
                                    {envVars.map((env, i) => (
                                        <div key={i} className="flex items-center p-2 gap-2 group hover:bg-muted/50 transition-colors">
                                            <div className="w-1/3 text-xs font-mono font-medium truncate px-2" title={env.key}>{env.key}</div>
                                            <div className="flex-1 text-xs font-mono truncate px-2 text-muted-foreground" title={env.value}>••••••••</div>
                                            <Button variant="ghost" size="sm" onClick={() => setEnvVars(envVars.filter((_, idx) => idx !== i))} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100">
                                                ×
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="KEY" 
                                        value={newEnvKey} 
                                        onChange={e => setNewEnvKey(e.target.value)} 
                                        className="flex-1 font-mono text-xs" 
                                    />
                                    <Input 
                                        placeholder="VALUE" 
                                        value={newEnvVal} 
                                        onChange={e => setNewEnvVal(e.target.value)} 
                                        className="flex-1 font-mono text-xs" 
                                    />
                                    <Button size="sm" variant="secondary" onClick={addEnv}>Add</Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 border-t py-4 flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">Changes will trigger a redeployment.</p>
                            <Button onClick={handleSaveConfig} disabled={isSaving}>
                                {isSaving && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Right Column: Deployment Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-primary" />
                                <CardTitle>Deployment Info</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Live URL</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <a href={project.deployUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline truncate">
                                        {project.deployUrl || "N/A"}
                                    </a>
                                </div>
                            </div>
                             <div>
                                <Label className="text-xs text-muted-foreground">Framework/Runtime</Label>
                                <div className="text-sm font-medium mt-1">Docker Container</div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Last Updated</Label>
                                <div className="text-sm font-medium mt-1">
                                    { /* Mocking last updated for now, or use createdAt */ }
                                    {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/30 border-dashed">
                        <CardHeader>
                             <CardTitle className="text-sm">Troubleshooting</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>If your app isn't starting:</p>
                            <ul className="list-disc list-inside">
                                <li>Check the <strong>Logs</strong> for startup errors.</li>
                                <li>Verify <strong>Container Port</strong> matches the port your app listens on.</li>
                                <li>Ensure environment variables are correct.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
