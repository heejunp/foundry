import { useEffect, useState, useRef } from "react"
import { Loader2, X, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LogsModalProps {
  projectId: string | null
  isOpen: boolean
  onClose: () => void
}

export function LogsModal({ projectId, isOpen, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const token = localStorage.getItem("foundry_token")
  const scrollRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (isOpen && projectId) {
      fetchLogs()
      if (autoRefresh) {
          const interval = setInterval(fetchLogs, 3000)
          return () => clearInterval(interval)
      }
    }
  }, [isOpen, projectId, autoRefresh])

  useEffect(() => {
      // Auto-scroll to bottom
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
  }, [logs])

  const fetchLogs = async () => {
    if (!projectId) return
    // Don't set global loading state on refresh to avoid flicker
    if (!logs) setLoading(true) 
    
    try {
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        headers: { "X-User-ID": token || "" }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col bg-zinc-950 border-zinc-800 text-zinc-300 p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between bg-zinc-900/50">
          <DialogTitle className="text-sm font-mono flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             Live Logs: {projectId}
          </DialogTitle>
          <div className="flex items-center gap-2">
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 hover:bg-zinc-800" 
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? "Pause Auto-refresh" : "Resume Auto-refresh"}
             >
                 <RefreshCcw className={`h-3 w-3 ${autoRefresh ? "animate-spin" : ""}`} />
             </Button>
             <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-800" onClick={onClose}>
                 <X className="h-4 w-4" />
             </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative group">
            {loading && !logs ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-zinc-500" />
                </div>
            ) : (
                <pre 
                    ref={scrollRef}
                    className="h-full w-full p-4 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap"
                >
                    {logs || "No logs available or connecting..."}
                </pre>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
