import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Play, Square, Save, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

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
    status: string // "building", "running", "stopped", "error"
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

    const token = localStorage.getItem("foundry_token")

    useEffect(() => {
        if (!token) {
            navigate("/login")
            return
        }
        fetchProject()
    }, [id])

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
             // Prepare Env Vars (Send all current ones)
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
                navigate("/mypage") // Go back to list or stay? Stay is better but status might lag.
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
        <div className="container max-w-4xl mx-auto py-10 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/mypage")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{project.name}</h1>
                    <p className="text-muted-foreground text-sm">{project.repoUrl}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge variant={project.status === "running" ? "default" : "secondary"}>
                        {project.status}
                    </Badge>
                    {project.status === "running" ? (
                        <Button variant="destructive" size="sm" onClick={() => handleAction("stop")} disabled={isSaving}>
                            <Square className="h-4 w-4 mr-2" fill="currentColor" /> Stop
                        </Button>
                    ) : (
                        <Button variant="default" size="sm" onClick={() => handleAction("start")} disabled={isSaving}>
                            <Play className="h-4 w-4 mr-2" fill="currentColor" /> Start
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Config */}
                <div className="md:col-span-2 space-y-6">
                    {/* Domain & Port */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Deployment Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <div className="space-y-2">
                                <Label>Deploy URL</Label>
                                <div className="flex gap-2">
                                    <Input value={project.deployUrl || "Not deployed yet"} readOnly className="bg-muted" />
                                    {project.deployUrl && (
                                        <Button variant="outline" size="icon" asChild>
                                            <a href={project.deployUrl} target="_blank" rel="noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                           </div>
                           
                           <div className="space-y-2">
                                <Label>Application Port</Label>
                                <Input 
                                    type="number" 
                                    value={editPort} 
                                    onChange={(e) => setEditPort(parseInt(e.target.value))} 
                                />
                                <p className="text-xs text-muted-foreground">The port your container listens on.</p>
                           </div>
                        </CardContent>
                    </Card>

                    {/* Env Vars */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Environment Variables</CardTitle>
                            <CardDescription>Secrets and config variables.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {envVars.map((env, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input value={env.key} readOnly className="font-mono bg-muted w-1/3" />
                                    <Input value={env.value} readOnly className="font-mono bg-muted flex-1" />
                                    <Button variant="ghost" size="icon" onClick={() => removeEnv(i)}>
                                        X
                                    </Button>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2 border-t">
                                <Input placeHolder="KEY" value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} className="w-1/3" />
                                <Input placeHolder="VALUE" value={newEnvVal} onChange={e => setNewEnvVal(e.target.value)} className="flex-1" />
                                <Button onClick={addEnv}>Add</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar / Actions */}
                <div className="space-y-6">
                     <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-sm">Save Changes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground mb-4">
                                Updating Port or Environment Variables will trigger a redeployment.
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
