import { useState, useEffect } from "react"
import { Plus, Trash2, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface EnvironmentVar {
    key: string
    value: string
}

interface Environment {
    id: string
    name: string
    variables: EnvironmentVar[]
    createdAt: string
}

export function EnvironmentList() {
    const [envs, setEnvs] = useState<Environment[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const token = localStorage.getItem("foundry_token")

    // Create Form State
    const [newName, setNewName] = useState("")
    const [newVars, setNewVars] = useState<EnvironmentVar[]>([{ key: "", value: "" }])

    useEffect(() => {
        fetchEnvs()
    }, [])

    const fetchEnvs = async () => {
        try {
            const res = await fetch("/api/environments", {
                headers: { "X-User-ID": token || "" }
            })
            if (res.ok) setEnvs(await res.json())
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddVar = () => {
        setNewVars([...newVars, { key: "", value: "" }])
    }

    const handleCreate = async () => {
        if (!newName) return
        try {
            const res = await fetch("/api/environments", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-User-ID": token || "" 
                },
                body: JSON.stringify({
                    name: newName,
                    variables: newVars.filter(v => v.key && v.value)
                })
            })
            if (res.ok) {
                fetchEnvs()
                setIsCreateOpen(false)
                setNewName("")
                setNewVars([{ key: "", value: "" }])
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will not affect running projects until they are redeployed.")) return
        try {
            await fetch(`/api/environments/${id}`, {
                method: "DELETE",
                headers: { "X-User-ID": token || "" }
            })
            fetchEnvs()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Environments</h2>
                    <p className="text-muted-foreground">Manage reusable environment variables (secrets).</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> New Environment</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Environment Group</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Production Database" />
                            </div>
                            <div className="space-y-2">
                                <Label>Variables</Label>
                                {newVars.map((v, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input placeholder="KEY" value={v.key} onChange={e => {
                                            const vars = [...newVars]
                                            vars[i].key = e.target.value
                                            setNewVars(vars)
                                        }} />
                                        <Input placeholder="VALUE" value={v.value} onChange={e => {
                                            const vars = [...newVars]
                                            vars[i].value = e.target.value
                                            setNewVars(vars)
                                        }} />
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={handleAddVar} className="w-full">Add Variable</Button>
                            </div>
                            <Button onClick={handleCreate} className="w-full">Create</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {envs.map(env => (
                    <Card key={env.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                {env.name}
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(env.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{env.variables?.length || 0}</div>
                            <p className="text-xs text-muted-foreground">Variables</p>
                            <div className="mt-4 space-y-1">
                                {env.variables?.slice(0, 3).map((v, i) => (
                                    <div key={i} className="text-xs font-mono text-muted-foreground truncate">{v.key}</div>
                                ))}
                                {(env.variables?.length || 0) > 3 && <div className="text-xs text-muted-foreground">...</div>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
