import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowBigUp, ArrowBigDown, Flag, Trash2, Send, CornerDownRight, Reply, TrendingUp, Clock, Award, ShieldAlert, Users, Info, Plus, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { db, FIREBASE_APP_ID } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, orderBy, query, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EmailVerificationPopup } from "@/components/EmailVerificationPopup";
import { SEO } from "@/components/SEO";

interface Comment {
    id: string;
    text: string;
    author: string;
    userId: string;
    upvotes?: number;
    upvotedBy?: string[];
    timestamp: any;
}

interface Post {
    id: string;
    content: string;
    author: string;
    userId: string;
  city: string;
  category?: string;
  upvotes: number;
  downvotes: number;
  flagged?: boolean;
    flagCount?: number;
    flaggedBy?: string[];
    shadowedForReview?: boolean;
    comments: Comment[];
    upvotedBy?: string[];
    downvotedBy?: string[];
    timestamp: any;
}

import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

export default function Forum() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"new" | "top" | "hot">("new");

  const categories = ["All", "General", "Safety", "Infrastructure", "Events", "Marketplace", "Feedback"];
  
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [verificationAction, setVerificationAction] = useState("");

  const displayedPosts = user ? posts : posts.slice(0, 5);

  useEffect(() => {
    // ... query setup ...
    // Note: Firestore rules must allow public read for this to work
    let q = query(
        collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts'),
        orderBy('timestamp', 'desc')
    );


    if (sortBy === 'top') {
        q = query(
            collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts'),
            orderBy('upvotes', 'desc')
        );
    }

    const unsubscribe = onSnapshot(q, 
        (snapshot) => {
            let postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            
            if (sortBy === 'hot') {
                // Simple hot algorithm: (upvotes - downvotes) / hours since post
                const now = Date.now();
                postsData.sort((a, b) => {
                    const aScore = (a.upvotes || 0) - (a.downvotes || 0);
                    const bScore = (b.upvotes || 0) - (b.downvotes || 0);
                    const aAge = (now - (a.timestamp?.toMillis() || now)) / 3600000 + 2;
                    const bAge = (now - (b.timestamp?.toMillis() || now)) / 3600000 + 2;
                    return (bScore / bAge) - (aScore / aAge);
                });
            }
            
            // Secondary sort by city if user city is available
            if (profile?.city) {
              // We don't want to override the primary sort, but maybe highlight city posts?
              // For now, let's keep the primary sort and just ensure city is visible
            }
            
            setPosts(postsData);
        },
        (error) => {
            console.error("[Forum] Firestore Snapshot error:", error);
            if (error.code === 'permission-denied') {
                toast({
                    title: "Access Denied",
                    description: "You don't have permission to view forum posts. Please ensure you are logged in.",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Connection Error",
                    description: "Failed to connect to the forum. Trying to reconnect...",
                    variant: "destructive"
                });
            }
        }
    );
  }, [profile?.city, sortBy]);

  const handleCreatePost = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
          toast({ title: "Login Required", description: "Please login to post." });
          return;
      }

      if (profile?.emailVerificationStatus !== 'verified') {
          setVerificationAction("create a post");
          setShowVerificationPopup(true);
          return;
      }

      if (!newPostContent.trim()) return;

      try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/forum/posts', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              content: newPostContent,
              category: selectedCategory === "All" ? "General" : selectedCategory,
              city: profile?.city || "Lagos",
              author: user?.displayName || "Citizen",
              userId: user?.uid || "anon"
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create post');
          }

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

      try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/forum/posts/${postId}/vote`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ type })
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to vote');
          }
      } catch (err: any) {
          console.error("Error voting", err);
          toast({ title: "Error", description: err.message || "Failed to vote.", variant: "destructive" });
      }
  };

  const handleCommentVote = async (postId: string, commentId: string) => {
      if (!user) {
          toast({ title: "Login Required", description: "Please login to like comments." });
          return;
      }

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const comment = post.comments.find(c => c.id === commentId);
      if (!comment) return;

      if (comment.upvotedBy?.includes(user.uid)) {
          toast({ title: "Already Liked", description: "You already liked this comment." });
          return;
      }

      const newComments = post.comments.map(c => 
          c.id === commentId 
              ? { ...c, upvotes: (c.upvotes || 0) + 1, upvotedBy: [...(c.upvotedBy || []), user.uid] }
              : c
      );

      const postRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId);
      await updateDoc(postRef, { comments: newComments });
  };

  const handleFlag = async (postId: string) => {
      if (!user) return;
      
      // Check if user already flagged this post
      const post = posts.find(p => p.id === postId);
      if (post?.flaggedBy?.includes(user.uid)) {
          toast({ title: "Already Flagged", description: "You have already flagged this post." });
          return;
      }
      
      if (!confirm("Flag this post as inappropriate?")) return;
      
      try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/forum/posts/${postId}/flag`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'Content-Type': 'application/json'
              }
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to flag post');
          }

          const result = await response.json();
          
          if (result.shadowed) {
              toast({ title: "Post Shadowed", description: "This post has been hidden for admin review due to multiple flags." });
          } else {
              toast({ title: "Flagged", description: `Post has been reported for review. (${result.flagCount}/${result.threshold} flags)` });
          }
      } catch (err: any) {
          console.error("Error flagging post", err);
          toast({ title: "Error", description: err.message || "Failed to flag post.", variant: "destructive" });
      }
  };

  const handleDelete = async (postId: string) => {
      if (!confirm("Are you sure you want to delete this post?")) return;
      await deleteDoc(doc(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'forum_posts', postId));
      toast({ title: "Deleted", description: "Post removed." });
  };

  const handleComment = async (e: React.FormEvent, postId: string) => {
      e.preventDefault();
      if (!user) {
          toast({ title: "Login Required", description: "Please login to comment." });
          return;
      }

      if (profile?.emailVerificationStatus !== 'verified') {
          setVerificationAction("add a comment");
          setShowVerificationPopup(true);
          return;
      }

      if (!commentText.trim()) return;

      try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/forum/posts/${postId}/comments`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                  text: replyingTo ? `@${posts.find(p => p.id === postId)?.comments.find(c => c.id === replyingTo)?.author || 'User'} ${commentText}` : commentText,
                  author: user.displayName || "Citizen",
                  userId: user.uid
              })
          });

          if (!response.ok) {
              throw new Error('Failed to add comment');
          }
          
          setCommentText("");
          setReplyingTo(null);
          toast({ title: "Comment Added", description: "Your reply has been posted." });
      } catch (err) {
          console.error("Error adding comment", err);
          toast({ title: "Error", description: "Failed to post comment.", variant: "destructive" });
      }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SEO 
        title="Community Forum" 
        description="Join the conversation on SabiRight. Discuss civic issues, safety, infrastructure, and more with verified citizens."
        keywords="civic forum, nigeria community, safety alerts, infrastructure discussion, sabiright forum"
      />
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20"
      >
        {/* Main Content Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Email Verification Popup */}
          <EmailVerificationPopup 
            isOpen={showVerificationPopup} 
            onClose={() => setShowVerificationPopup(false)} 
            actionName={verificationAction}
          />

          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Community Forum</h2>
              <p className="text-sm md:text-base text-slate-500">Verified discussions by verified citizens.</p>
            </div>
          </motion.div>

          {/* Sorting Tabs & Category Filter */}
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-auto">
                <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
                  <TabsTrigger value="new" className="rounded-lg py-1.5 px-3 md:px-4 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex gap-2">
                    <Clock className="h-3.5 w-3.5" /> New
                  </TabsTrigger>
                  <TabsTrigger value="hot" className="rounded-lg py-1.5 px-3 md:px-4 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex gap-2">
                    <TrendingUp className="h-3.5 w-3.5" /> Hot
                  </TabsTrigger>
                  <TabsTrigger value="top" className="rounded-lg py-1.5 px-3 md:px-4 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex gap-2">
                    <Award className="h-3.5 w-3.5" /> Top
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide no-scrollbar">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "rounded-full h-8 px-4 text-[11px] font-bold transition-all",
                      selectedCategory === cat ? "shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Create Post */}
          {!user ? (
            <motion.div variants={itemVariants}>
              <Card className="border-primary/20 bg-primary/5 rounded-2xl overflow-hidden">
                <CardContent className="p-6 text-center">
                  <h3 className="font-bold text-lg mb-2 text-slate-900">Join the Conversation</h3>
                  <p className="text-sm text-slate-500 mb-6">You must be logged in to share thoughts, vote, and comment.</p>
                  <Button 
                    onClick={() => window.location.href = '/auth/login'}
                    className="rounded-xl px-8 h-11 font-bold shadow-lg shadow-primary/20"
                  >
                    Login / Sign Up
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={itemVariants}>
              <Card className="border-slate-100 bg-white rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                      <form onSubmit={handleCreatePost} className="flex flex-col gap-3">
                          <div className="flex gap-3 items-center">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {user.displayName?.[0] || 'C'}
                            </div>
                            <Input 
                              value={newPostContent}
                              onChange={e => setNewPostContent(e.target.value)}
                              placeholder="Create a post..." 
                              className="bg-slate-50 border-none h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                            />
                            <Button type="submit" size="sm" className="rounded-xl px-6 font-bold">Post</Button>
                          </div>
                      </form>
                  </CardContent>
              </Card>
            </motion.div>
          )}

      {/* Posts List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <AnimatePresence>
          {posts
            .filter(post => !post.shadowedForReview)
            .filter(post => selectedCategory === "All" || post.category === selectedCategory)
            .slice(0, user ? undefined : 5)
            .map(post => (
            <motion.div key={post.id} variants={itemVariants} layout>
              <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
                <CardContent className="p-6">
                  {/* Post Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                        post.category === 'Safety' ? 'bg-red-500' :
                        post.category === 'Infrastructure' ? 'bg-amber-500' :
                        post.category === 'Events' ? 'bg-purple-500' :
                        'bg-blue-500'
                      }`}>
                        {post.author.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{post.author}</p>
                          <Badge variant="secondary" className="text-[10px] h-5">{post.category}</Badge>
                          {post.city && (
                            <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-1">
                                <MapPin className="h-2 w-2" /> {post.city}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                    {user && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleFlag(post.id)}>
                        <Flag className="h-4 w-4" />
                      </Button>
                      {user?.uid === post.userId && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDelete(post.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="mb-6">
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-slate-100 rounded-full p-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 rounded-full ${post.upvotedBy?.includes(user?.uid || '') ? 'text-green-600 bg-green-100' : 'text-slate-500 hover:bg-white'}`}
                          onClick={() => handleVote(post.id, 'up')}
                        >
                          <ArrowBigUp className="h-5 w-5" />
                        </Button>
                        <span className="text-sm font-bold w-6 text-center">{post.upvotes || 0}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 rounded-full ${post.downvotedBy?.includes(user?.uid || '') ? 'text-red-600 bg-red-100' : 'text-slate-500 hover:bg-white'}`}
                          onClick={() => handleVote(post.id, 'down')}
                        >
                          <ArrowBigDown className="h-5 w-5" />
                        </Button>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-slate-500 gap-2"
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {post.comments?.length || 0} Comments
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" className="text-slate-500">
                      <CornerDownRight className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {expandedPostId === post.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 pt-6 border-t"
                      >
                        {!user ? (
                           <div className="text-center py-6 bg-slate-50 rounded-xl">
                              <p className="text-slate-500 mb-2">Sign in to view comments and join the discussion.</p>
                              <Link href="/auth/login">
                                <Button variant="outline">Sign In</Button>
                              </Link>
                           </div>
                        ) : (
                        <>
                        <div className="space-y-4 mb-6">
                          {post.comments?.map((comment) => (
                            <div key={comment.id} className="flex gap-3 bg-slate-50 p-3 rounded-xl">
                              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                                {comment.author.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <p className="text-xs font-bold">{comment.author}</p>
                                  <span className="text-[10px] text-slate-400">
                                    {comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 mt-1">{comment.text}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <button 
                                    className={`text-[10px] font-bold flex items-center gap-1 ${comment.upvotedBy?.includes(user?.uid || '') ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    onClick={() => handleCommentVote(post.id, comment.id)}
                                  >
                                    <TrendingUp className="h-3 w-3" /> Helpful ({comment.upvotes || 0})
                                  </button>
                                  <button 
                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                                    onClick={() => {
                                      setReplyingTo(comment.id);
                                      setCommentText(`@${comment.author} `);
                                    }}
                                  >
                                    <Reply className="h-3 w-3" /> Reply
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={(e) => handleComment(e, post.id)} className="flex gap-2">
                          <Input 
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                            className="flex-1"
                          />
                          <Button type="submit" size="icon" disabled={!commentText.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </form>
                        </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {!user && posts.length > 5 && (
        <div className="mt-8 text-center p-8 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
            <h3 className="text-xl font-bold mb-2">Join the Community to Read More</h3>
            <p className="text-slate-500 mb-6">Sign in to access unlimited posts, comment, and vote.</p>
            <Link href="/auth/login">
                <Button size="lg" className="shadow-xl">Sign In / Sign Up</Button>
            </Link>
        </div>
      )}
        </div>

    {/* Sidebar Column */}
    <div className="lg:col-span-4 space-y-6">
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-slate-100 shadow-sm rounded-xl">
          <div className="h-12 bg-primary flex items-center px-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Info className="h-4 w-4" /> About Community
            </h3>
          </div>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Welcome to the SabiRight Community Forum. This is a space for verified citizens to discuss local issues, share reports, and engage in meaningful conversation.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Members</p>
                <p className="font-bold text-slate-900">1.2k</p>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Online</p>
                <p className="font-bold text-green-600">84</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Community Rules</h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>Be respectful to others</li>
                <li>No hate speech or harassment</li>
                <li>Keep discussions relevant to your city</li>
                <li>No spam or self-promotion</li>
              </ul>
            </div>
            <Button variant="outline" className="w-full rounded-xl text-xs font-bold">
              View Guidelines
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-slate-100 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top Contributors
            </h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                      {i}
                    </div>
                    <span className="text-sm font-medium text-slate-700">Citizen_{i}024</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px]">
                    +{100 * (4-i)} pts
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {user && (
        <motion.div variants={itemVariants}>
          <Button 
            onClick={() => document.querySelector('input')?.focus()}
            className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/20 flex gap-2"
          >
            <Plus className="h-5 w-5" /> Create New Post
          </Button>
        </motion.div>
      )}
    </div>
  </motion.div>
</div>
  );
}
