import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Flag, Trash2, Send, CornerDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { db, FIREBASE_APP_ID } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, orderBy, query, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Comment {
    id: string;
    text: string;
    author: string;
    userId: string;
    timestamp: any;
}

interface Post {
    id: string;
    content: string;
    author: string;
    userId: string;
    city: string;
    upvotes: number;
    downvotes: number;
    flagged?: boolean;
    comments: Comment[];
    timestamp: any;
}

export default function Forum() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  
  // State for interactions
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

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
              city: "Lagos", // In a real app, get this from user profile
              author: user?.displayName || "Citizen",
              userId: user?.uid || "anon",
              upvotes: 0,
              downvotes: 0,
              comments: [],
              flagged: false,
              timestamp: serverTimestamp()
          });
          setNewPostContent("");
          toast({ title: "Posted", description: "Your voice has been heard." });
      } catch (err) {
          console.error("Error creating post", err);
          toast({ title: "Error", description: "Failed to post message.", variant: "destructive" });
      }
  };

  const handleVote = async (postId: string, type: 'up' | 'down') => {
      if (!user) {
          toast({ title: "Login Required", description: "You must be logged in to vote." });
          return;
      }
      const postRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId);
      await updateDoc(postRef, {
          [type === 'up' ? 'upvotes' : 'downvotes']: increment(1)
      });
  };

  const handleFlag = async (postId: string) => {
      if (!user) return;
      if (!confirm("Flag this post as inappropriate?")) return;
      
      const postRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId);
      await updateDoc(postRef, { flagged: true });
      toast({ title: "Flagged", description: "Post has been reported for review." });
  };

  const handleDelete = async (postId: string) => {
      if (!confirm("Are you sure you want to delete this post?")) return;
      await deleteDoc(doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId));
      toast({ title: "Deleted", description: "Post removed." });
  };

  const handleComment = async (e: React.FormEvent, postId: string) => {
      e.preventDefault();
      if (!commentText.trim() || !user) return;

      const newComment: Comment = {
          id: crypto.randomUUID(),
          text: commentText,
          author: user.displayName || "Citizen",
          userId: user.uid,
          timestamp: new Date().toISOString()
      };

      const postRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId);
      await updateDoc(postRef, {
          comments: arrayUnion(newComment)
      });
      
      setCommentText("");
      toast({ title: "Comment Added", description: "Your reply has been posted." });
  };

  return (
    <div className="space-y-8 pb-20">
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
          <Card key={post.id} className={cn("transition-colors", post.flagged ? "bg-red-50 border-red-100" : "hover:border-primary/50")}>
            <CardContent className="p-6">
              <div className="flex gap-4">
                {/* Voting Column */}
                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                   <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-green-600" onClick={() => handleVote(post.id, 'up')}>
                       <ThumbsUp className="h-4 w-4" />
                   </Button>
                   <span className="font-bold text-sm">{(post.upvotes || 0) - (post.downvotes || 0)}</span>
                </div>
                
                {/* Main Content */}
                <div className="flex-1">
                  <h3 className={cn("font-bold text-lg mb-2 text-slate-800", post.flagged && "text-red-800 italic")}>
                      {post.flagged ? "[This post has been flagged for review]" : post.content}
                  </h3>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{post.city}</span>
                    <span className="text-xs text-slate-400">• Posted by {post.author}</span>
                  </div>
                  
                  {/* Action Bar */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium border-t pt-3">
                    <button 
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                        <MessageSquare className="h-3 w-3" /> {post.comments?.length || 0} Comments
                    </button>
                    
                    {user?.uid === post.userId && (
                        <button 
                            onClick={() => handleDelete(post.id)}
                            className="flex items-center gap-1 hover:text-red-600 transition-colors ml-auto"
                        >
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    )}
                    
                    <button 
                        onClick={() => handleFlag(post.id)}
                        className="flex items-center gap-1 hover:text-red-500 transition-colors"
                    >
                        <Flag className="h-3 w-3" /> Flag
                    </button>
                  </div>

                  {/* Comments Section */}
                  {expandedPostId === post.id && (
                      <div className="mt-4 pt-4 border-t bg-slate-50/50 -mx-6 px-6 pb-6 rounded-b-xl animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-4 mb-4">
                              {post.comments?.length === 0 && <p className="text-xs text-slate-400 italic">No comments yet. Be the first.</p>}
                              {post.comments?.map((comment) => (
                                  <div key={comment.id} className="flex gap-3 text-sm">
                                      <CornerDownRight className="h-4 w-4 text-slate-300 mt-1 shrink-0" />
                                      <div className="bg-white p-3 rounded-lg border shadow-sm flex-1">
                                          <div className="flex justify-between items-baseline mb-1">
                                              <span className="font-bold text-xs text-slate-700">{comment.author}</span>
                                              {/* <span className="text-[10px] text-slate-400">Just now</span> */}
                                          </div>
                                          <p className="text-slate-600">{comment.text}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          <form onSubmit={(e) => handleComment(e, post.id)} className="flex gap-2 pl-7">
                              <Input 
                                  value={commentText}
                                  onChange={e => setCommentText(e.target.value)}
                                  placeholder="Write a reply..." 
                                  className="h-9 text-xs bg-white"
                              />
                              <Button type="submit" size="sm" className="h-9 w-9 p-0">
                                  <Send className="h-4 w-4" />
                              </Button>
                          </form>
                      </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
