"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { Plus, MessageSquare, Trash2, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Dashboard() {
    const projects = useQuery(api.projects.list) || [];
    const createProject = useMutation(api.projects.create);
    const deleteProject = useMutation(api.projects.requestDelete);
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            const id = await createProject({ title: "New Project" });
            router.push(`/project/${id}`);
        } catch (error) {
            console.error(error);
            setIsCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans p-8">
            <header className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">C</div>
                    <span className="text-xl font-bold">CodeAgent</span>
                </div>
                <UserButton />
            </header>

            <main className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold">Your Projects</h1>
                    <button 
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                        <Plus size={16} /> 
                        {isCreating ? "Creating..." : "New Project"}
                    </button>
                </div>

                {projects.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl">
                        <p className="text-neutral-500 mb-4">No projects yet</p>
                        <button onClick={handleCreate} className="text-blue-500 hover:underline">Create your first one</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((project) => (
                            <div key={project._id} className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 transition-all hover:shadow-lg flex flex-col justify-between h-40 cursor-pointer" onClick={() => router.push(`/project/${project._id}`)}>
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-medium truncate pr-4">{project.title}</h3>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteProject({ projectId: project._id }); }}
                                            className="text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                                        <Calendar size={12} />
                                        {new Date(project.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="bg-neutral-800 p-2 rounded-full">
                                        <MessageSquare size={16} className="text-neutral-400" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
