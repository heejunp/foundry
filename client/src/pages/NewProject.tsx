import { useState } from "react"
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

export function NewProjectPage() {
  const navigate = useNavigate()
  const [repoUrl, setRepoUrl] = useState("")
  const [projectName, setProjectName] = useState("")
  const [branch, setBranch] = useState("main") // Default branch
  const [isValidating, setIsValidating] = useState(false)
  const [isValidRepo, setIsValidRepo] = useState<boolean | null>(null)
  
  // Environment Variables State
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvValue, setNewEnvValue] = useState("")

  // 1. Repo Validation Logic
  const handleRepoBlur = async () => {
    if (!repoUrl) return
    setIsValidating(true)
    setIsValidRepo(null)

    // Parse project name from URL if empty
    // e.g., https://github.com/user/my-project -> my-project
    const parts = repoUrl.split("/")
    const potentialName = parts[parts.length - 1]?.replace(".git", "")
    if (!projectName && potentialName) {
        setProjectName(potentialName)
    }

    try {
        // Mock validation for now (In real app, call backend to check git ls-remote)
        // Just simulate a check delay
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // Simple regex check for now
        const isGithub = repoUrl.includes("github.com")
        setIsValidRepo(isGithub)
    } catch (e) {
        setIsValidRepo(false)
    } finally {
        setIsValidating(false)
    }
  }

  // 2. Env Var Logic
  const addEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      setEnvVars([...envVars, { key: newEnvKey, value: newEnvValue }])
      setNewEnvKey("")
      setNewEnvValue("")
    }
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
      // Create Project logic here
      console.log("Creating project:", { repoUrl, projectName, branch, envVars })
      
      const token = localStorage.getItem("foundry_token")
      if (!token) {
          navigate("/login")
          return
      }

      setIsValidating(true) // Reuse state for loading
      
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
                envVars: envVars
            })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Failed to create project")
        }

        const project = await res.json()
        console.log("Project Created:", project)
        
        navigate("/mypage")

      } catch (e: any) {
          console.error("Failed to create project:", e)
          alert(e.message || "Something went wrong")
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
                      setIsValidRepo(null) // Reset validation
                  }}
                  onBlur={handleRepoBlur}
                  className={isValidRepo === true ? "border-green-500 ring-green-500/20 pr-10" : ""}
                />
                
                {/* Validation Icons */}
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

            {/* 2. Project Name & Branch */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input 
                        id="project-name" 
                        placeholder="my-awesome-app" 
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                    />
                </div>
                
                <div className="space-y-2">
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
            </div>

            {/* 3. Environment Variables */}
            <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Environment Variables</h3>
                </div>
                
                {/* List of added vars */}
                {envVars.length > 0 && (
                    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                        {envVars.map((env, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-2 bg-background rounded-sm border">
                                <span className="font-mono font-semibold text-xs text-muted-foreground">KEY:</span>
                                <span className="font-mono flex-1">{env.key}</span>
                                <span className="font-mono font-semibold text-xs text-muted-foreground">VAL:</span>
                                <span className="font-mono flex-1 truncate text-muted-foreground">{env.value}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeEnvVar(i)}>
                                    <Plus className="h-4 w-4 rotate-45" /> 
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add New Var Form */}
                <div className="flex gap-2 items-end">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Key</Label>
                            <Input 
                                placeholder="API_KEY" 
                                className="font-mono text-sm"
                                value={newEnvKey}
                                onChange={(e) => setNewEnvKey(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Value</Label>
                            <Input 
                                placeholder="secret_123..." 
                                className="font-mono text-sm" 
                                value={newEnvValue}
                                onChange={(e) => setNewEnvValue(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button variant="secondary" onClick={addEnvVar} disabled={!newEnvKey || !newEnvValue}>
                        <Plus className="h-4 w-4" />
                    </Button>
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
