import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Play, Square, Save, ExternalLink, Activity, Cpu, CircuitBoard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    
    // Edit States
    const [editPort, setEditPort] = useState<number>(80)
    const [newEnvKey, setNewEnvKey] = useState("")
    const [newEnvVal, setNewEnvVal] = useState("")

    // Resource Stats (Mock for MVP, but ready for real data)
    const [stats, setStats] = useState({ cpu: "0.00%", ram: "0 MB" })

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
                        // convert chaos to human readable if needed, but k8s gives "12m", "100Mi" etc
                        setStats({ 
                            cpu: data.cpu === "0" ? "0" : data.cpu, 
                            ram: data.memory === "0" ? "0" : data.memory 
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
            setStats({ cpu: "0", ram: "0" })
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
                const data = await res.json()
                // Optimistic update
                setProject(prev => prev ? ({ ...prev, status: action === "stop" ? "stopped" : "running" }) : null)
                alert(data.message)
            }
        } catch (e) {
            alert("Failed to change status")
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveConfig = async () => {
        if (!confirm("Updating configuration will redeploy the application. Continue?")) return
        
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
                alert("Configuration updated. Redeploying...")
                navigate("/mypage")
            } else {
                alert("Failed to update configuration")
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

    const removeEnv = (idx: number) => {
        setEnvVars(envVars.filter((_, i) => i !== idx))
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    if (!project) return <div>Project not found</div>

    return (
        <div className="container max-w-5xl mx-auto py-10 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/mypage")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                            <CircuitBoard className="h-3 w-3" />
                            {project.repoUrl}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Badge variant={project.status === "running" ? "default" : "secondary"} className="h-8 px-3 text-sm">
                        <div className={`w-2 h-2 rounded-full mr-2 ${project.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                        {project.status.toUpperCase()}
                    </Badge>
                    {project.status === "running" ? (
                        <Button variant="destructive" size="sm" onClick={() => handleAction("stop")} disabled={isSaving}>
                            <Square className="h-4 w-4 mr-2" fill="currentColor" /> Stop Service
                        </Button>
                    ) : (
                        <Button variant="default" size="sm" onClick={() => handleAction("start")} disabled={isSaving}>
                            <Play className="h-4 w-4 mr-2" fill="currentColor" /> Start Service
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-background to-muted/20 border-primary/20 shadow-sm">
                   <CardHeader className="pb-2">
                       <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                           <Activity className="h-4 w-4" /> CPU Usage (Limit: 1 Core)
                       </CardTitle>
                   </CardHeader>
                   <CardContent>
                       <div className="text-2xl font-bold">{stats.cpu}</div>
                       <p className="text-xs text-muted-foreground mt-1">Real-time container CPU metric</p>
                   </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-background to-muted/20 border-primary/20 shadow-sm">
                   <CardHeader className="pb-2">
                       <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                           <Cpu className="h-4 w-4" /> Memory Usage (Limit: 1 GB)
                       </CardTitle>
                   </CardHeader>
                   <CardContent>
                       <div className="text-2xl font-bold">{stats.ram}</div>
                       <p className="text-xs text-muted-foreground mt-1">Real-time container memory metric</p>
                   </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Config */}
                <div className="md:col-span-2 space-y-8">
                    {/* Domain & Port */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Network & Connectivity</CardTitle>
                            <CardDescription>Manage how your application is exposed to the internet.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                           <div className="space-y-3">
                                <Label>Deployment URL</Label>
                                <div className="flex gap-2">
                                    <Input value={project.deployUrl || "Not deployed yet"} readOnly className="bg-muted font-mono" />
                                    {project.deployUrl && (
                                        <Button variant="outline" size="icon" asChild>
                                            <a href={project.deployUrl} target="_blank" rel="noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                           </div>
                           
                           <div className="space-y-3">
                                <Label>Container Port</Label>
                                <div className="flex items-center gap-4">
                                    <Input 
                                        type="number" 
                                        value={editPort} 
                                        onChange={(e) => setEditPort(parseInt(e.target.value))}
                                        className="max-w-[200px]"
                                    />
                                    <span className="text-sm text-muted-foreground">Internal port your app listens on (e.g. 3000, 8080)</span>
                                </div>
                           </div>
                        </CardContent>
                    </Card>

                    {/* Env Vars */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Environment Variables</CardTitle>
                            <CardDescription>Securely manage secrets and configuration.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {envVars.map((env, i) => (
                                <div key={i} className="flex gap-2 group">
                                    <Input value={env.key} readOnly className="font-mono bg-muted/50 w-1/3 text-xs" />
                                    <Input value={env.value} readOnly type="password" className="font-mono bg-muted/50 flex-1 text-xs" />
                                    <Button variant="ghost" size="icon" onClick={() => removeEnv(i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-red-500">×</div>
                                    </Button>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-4 border-t border-border/50">
                                <Input 
                                    placeholder="KEY (e.g. API_KEY)" 
                                    value={newEnvKey} 
                                    onChange={e => setNewEnvKey(e.target.value)} 
                                    className="w-1/3 font-mono text-sm" 
                                />
                                <Input 
                                    placeholder="VALUE" 
                                    value={newEnvVal} 
                                    onChange={e => setNewEnvVal(e.target.value)} 
                                    className="flex-1 font-mono text-sm" 
                                />
                                <Button onClick={addEnv} variant="secondary">Add</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar / Actions */}
                <div className="space-y-6">
                     <Card className="bg-primary/5 border-primary/20 sticky top-20">
                        <CardHeader>
                            <CardTitle className="text-sm">Release Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Changing Port or Environment Variables requires a redeployment to take effect.
                            </p>
                            <Button className="w-full" onClick={handleSaveConfig} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                                Save & Redeploy
                            </Button>
                        </CardContent>
                     </Card>
                </div>
            </div>
        </div>
    )
}
