import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Eye, ThumbsUp, MoreHorizontal, Flag, Trash2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { db, FIREBASE_APP_ID, auth } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Comment {
    id: string;
    text: string;
    author: string;
    timestamp: any;
}

interface Post {
    id: string;
    title?: string; // Optional if existing data doesn't have it
    content: string;
    author: string;
    city: string;
    upvotes: number;
    downvotes: number;
    comments: Comment[];
    timestamp: any;
}

export default function Forum() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState("");

  useEffect(() => {
    const q = query(
        collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts'),
        orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        setPosts(postsData);
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPostContent.trim()) return;

      try {
          await addDoc(collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts'), {
              content: newPostContent,
              city: "Lagos", // Mock
              author: user?.displayName || "Citizen",
              userId: user?.uid || "anon",
              upvotes: 0,
              downvotes: 0,
              comments: [],
              timestamp: serverTimestamp()
          });
          setNewPostContent("");
      } catch (err) {
          console.error("Error creating post", err);
      }
  };

  const handleVote = async (postId: string, type: 'up' | 'down') => {
      const postRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId);
      await updateDoc(postRef, {
          [type === 'up' ? 'upvotes' : 'downvotes']: increment(1)
      });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Community Forum</h2>
          <p className="text-slate-500">Verified discussions by verified citizens.</p>
        </div>
      </div>

      {/* Create Post */}
      <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
              <form onSubmit={handleCreatePost} className="flex gap-4">
                  <Input 
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="Share a thought or report..." 
                    className="bg-white"
                  />
                  <Button type="submit">Post</Button>
              </form>
          </CardContent>
      </Card>

      <div className="grid gap-4">
        {posts.map((post) => (
          <Card key={post.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                   <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-green-600" onClick={() => handleVote(post.id, 'up')}>
                       <ThumbsUp className="h-4 w-4" />
                   </Button>
                   <span className="font-bold text-sm">{(post.upvotes || 0) - (post.downvotes || 0)}</span>
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 text-slate-800">{post.content}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{post.city}</span>
                    <span className="text-xs text-slate-400">• Posted by {post.author}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {post.comments?.length || 0} Comments</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"><Flag className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
