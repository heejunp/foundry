import { ExternalLink, User as UserIcon, Heart, Eye, Star } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
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

interface Project {
    id: string
    name: string
    repoUrl: string
    deployUrl: string
    owner: { username: string }
    viewCount: number
    likeCount: number
    isLiked: boolean
    isFavorited: boolean
}

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [sort, setSort] = useState("latest")
  const token = localStorage.getItem("foundry_token")

  const fetchProjects = async () => {
    try {
        const headers: Record<string, string> = {}
        if (token) headers["X-User-ID"] = token

        const res = await fetch(`/api/projects/public?sort=${sort}`, { headers })
        if (res.ok) {
            const data = await res.json()
            setProjects(data)
        }
    } catch (e) {
        console.error("Failed to fetch projects")
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [sort, token])

  const handleInteraction = async (id: string, type: "like" | "favorite" | "view") => {
    if (!token && type !== "view") return // Guests can view, but not like/fav logic is server-side gated usually, but View is open? Actually let's gate Like/Fav. View should work for guests? My implementation required UserID for view uniqueness. Guests might fail. Let's make view safe.
    
    // Optimistic Update
    setProjects(prev => prev.map(p => {
        if (p.id !== id) return p
        if (type === "like") return { ...p, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1, isLiked: !p.isLiked }
        if (type === "favorite") return { ...p, isFavorited: !p.isFavorited }
        if (type === "view") return { ...p, viewCount: p.viewCount + 1 }
        return p
    }))

    try {
        await fetch(`/api/projects/${id}/${type}`, {
            method: "POST",
            headers: { "X-User-ID": token || "" }
        })
        // On error we should revert, but for MVP skipping
    } catch (e) {
        console.error("Interaction failed")
    }
  }

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Community Feed</h2>
            <p className="text-muted-foreground">
            Discover what others are building on Foundry.
            </p>
        </div>
        
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="latest">Latest</SelectItem>
                    <SelectItem value="likes">Most Liked</SelectItem>
                    <SelectItem value="views">Most Viewed</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className={`hover:shadow-md transition-all ${project.isFavorited ? 'border-primary/50 bg-primary/5' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <CardTitle className="text-lg truncate pr-2">{project.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleInteraction(project.id, "favorite")}>
                      <Star className={`h-4 w-4 ${project.isFavorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </Button>
              </div>
              <CardDescription className="flex items-center gap-2 mt-1">
                <div className="bg-secondary p-1 rounded-full">
                     <UserIcon className="h-3 w-3" />
                </div>
                 <span>{project.owner.username}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-24 bg-muted/30 rounded-md border border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                     onClick={() => {
                        window.open(project.deployUrl, "_blank")
                        handleInteraction(project.id, "view")
                     }}>
                    <span>Click to Visit & Preview</span>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm" className={`h-8 px-2 gap-1 ${project.isLiked ? 'text-red-500 hover:text-red-600' : ''}`} 
                    onClick={() => handleInteraction(project.id, "like")}>
                      <Heart className={`h-4 w-4 ${project.isLiked ? "fill-current" : ""}`} />
                      <span>{project.likeCount}</span>
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                      <Eye className="h-4 w-4" />
                      <span>{project.viewCount}</span>
                  </div>
              </div>
              
              <Button asChild variant="outline" size="sm" onClick={() => handleInteraction(project.id, "view")}>
                <a href={project.deployUrl} target="_blank" rel="noreferrer">
                  Visit <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
