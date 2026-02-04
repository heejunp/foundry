import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Loader2, Plus, Terminal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface EnvironmentShort {
    id: string
    name: string
}

export function NewProjectPage() {
  const navigate = useNavigate()
  const [repoUrl, setRepoUrl] = useState("")
  const [projectName, setProjectName] = useState("")
  const [branch, setBranch] = useState("main")
  const [port, setPort] = useState("80")
  const [isValidating, setIsValidating] = useState(false)
  const [isValidRepo, setIsValidRepo] = useState<boolean | null>(null)
  
  // Available Envs for Selection
  const [availableEnvs, setAvailableEnvs] = useState<EnvironmentShort[]>([])
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>([])

  // New Environment Group Creation
  const [isCreateEnvOpen, setIsCreateEnvOpen] = useState(false)
  const [newEnvGroupName, setNewEnvGroupName] = useState("")
  const [newEnvGroupVars, setNewEnvGroupVars] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }])

  useEffect(() => {
    const token = localStorage.getItem("foundry_token")
    if (!token) {
        navigate("/login")
        return
    }
    fetchAvailableEnvs()
  }, [navigate])

  const fetchAvailableEnvs = async () => {
      try {
          const token = localStorage.getItem("foundry_token")
          const res = await fetch("/api/environments", { headers: { "X-User-ID": token || "" } })
          if (res.ok) setAvailableEnvs(await res.json())
      } catch (e) { console.error(e) }
  }

  // Repo Validation Logic
  const handleRepoBlur = async () => {
    if (!repoUrl) return
    setIsValidating(true)
    setIsValidRepo(null)

    const parts = repoUrl.split("/")
    const potentialName = parts[parts.length - 1]?.replace(".git", "")
    if (!projectName && potentialName) {
        setProjectName(potentialName)
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 800))
        const isGithub = repoUrl.includes("github.com")
        setIsValidRepo(isGithub)
    } catch {
        setIsValidRepo(false)
    } finally {
        setIsValidating(false)
    }
  }

  const toggleEnvSelection = (id: string) => {
      if (selectedEnvIds.includes(id)) {
          setSelectedEnvIds(selectedEnvIds.filter(e => e !== id))
      } else {
          setSelectedEnvIds([...selectedEnvIds, id])
      }
  }

  const handleCreateEnvGroup = async () => {
      if (!newEnvGroupName) return
      
      try {
          const token = localStorage.getItem("foundry_token")
          const res = await fetch("/api/environments", {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "X-User-ID": token || "" 
              },
              body: JSON.stringify({
                  name: newEnvGroupName,
                  variables: newEnvGroupVars.filter(v => v.key && v.value)
              })
          })
          
          if (res.ok) {
              const newEnv = await res.json()
              setAvailableEnvs([...availableEnvs, newEnv])
              setSelectedEnvIds([...selectedEnvIds, newEnv.id])
              setIsCreateEnvOpen(false)
              setNewEnvGroupName("")
              setNewEnvGroupVars([{ key: "", value: "" }])
          }
      } catch (e) {
          console.error(e)
      }
  }

  const handleSubmit = async () => {
      const token = localStorage.getItem("foundry_token")
      if (!token) {
          navigate("/login")
          return
      }

      setIsValidating(true)
      
      try {
        const res = await fetch(`/api/projects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": token
            },
            body: JSON.stringify({
                name: projectName,
                repoUrl: repoUrl,
                branch: branch,
                port: parseInt(port) || 80,
                envVars: [], // No custom vars, only environment groups
                environmentIds: selectedEnvIds,
            })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Failed to create project")
        }

        const project = await res.json()
        console.log("Project Created:", project)
        
        navigate("/mypage")

      } catch (e: unknown) {
          console.error("Failed to create project:", e)
          alert((e as Error).message || "Something went wrong")
      } finally {
          setIsValidating(false)
      }
  }

  return (
    <div className="container max-w-3xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="space-y-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground mt-2">
            Deploy a new project from your GitHub repository.
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Connect your repository and configure deployment settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Repository URL */}
            <div className="space-y-2">
              <Label htmlFor="repo-url">GitHub Repository URL</Label>
              <div className="relative">
                <Input
                  id="repo-url"
                  placeholder="https://github.com/username/project-name"
                  value={repoUrl}
                  onChange={(e) => {
                      setRepoUrl(e.target.value)
                      setIsValidRepo(null)
                  }}
                  onBlur={handleRepoBlur}
                  className={isValidRepo === true ? "border-green-500 ring-green-500/20 pr-10" : ""}
                />
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!isValidating && isValidRepo === true && <Check className="h-4 w-4 text-green-500" />}
                </div>
              </div>
              
              {!isValidating && isValidRepo === false && (
                  <p className="text-xs text-red-500">
                      Invalid repository URL or inaccessible.
                  </p>
              )}
            </div>

            {/* 2. Project Name, Branch, Port */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input 
                        id="project-name" 
                        placeholder="my-awesome-app" 
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                    />
                </div>
                
                <div className="md:col-span-4 space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Select value={branch} onValueChange={setBranch}>
                        <SelectTrigger id="branch">
                            <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="main">main</SelectItem>
                            <SelectItem value="master">master</SelectItem>
                            <SelectItem value="develop">develop</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input 
                        id="port" 
                        placeholder="80" 
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                    />
                </div>
            </div>

            {/* 3. Environment Groups */}
            <div className="space-y-4 pt-4 border-t">
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label>Environment Groups (Secrets)</Label>
                        <Dialog open={isCreateEnvOpen} onOpenChange={setIsCreateEnvOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Plus className="mr-2 h-3 w-3" /> New Group
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create Environment Group</DialogTitle>
                                    <DialogDescription>
                                        Create a reusable set of environment variables that can be shared across projects.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Group Name</Label>
                                        <Input 
                                            value={newEnvGroupName} 
                                            onChange={e => setNewEnvGroupName(e.target.value)} 
                                            placeholder="e.g. Production Database" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Variables</Label>
                                        {newEnvGroupVars.map((v, i) => (
                                            <div key={i} className="flex gap-2">
                                                <Input 
                                                    placeholder="KEY" 
                                                    value={v.key} 
                                                    onChange={e => {
                                                        const vars = [...newEnvGroupVars]
                                                        vars[i].key = e.target.value
                                                        setNewEnvGroupVars(vars)
                                                    }} 
                                                    className="font-mono text-xs"
                                                />
                                                <Input 
                                                    placeholder="VALUE" 
                                                    value={v.value} 
                                                    onChange={e => {
                                                        const vars = [...newEnvGroupVars]
                                                        vars[i].value = e.target.value
                                                        setNewEnvGroupVars(vars)
                                                    }} 
                                                    className="font-mono text-xs"
                                                />
                                            </div>
                                        ))}
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setNewEnvGroupVars([...newEnvGroupVars, { key: "", value: "" }])} 
                                            className="w-full"
                                        >
                                            Add Variable
                                        </Button>
                                    </div>
                                    <Button onClick={handleCreateEnvGroup} className="w-full" disabled={!newEnvGroupName}>
                                        Create & Attach
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="flex flex-wrap gap-2 border p-3 rounded-md min-h-[60px] content-start bg-muted/20">
                        {availableEnvs.length === 0 && <span className="text-xs text-muted-foreground w-full text-center py-2">No environment groups found. Create one to get started!</span>}
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
                    <p className="text-xs text-muted-foreground">
                        Select environment groups to attach to this project. Environment variables from selected groups will be merged and injected as Kubernetes Secrets.
                    </p>
                </div>
            </div>

          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/20 px-6 py-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Terminal className="h-3 w-3" />
                  Ready to build
              </span>
              <Button onClick={handleSubmit} disabled={!isValidRepo || !projectName || isValidating}>
                  {isValidating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deploying...
                      </>
                  ) : (
                      "Deploy Project"
                  )}
              </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
