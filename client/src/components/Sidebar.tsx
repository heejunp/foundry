import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Lock, Database } from "lucide-react"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    activeTab: "projects" | "environments" | "storage"
    onTabChange: (tab: "projects" | "environments" | "storage") => void
}

export function Sidebar({ className, activeTab, onTabChange }: SidebarProps) {
    return (
        <div className={cn("pb-12 w-64 border-r min-h-screen", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        My Workspace
                    </h2>
                    <div className="space-y-1">
                        <Button 
                            variant={activeTab === "projects" ? "secondary" : "ghost"} 
                            className="w-full justify-start"
                            onClick={() => onTabChange("projects")}
                        >
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Projects
                        </Button>
                        <Button 
                            variant={activeTab === "environments" ? "secondary" : "ghost"} 
                            className="w-full justify-start"
                            onClick={() => onTabChange("environments")}
                        >
                            <Lock className="mr-2 h-4 w-4" />
                            Environments
                        </Button>
                        <Button 
                            variant={activeTab === "storage" ? "secondary" : "ghost"} 
                            className="w-full justify-start"
                            onClick={() => onTabChange("storage")}
                        >
                            <Database className="mr-2 h-4 w-4" />
                            Storage
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
