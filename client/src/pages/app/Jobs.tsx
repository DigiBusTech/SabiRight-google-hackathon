import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Building2, MapPin, DollarSign, Clock, Search, Loader2 } from "lucide-react";
import { db, FIREBASE_APP_ID } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, addDoc, serverTimestamp } from "firebase/firestore";
import { runGemini } from "@/lib/gemini";
import ReactMarkdown from "react-markdown";

interface Job {
  id: string;
  title: string;
  company?: string;
  location: string;
  type: string;
  workMode?: string;
  salary?: string;
  description?: string;
  contact?: string;
  source?: string;
  postedAt?: any;
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  
  // Search state
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("Lagos");

  useEffect(() => {
    // Initial Load - Listen to jobs
    const q = query(
      collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'jobs'), 
      orderBy('postedAt', 'desc'), 
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);

    try {
        // 1. Filter local/db results first (Mocking complex query for speed)
        // In a real app we'd do a complex compound query, but here we'll fetch and filter or trust the listener
        
        // 2. AI Match Logic if needed
        const aiPrompt = `
            Act as a Job Search API for Nigeria.
            Criteria: Role: ${role}, Location: ${location}.
            
            Task: List 3 highly realistic job opportunities matching these criteria.
            
            CRITICAL INSTRUCTIONS:
            1. The 'description' must be a full, comprehensive job description (at least 100 words). **Format the description using Markdown.**
            2. The 'contact' field must be a URL or email.
            3. The 'source' field must be the name of the external job platform (e.g., LinkedIn).
            
            Output: Return ONLY a JSON Array of objects. No markdown blocks.
            Schema: [{"title": "...", "company": "...", "location": "...", "type": "Full-time", "salary": "...", "contact": "...", "description": "...", "source": "..."}]
        `;

        const aiResponse = await runGemini(aiPrompt);
        if (aiResponse) {
             try {
                // Use a simpler regex for compatibility if needed, or just handle the string directly
                // The issue was the 's' flag for dotAll which might need es2018 target
                const jsonMatch = aiResponse.match(/\[[\s\S]*\]/); 
                const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;
                const newJobs = JSON.parse(cleanJson);
                
                // Add to Firestore to trigger update
                for (const job of newJobs) {
                    await addDoc(collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'jobs'), {
                        ...job,
                        postedAt: serverTimestamp(),
                        isAiFetched: true
                    });
                }
             } catch (e) {
                 console.error("Failed to parse AI jobs", e);
             }
        }

    } catch (err) {
        console.error(err);
    } finally {
        setSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Job Matches</h2>
          <p className="text-slate-500">Opportunities curated for your verified profile.</p>
        </div>
        <Button onClick={() => document.getElementById('search-form')?.scrollIntoView({behavior: 'smooth'})}>
            Post a Job
        </Button>
      </div>

      {/* Search Form */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-6">
            <form id="search-form" onSubmit={handleSearch} className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-800 uppercase">Role / Keywords</label>
                    <input 
                        className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none" 
                        placeholder="e.g. Software Engineer"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-800 uppercase">Location</label>
                    <input 
                        className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none" 
                        placeholder="e.g. Lagos"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                    />
                </div>
                <div className="flex items-end">
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold" disabled={searching}>
                        {searching ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
                        Find Matches
                    </Button>
                </div>
            </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
            <div className="text-center py-10 text-slate-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">No jobs found. Try running a search!</div>
        ) : (
            jobs.map((job) => (
            <Card key={job.id} className="hover:border-primary/50 transition-colors group relative overflow-hidden">
                {job.source && job.source !== 'User Posted' && (
                    <div className="absolute top-0 right-0 bg-purple-100 text-purple-800 text-[10px] px-2 py-1 font-bold rounded-bl-lg">
                        AI Fetched
                    </div>
                )}
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start">
                <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                    <Building2 className="h-8 w-8 text-slate-400" />
                </div>
                
                <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-3 pr-20">
                    <h3 className="font-bold text-lg">{job.title}</h3>
                    <Badge variant={job.type === "Full-time" ? "default" : "secondary"}>
                        {job.type}
                    </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {job.company || "Confidential"}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> {job.salary || "Negotiable"}</span>
                    </div>

                    <div className="text-sm text-slate-600 mt-2 line-clamp-2 prose prose-sm max-w-none">
                        <ReactMarkdown>{job.description || ""}</ReactMarkdown>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                    <Button className="flex-1 md:flex-none w-full" onClick={() => window.open(job.contact?.startsWith('http') ? job.contact : `mailto:${job.contact}`, '_blank')}>
                        Apply Now
                    </Button>
                </div>
                </CardContent>
            </Card>
            ))
        )}
      </div>
    </div>
  );
}
