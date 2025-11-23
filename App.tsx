import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppStep, ArtStyle, UserProfile, GenerationRequest, HistoryItem } from './types';
import { generateGraphicalAbstract } from './services/geminiService';
import { StyleCard } from './components/StyleCard';
import { saveHistoryToDB, getHistoryFromDB } from './services/db.ts';

// TODO: To enable real Google Auth, create a project at https://console.cloud.google.com/
// Create an OAuth 2.0 Client ID for a Web Application
// Add your origin to "Authorized JavaScript origins"
const GOOGLE_CLIENT_ID = ""; // e.g. "123456789-abc...apps.googleusercontent.com"

const MOCK_ACCOUNTS = [
    { 
        name: "Dr. Alex Researcher", 
        email: "alex.researcher@university.edu", 
        avatar: "https://ui-avatars.com/api/?name=Alex+Researcher&background=0D8ABC&color=fff&size=128" 
    },
    { 
        name: "Sarah Student", 
        email: "sarah.s@institute.org", 
        avatar: "https://ui-avatars.com/api/?name=Sarah+Student&background=EB4D4B&color=fff&size=128" 
    }
];

const STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
  [ArtStyle.THREE_D]: "High-fidelity 3D renderings with depth, lighting, and texture.",
  [ArtStyle.PHOTOGRAPH]: "Realistic photographic style, looking like a captured image.",
  [ArtStyle.ILLUSTRATION]: "Clean, hand-drawn or digital artwork suitable for journals.",
  [ArtStyle.PAINTING]: "Artistic interpretation using digital oil or watercolor styles.",
  [ArtStyle.CARTOON]: "Simplified, stylized line art often used for storytelling.",
  [ArtStyle.INFOGRAPHIC]: "Data-rich visual layouts focusing on statistics and flow.",
  [ArtStyle.DIAGRAM]: "Technical schematics, flowcharts, and anatomical cuts.",
  [ArtStyle.STICK]: "Minimalist stick figures and lines for simple concept explanation.",
};

// Use placeholder images for style previews
const STYLE_IMAGES: Record<ArtStyle, string> = {
    [ArtStyle.THREE_D]: "https://images.unsplash.com/photo-1614854262318-831574f15f1f?q=80&w=2070&auto=format&fit=crop",
    [ArtStyle.PHOTOGRAPH]: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop",
    [ArtStyle.ILLUSTRATION]: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop",
    [ArtStyle.PAINTING]: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2045&auto=format&fit=crop",
    [ArtStyle.CARTOON]: "https://images.unsplash.com/photo-1618005182384-a31215b57fbe?q=80&w=1964&auto=format&fit=crop",
    [ArtStyle.INFOGRAPHIC]: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
    [ArtStyle.DIAGRAM]: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop",
    [ArtStyle.STICK]: "https://images.unsplash.com/photo-1555421689-d68471e189f2?q=80&w=2070&auto=format&fit=crop",
};

interface TextLabel {
  id: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  text: string;
}

// Add Window interface for Google global
declare global {
  interface Window {
    google: any;
  }
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.AUTH);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [request, setRequest] = useState<GenerationRequest>({
    prompt: '',
    style: ArtStyle.ILLUSTRATION,
    baseImage: null
  });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [isSignUp, setIsSignUp] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  
  // Tutorial State
  const [currentTutorialSlide, setCurrentTutorialSlide] = useState(0);

  // --- Auth State ---
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [authFormData, setAuthFormData] = useState({ name: '', email: '', password: '' });

  // --- Result Editing State ---
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [textMode, setTextMode] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [activeLabelInput, setActiveLabelInput] = useState<{x: number, y: number} | null>(null);
  
  // --- Dragging State ---
  const [draggedLabelId, setDraggedLabelId] = useState<number | null>(null);
  const dragOffsetRef = useRef<{ startX: number, startY: number, initialLabelX: number, initialLabelY: number } | null>(null);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // --- DB Sync Effect ---
  useEffect(() => {
    if (currentStep === AppStep.DASHBOARD && user) {
        // Load history from DB when entering dashboard
        getHistoryFromDB()
            .then(data => {
                setHistory(data);
                setDbConnected(true);
            })
            .catch(err => {
                console.error("DB Load error", err);
                setDbConnected(false);
            });
    }
  }, [currentStep, user]);

  // --- Tutorial Data ---
  const TUTORIAL_SLIDES = [
    {
        title: "1. Enter your Prompt",
        description: "Start by describing your scientific concept or process in the text box. Be specific about the elements you want to visualize.",
        visual: (
            <div className="w-24 h-24 relative bg-slate-800 rounded-xl border border-slate-600 p-3 flex flex-col gap-2 overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-accent-cyan"></div>
                {/* Traffic Light Dots */}
                <div className="flex gap-1.5 mb-2 opacity-60">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                {/* Typing Animation */}
                <div className="h-2 bg-slate-700 rounded w-1/3 mb-2"></div>
                <div className="space-y-2">
                    <div className="flex items-center gap-1">
                        <div className="h-1.5 bg-brand-400 rounded w-full animate-[typing_2s_steps(15)_infinite_alternate]"></div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-1.5 bg-brand-400/70 rounded w-3/4 animate-[typing_2.5s_steps(15)_infinite_alternate_200ms]"></div>
                        <div className="w-1 h-3 bg-brand-500 animate-pulse"></div>
                    </div>
                </div>
                <div className="absolute bottom-2 right-2 p-1.5 bg-brand-600 rounded-full shadow-lg shadow-brand-500/30 animate-bounce">
                     <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
            </div>
        )
    },
    {
        title: "2. Select a Style",
        description: "Choose from a variety of styles tailored for scientific publications, including 3D Renders, Diagrams, or Illustrations.",
        visual: (
            <div className="w-24 h-24 relative flex items-center justify-center perspective-[1000px]">
                {/* Card Left */}
                <div className="absolute w-12 h-16 bg-slate-700 rounded-lg border border-slate-600 transform -rotate-12 -translate-x-6 translate-y-2 opacity-50 shadow-md"></div>
                {/* Card Right */}
                <div className="absolute w-12 h-16 bg-slate-700 rounded-lg border border-slate-600 transform rotate-12 translate-x-6 translate-y-2 opacity-50 shadow-md"></div>
                {/* Card Center - Active */}
                <div className="absolute w-14 h-20 bg-gradient-to-br from-brand-600 to-indigo-600 rounded-lg border border-white/20 shadow-[0_0_20px_rgba(139,92,246,0.5)] z-10 animate-float flex flex-col items-center justify-center group overflow-hidden">
                     <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                     <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                     </div>
                </div>
            </div>
        )
    },
    {
        title: "3. Generate Image",
        description: "Our advanced AI engine analyzes your prompt and style selection to generate a high-quality graphical abstract in seconds.",
        visual: (
            <div className="w-24 h-24 relative flex items-center justify-center bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '8px 8px'}}></div>
                
                {/* Scanning Laser */}
                <div className="absolute left-0 right-0 h-0.5 bg-accent-cyan shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-scan z-20"></div>
            
                {/* Center Core */}
                <div className="relative w-10 h-10 bg-slate-800 rounded-lg border border-brand-500 flex items-center justify-center z-10 shadow-[0_0_25px_rgba(139,92,246,0.4)]">
                     <div className="w-6 h-6 bg-brand-500 rounded animate-pulse"></div>
                </div>
                
                {/* Orbiting Particles */}
                <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-accent-cyan rounded-full shadow-[0_0_10px_currentColor] transform -translate-x-1/2 -translate-y-1/2 translate-y-[-24px]"></div>
                </div>
                <div className="absolute inset-0 animate-[spin_3s_linear_infinite_reverse]">
                    <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-brand-400 rounded-full shadow-[0_0_10px_currentColor] transform -translate-x-1/2 -translate-y-1/2 translate-y-[24px]"></div>
                </div>
            </div>
        )
    },
    {
        title: "4. Edit & Annotate",
        description: "Refine your result! You can add text labels directly onto the image or use the 'AI Modify' tool to change details.",
        visual: (
            <div className="w-24 h-24 relative bg-slate-800 rounded-xl border border-slate-600 p-2 overflow-hidden shadow-lg">
                <div className="w-full h-full bg-slate-700/50 rounded-lg border border-slate-600/50 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-600 rounded-full opacity-50"></div>
                    
                    {/* Popping Labels */}
                    <div className="absolute top-3 left-4 px-2 py-0.5 bg-brand-600 text-[8px] font-bold text-white rounded shadow-lg animate-pop origin-bottom-left">
                        Nucleus
                    </div>
                    
                    {/* Cursor Moving */}
                    <div className="absolute bottom-2 right-2 animate-[float_3s_ease-in-out_infinite_reverse]">
                         <svg className="w-5 h-5 text-accent-cyan drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M5.636 5.636a9 9 0 0112.728 0A9 9 0 0121 12a9 9 0 01-2.636 6.364M12 12a9 9 0 01-9-9m9 9a9 9 0 010-12.728m0 0a9 9 0 0112.728 12.728"/></svg>
                    </div>
                     <div className="absolute top-8 right-6 w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
            </div>
        )
    },
    {
        title: "5. Download",
        description: "Once satisfied, download your graphical abstract as a JPG or PDF file, ready to be included in your research paper.",
        visual: (
            <div className="w-24 h-24 relative flex items-center justify-center">
                {/* Floating File */}
                <div className="w-10 h-14 bg-slate-200 rounded text-slate-900 flex flex-col items-center justify-center text-[8px] font-bold shadow-xl absolute z-10 animate-float border-2 border-white">
                    <div className="w-full h-4 bg-brand-500 absolute top-0 rounded-t-sm"></div>
                    <span className="mt-2">PDF</span>
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white border-2 border-slate-900 shadow-md">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                    </div>
                </div>
                
                {/* Tray / Platform */}
                <div className="absolute bottom-2 w-16 h-1.5 bg-slate-600 rounded-full blur-[2px]"></div>
                
                {/* Sparkles */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-2 left-3 w-1 h-1 bg-yellow-400 rounded-full animate-[ping_1.5s_infinite]"></div>
                    <div className="absolute bottom-6 right-3 w-1 h-1 bg-accent-cyan rounded-full animate-[ping_2s_infinite_0.5s]"></div>
                </div>
            </div>
        )
    }
  ];

  // --- Handlers ---

  const handleGoogleLogin = () => {
    setIsLoadingAuth(true);
    setError(null);

    // Check if real Google Client ID is provided and script loaded
    if (GOOGLE_CLIENT_ID && window.google && window.google.accounts) {
        try {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile',
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.access_token) {
                        try {
                            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                            }).then(res => res.json());

                            setUser({
                                name: userInfo.name,
                                email: userInfo.email,
                                avatar: userInfo.picture
                            });
                            setCurrentStep(AppStep.DASHBOARD);
                        } catch (e) {
                            console.error("Failed to fetch user info", e);
                            setError("Failed to retrieve user information from Google.");
                        }
                    }
                    setIsLoadingAuth(false);
                },
                error_callback: (err: any) => {
                    console.error("Google Auth Error", err);
                    setError("Google Sign-In failed.");
                    setIsLoadingAuth(false);
                }
            });
            client.requestAccessToken();
        } catch (e) {
            console.error(e);
            setIsLoadingAuth(false);
            // Fallback to simulation
            simulateGoogleLoginRequest();
        }
    } else {
        // Simulation / Demo Mode for Google Button
        simulateGoogleLoginRequest();
    }
  };

  const simulateGoogleLoginRequest = () => {
    // Mimic the "Connecting..." delay before showing account chooser
    // This is ONLY for the Google button flow
    setTimeout(() => {
        setIsLoadingAuth(false);
        setShowGoogleModal(true);
    }, 1000); 
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAuth(true);
    setError(null);

    // Simulate standard auth API call
    setTimeout(() => {
        const userName = authFormData.name.trim() || (authFormData.email.split('@')[0] || "User");
        setUser({
            name: userName,
            email: authFormData.email || "user@example.com",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&color=fff`
        });
        setIsLoadingAuth(false);
        setCurrentStep(AppStep.DASHBOARD);
    }, 1500);
  };

  const handleMockAccountSelect = (account: typeof MOCK_ACCOUNTS[0]) => {
      setUser({
          name: account.name,
          email: account.email,
          avatar: account.avatar
      });
      setShowGoogleModal(false);
      setCurrentStep(AppStep.DASHBOARD);
  };

  const handlePromptSubmit = () => {
    if (!request.prompt.trim()) {
      setError("Please enter a description for your abstract.");
      return;
    }
    setError(null);
    setCurrentStep(AppStep.STYLE);
  };

  const handleStyleSelect = (style: ArtStyle) => {
    setRequest(prev => ({ ...prev, style }));
  };

  const handleGenerate = async (isRefining = false, customPrompt?: string, customBaseImage?: string) => {
    if (isRefining) {
        setCurrentStep(AppStep.GENERATING);
    } else {
        setCurrentStep(AppStep.GENERATING);
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      const promptToUse = customPrompt || request.prompt;
      const baseImageToUse = customBaseImage || request.baseImage;
      const styleToUse = request.style;

      const imageResult = await generateGraphicalAbstract(
        promptToUse,
        styleToUse,
        baseImageToUse
      );
      
      setGeneratedImage(imageResult);
      
      // Save to IndexedDB
      const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          image: imageResult,
          prompt: promptToUse,
          style: styleToUse,
          date: new Date()
      };
      
      try {
        await saveHistoryToDB(newHistoryItem);
        // Add to local state
        setHistory(prev => [newHistoryItem, ...prev]);
        setDbConnected(true);
      } catch (dbErr) {
        console.warn("Could not save to DB", dbErr);
        // Fallback to state-only history if DB fails
        setHistory(prev => [newHistoryItem, ...prev]);
      }

      setLabels([]);
      setRefineMode(false);
      setTextMode(false);
      setRefinePrompt('');
      setActiveLabelInput(null);

      setIsGenerating(false);
      setCurrentStep(AppStep.RESULT);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate image. Please try again.");
      setIsGenerating(false);
      if (isRefining) {
          setCurrentStep(AppStep.RESULT);
      } else {
          setCurrentStep(AppStep.STYLE);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRequest(prev => ({ ...prev, baseImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Editing Handlers ---

  const handleRefineSubmit = () => {
      if (!refinePrompt.trim() || !generatedImage) return;
      handleGenerate(true, refinePrompt, generatedImage);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggedLabelId !== null) return;
      if (!textMode || !imageContainerRef.current) return;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setActiveLabelInput({ x, y });
  };

  // --- Drag and Drop Handlers ---

  const handleLabelMouseDown = (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      e.preventDefault();
      
      const label = labels.find(l => l.id === id);
      if (!label || !imageContainerRef.current) return;

      setDraggedLabelId(id);
      dragOffsetRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          initialLabelX: label.x,
          initialLabelY: label.y
      };
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (draggedLabelId !== null && dragOffsetRef.current && imageContainerRef.current) {
          e.preventDefault();
          const rect = imageContainerRef.current.getBoundingClientRect();
          const deltaX = e.clientX - dragOffsetRef.current.startX;
          const deltaY = e.clientY - dragOffsetRef.current.startY;

          const deltaXPercent = (deltaX / rect.width) * 100;
          const deltaYPercent = (deltaY / rect.height) * 100;

          let newX = dragOffsetRef.current.initialLabelX + deltaXPercent;
          let newY = dragOffsetRef.current.initialLabelY + deltaYPercent;

          newX = Math.max(0, Math.min(100, newX));
          newY = Math.max(0, Math.min(100, newY));

          setLabels(prev => prev.map(l => 
              l.id === draggedLabelId ? { ...l, x: newX, y: newY } : l
          ));
      }
  };

  const handleContainerMouseUp = () => {
      setDraggedLabelId(null);
      dragOffsetRef.current = null;
  };

  const finalizeLabel = (text: string) => {
      if (activeLabelInput && text.trim()) {
          setLabels(prev => [...prev, {
              id: Date.now(),
              x: activeLabelInput.x,
              y: activeLabelInput.y,
              text: text.trim()
          }]);
      }
      setActiveLabelInput(null);
      setTextMode(false);
  };

  const handleDeleteLabel = (id: number) => {
      setLabels(prev => prev.filter(l => l.id !== id));
  };

  const getCompositedDataUrl = async (): Promise<string | null> => {
      if (!generatedImage) return null;

      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.crossOrigin = "anonymous";
          img.onload = () => {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;

              if (ctx) {
                  ctx.drawImage(img, 0, 0);

                  const fontSize = Math.max(16, Math.floor(canvas.height * 0.03));
                  ctx.font = `bold ${fontSize}px sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  
                  labels.forEach(label => {
                      const lx = (label.x / 100) * canvas.width;
                      const ly = (label.y / 100) * canvas.height;

                      ctx.strokeStyle = 'white';
                      ctx.lineWidth = fontSize / 4;
                      ctx.strokeText(label.text, lx, ly);

                      ctx.fillStyle = '#1f2937';
                      ctx.fillText(label.text, lx, ly);
                  });
              }
              resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          img.src = generatedImage;
      });
  };

  const downloadImage = async (format: 'jpg' | 'pdf') => {
    if (!generatedImage) return;
    
    const finalImage = labels.length > 0 
        ? await getCompositedDataUrl() 
        : generatedImage;

    if (!finalImage) return;

    if (format === 'jpg') {
        const link = document.createElement('a');
        link.href = finalImage;
        link.download = `graphical-abstract-${Date.now()}.jpg`;
        link.click();
    } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head><title>Graphical Abstract</title></head>
                    <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background-color:#000;">
                        <img src="${finalImage}" style="max-width:100%;max-height:100%;" />
                        <script>window.onload = function() { window.print(); }</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    }

    setTimeout(() => {
        setFeedbackSubmitted(false);
        setRating(0);
        setFeedback('');
        setCurrentStep(AppStep.FEEDBACK);
    }, 1000);
  };

  const resetApp = () => {
    setRequest({ prompt: '', style: ArtStyle.ILLUSTRATION, baseImage: null });
    setGeneratedImage(null);
    setLabels([]);
    setRefineMode(false);
    setTextMode(false);
    setActiveLabelInput(null);
    setRefinePrompt('');
    setFeedback('');
    setRating(0);
    setFeedbackSubmitted(false);
    setCurrentStep(AppStep.DASHBOARD);
  };

  const handleStartNew = () => {
    setRequest({ prompt: '', style: ArtStyle.ILLUSTRATION, baseImage: null });
    setGeneratedImage(null);
    setLabels([]);
    setCurrentStep(AppStep.PROMPT);
  };

  const nextSlide = () => {
      setCurrentTutorialSlide((prev) => (prev + 1) % TUTORIAL_SLIDES.length);
  };

  const prevSlide = () => {
      setCurrentTutorialSlide((prev) => (prev - 1 + TUTORIAL_SLIDES.length) % TUTORIAL_SLIDES.length);
  };

  // --- Render Steps ---

  const renderAuth = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] py-4 sm:py-10 relative animate-fade-in z-10">
      {/* Mock Google Account Modal Overlay */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 mx-4 border border-slate-700">
                <div className="p-6 pb-2 text-center">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-10 h-10 mx-auto mb-4" alt="Google" />
                    <h3 className="text-xl font-medium text-white">Choose an account</h3>
                    <p className="text-gray-400 text-sm mt-1">to continue to <span className="font-semibold text-brand-400">GraphiGen AI</span></p>
                </div>
                
                <div className="py-2">
                    {MOCK_ACCOUNTS.map(acc => (
                        <button key={acc.email} onClick={() => handleMockAccountSelect(acc)} className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 text-left group">
                            <img src={acc.avatar} alt={acc.name} className="w-10 h-10 rounded-full border border-slate-700" />
                            <div className="flex-1">
                                <div className="font-medium text-gray-200 text-sm group-hover:text-brand-400">{acc.name}</div>
                                <div className="text-gray-500 text-xs">{acc.email}</div>
                            </div>
                        </button>
                    ))}
                    <button className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-800 transition-colors text-left text-gray-400">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div className="font-medium text-sm">Use another account</div>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Main Split Screen Card */}
      <div className="flex w-full max-w-5xl bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden min-h-[600px] border border-white/10 ring-1 ring-white/5">
          {/* Left Side: Visual Hero */}
          <div className="hidden lg:flex w-1/2 bg-cover bg-center relative" style={{backgroundImage: 'url("https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop")'}}>
             <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-slate-900/80 to-blue-900/60 mix-blend-multiply"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
             <div className="relative z-10 p-12 flex flex-col justify-end h-full text-white">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h2 className="text-4xl font-bold mb-4 leading-tight">Visualize Science Instantly</h2>
                <p className="text-lg text-slate-300 font-light">Transform complex research data into stunning graphical abstracts with the power of Generative AI.</p>
             </div>
          </div>

          {/* Right Side: Auth Form */}
          <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center bg-slate-900/60">
            <div className="lg:hidden w-16 h-16 bg-slate-800 text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2 text-center lg:text-left">
                {isSignUp ? "Create an Account" : "Welcome"}
            </h1>
            <p className="text-gray-400 mb-8 text-center lg:text-left">
                {isSignUp 
                    ? "Join GraphiGen AI to create stunning scientific abstracts." 
                    : "Sign in to continue creating your graphical abstracts."}
            </p>
            
            <button 
            onClick={handleGoogleLogin}
            disabled={isLoadingAuth}
            className={`w-full flex items-center justify-center gap-3 border border-slate-700 text-gray-200 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 mb-6 hover:shadow-lg hover:border-slate-600 ${isLoadingAuth ? 'bg-slate-800 cursor-not-allowed opacity-80' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
            {isLoadingAuth && !authFormData.email ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting to Google...
                </>
            ) : (
                <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                    {isSignUp ? "Sign up with Google" : "Sign in with Google"}
                </>
            )}
            </button>

            {!GOOGLE_CLIENT_ID && !isLoadingAuth && (
                <p className="text-xs text-amber-500 bg-amber-900/30 border border-amber-900/50 p-2 rounded mb-4 text-center">
                    Running in demo mode. No configuration needed.
                </p>
            )}

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-slate-900 text-gray-500 font-medium">Or continue with email</span>
                </div>
            </div>

            <form className="space-y-4 mb-6" onSubmit={handleEmailAuth}>
                {isSignUp && (
                    <input 
                        type="text" 
                        placeholder="Full Name" 
                        value={authFormData.name}
                        onChange={e => setAuthFormData({...authFormData, name: e.target.value})}
                        className="w-full px-5 py-3.5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all bg-slate-800 focus:bg-slate-900 text-white placeholder-gray-500" 
                        required
                    />
                )}
                <input 
                    type="email" 
                    placeholder="Email address" 
                    value={authFormData.email}
                    onChange={e => setAuthFormData({...authFormData, email: e.target.value})}
                    className="w-full px-5 py-3.5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all bg-slate-800 focus:bg-slate-900 text-white placeholder-gray-500" 
                    required
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={authFormData.password}
                    onChange={e => setAuthFormData({...authFormData, password: e.target.value})}
                    className="w-full px-5 py-3.5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all bg-slate-800 focus:bg-slate-900 text-white placeholder-gray-500" 
                    required
                />
                <button 
                    type="submit" 
                    disabled={isLoadingAuth} 
                    className="w-full bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                >
                    {isLoadingAuth && authFormData.email ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
                </button>
            </form>

            <div className="text-sm text-gray-400 text-center">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
                <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="font-bold text-brand-400 hover:text-brand-300 ml-1 hover:underline focus:outline-none"
                >
                    {isSignUp ? "Log in" : "Sign up"}
                </button>
            </div>
          </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="max-w-7xl mx-auto w-full animate-fade-in py-8">
      {/* Header */}
      <div className="mb-6 px-2 flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-bold text-white mb-1">Welcome, {user?.name.split(' ')[0]}</h1>
            <p className="text-gray-400">Manage your scientific visualizations.</p>
        </div>
        {/* Connectivity Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
            <div className={`w-2.5 h-2.5 rounded-full ${dbConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{dbConnected ? 'Database Connected' : 'Offline Mode'}</span>
        </div>
      </div>

      {/* New Creation Rectangular Box */}
      <div className="mb-12">
        <button 
          onClick={handleStartNew}
          className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-slate-700 hover:border-brand-500 transition-all duration-500 p-8 text-left shadow-2xl hover:shadow-brand-500/20"
        >
           {/* Decorative Background Elements */}
           <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all group-hover:bg-brand-600/20"></div>
           
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-xs font-bold mb-4 border border-brand-500/20 backdrop-blur-md">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
                    Start Here
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2 tracking-tight group-hover:text-brand-100 transition-colors">Create New Abstract</h2>
                  <p className="text-gray-400 max-w-2xl text-base leading-relaxed group-hover:text-gray-300">
                    Transform your scientific data and concepts into publication-ready graphical abstracts using our advanced AI engine.
                  </p>
              </div>
              <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-white/10">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
              </div>
           </div>
        </button>
      </div>

      {/* Tutorial Slideshow Section */}
      <div className="mb-12 border-t border-slate-800 pt-8">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 px-2">
            <span className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-brand-400 border border-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            How it Works
        </h3>
        
        <div className="relative bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            {/* Slide Content */}
            <div className="p-8 md:p-12 min-h-[300px] flex flex-col items-center justify-center text-center transition-all duration-500">
                <div className="mb-6 transform scale-125">
                    {TUTORIAL_SLIDES[currentTutorialSlide].visual}
                </div>
                <h4 className="text-2xl md:text-3xl font-bold text-white mb-4">
                    {TUTORIAL_SLIDES[currentTutorialSlide].title}
                </h4>
                <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
                    {TUTORIAL_SLIDES[currentTutorialSlide].description}
                </p>
            </div>

            {/* Navigation Controls */}
            <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
                <button 
                    onClick={prevSlide}
                    className="p-3 rounded-full bg-slate-800/80 hover:bg-brand-600 text-white transition-all shadow-lg border border-slate-700 hover:border-brand-500 backdrop-blur-sm group"
                >
                    <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>
            <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                <button 
                    onClick={nextSlide}
                    className="p-3 rounded-full bg-slate-800/80 hover:bg-brand-600 text-white transition-all shadow-lg border border-slate-700 hover:border-brand-500 backdrop-blur-sm group"
                >
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Dots Indicator */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                {TUTORIAL_SLIDES.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentTutorialSlide(index)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentTutorialSlide ? 'bg-brand-500 w-8' : 'bg-slate-600 hover:bg-slate-500'}`}
                    />
                ))}
            </div>
        </div>
      </div>

      {/* History Grid */}
      <div className="px-2 border-t border-slate-800 pt-8">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Your Creations</h3>
            <span className="text-sm text-gray-500">{history.length} items</span>
        </div>
        
        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {history.map((item) => (
              <div key={item.id} className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-lg hover:shadow-brand-500/10 hover:border-brand-500/50 transition-all duration-300 h-80 flex flex-col">
                <div className="h-48 overflow-hidden relative">
                  <img src={item.image} alt="Generated Abstract" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-xs font-semibold px-2 py-1 rounded text-white border border-white/10">
                    {item.style}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-gray-300 text-sm line-clamp-3 mb-auto">{item.prompt}</p>
                  <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                    <span>{item.date.toLocaleDateString()}</span>
                    <span className="text-brand-400 font-medium">Completed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
             <div className="bg-slate-800/30 rounded-2xl p-12 text-center border-2 border-dashed border-slate-700 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-gray-400 text-lg">No previous creations found.</p>
                <p className="text-gray-500 text-sm mt-1">Your generated abstracts will appear here.</p>
            </div>
        )}
      </div>
    </div>
  );

  const renderPrompt = () => (
    <div className="max-w-3xl mx-auto w-full animate-fade-in py-10">
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-xl border border-white/10">
        <h2 className="text-3xl font-bold text-white mb-2">Describe your Abstract</h2>
        <p className="text-gray-400 mb-8">Tell us about your scientific concept, and we'll visualize it.</p>
        
        <div className="mb-8">
          <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
             Scientific Description
          </label>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-600 to-accent-cyan rounded-xl opacity-20 group-hover:opacity-60 transition duration-500 blur"></div>
            <textarea
                className="relative w-full p-5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[180px] resize-none text-white placeholder-gray-500 bg-slate-950 focus:bg-black transition-all shadow-inner text-lg leading-relaxed outline-none"
                placeholder="E.g., A breakdown of the photosynthesis process in a plant cell, showing chloroplasts absorbing light and producing glucose..."
                value={request.prompt}
                onChange={(e) => setRequest(prev => ({...prev, prompt: e.target.value}))}
            />
          </div>
        </div>

        <div className="mb-8">
            <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
                Reference Sketch (Optional)
            </label>
            <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors group">
                    {request.baseImage ? (
                        <div className="relative w-full h-full p-2 flex items-center justify-center">
                             <img src={request.baseImage} className="max-h-full max-w-full object-contain shadow-sm rounded" alt="Reference" />
                             <span className="absolute bottom-3 right-3 bg-slate-900/80 text-white text-xs px-2 py-1 rounded-md shadow-md font-medium border border-white/10">Change image</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <p className="text-sm text-gray-400"><span className="font-semibold text-brand-400">Click to upload</span> a sketch to refine</p>
                            <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or GIF</p>
                        </div>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
            </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
            </div>
        )}

        <button 
          onClick={handlePromptSubmit}
          className="w-full bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transform hover:-translate-y-0.5 text-lg flex items-center justify-center gap-2"
        >
          Next Step: Choose Style
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>
      </div>
    </div>
  );

  const renderStyle = () => (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/10">
        <div>
            <h2 className="text-3xl font-bold text-white">Select Visualization Style</h2>
            <p className="text-gray-400 mt-1">Choose the aesthetic that best fits your publication.</p>
        </div>
        <button onClick={() => handleGenerate()} className="w-full md:w-auto bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105 whitespace-nowrap flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          Generate Abstract
        </button>
      </div>

      {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl">
             {error}
          </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.values(ArtStyle).map((style) => (
          <StyleCard
            key={style}
            style={style}
            selected={request.style === style}
            onSelect={handleStyleSelect}
            description={STYLE_DESCRIPTIONS[style]}
            imageSrc={STYLE_IMAGES[style]}
          />
        ))}
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="relative w-40 h-40 mb-10">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 border-4 border-accent-cyan rounded-full border-t-transparent animate-spin animation-delay-2000 opacity-50"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                 <svg className="w-16 h-16 text-brand-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
        </div>
        <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-cyan mb-4">Generating Abstract...</h2>
        <p className="text-gray-400 text-lg bg-slate-900/70 backdrop-blur-sm px-6 py-3 rounded-full shadow-sm border border-white/10">
            Analysing prompt and rendering <span className="font-semibold text-brand-400">{request.style}</span>
        </p>
    </div>
  );

  const renderResult = () => (
    <div className="max-w-6xl mx-auto w-full animate-fade-in pb-12">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center px-6">
                <div className="flex gap-3 overflow-x-auto pb-1 md:pb-0">
                   {/* Refine Button */}
                   <button 
                        onClick={() => { setRefineMode(!refineMode); setTextMode(false); setActiveLabelInput(null); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${refineMode ? 'bg-brand-900/50 text-brand-300 border border-brand-500/50' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 text-gray-300'}`}
                   >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        AI Modify
                   </button>
                   
                   {/* Add Text Button */}
                   <button 
                        onClick={() => { setTextMode(!textMode); setRefineMode(false); setActiveLabelInput(null); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${textMode ? 'bg-brand-900/50 text-brand-300 ring-1 ring-brand-500' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 text-gray-300'}`}
                   >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        Add Text
                   </button>
                   
                   {/* Clear Labels */}
                   {labels.length > 0 && (
                       <button onClick={() => setLabels([])} className="text-xs text-red-400 hover:text-red-300 font-medium ml-2 px-2 hover:bg-red-900/30 rounded">Clear Text</button>
                   )}
                </div>
                <button onClick={() => setCurrentStep(AppStep.DASHBOARD)} className="text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    Back to Dashboard
                </button>
            </div>
            
            {/* AI Refine Input Bar */}
            {refineMode && (
                <div className="bg-slate-800 p-4 border-b border-slate-700 animate-slide-down">
                    <div className="flex gap-2 max-w-3xl mx-auto">
                        <input 
                            type="text" 
                            className="flex-1 px-4 py-3 border border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm bg-slate-900 text-white placeholder-gray-500"
                            placeholder="How should the AI modify this image? (e.g., Change background to blue, add more details)"
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefineSubmit()}
                        />
                        <button 
                            onClick={handleRefineSubmit}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95"
                        >
                            Generate
                        </button>
                    </div>
                </div>
            )}

            {/* Image Area */}
            <div className="relative bg-slate-950 w-full flex items-center justify-center overflow-hidden group min-h-[500px]">
                 {/* Container for click positioning */}
                <div 
                    ref={imageContainerRef}
                    className={`relative inline-block shadow-2xl ${textMode ? 'cursor-crosshair' : ''} ${draggedLabelId !== null ? 'cursor-grabbing' : ''}`}
                    onClick={handleImageClick}
                    onMouseMove={handleContainerMouseMove}
                    onMouseUp={handleContainerMouseUp}
                    onMouseLeave={handleContainerMouseUp}
                >
                    {generatedImage ? (
                        <img 
                            src={generatedImage} 
                            alt="Generated Abstract" 
                            className="max-w-full max-h-[70vh] object-contain block select-none rounded-lg" 
                            draggable={false}
                        />
                    ) : (
                        <div className="p-20 text-red-500">Image failed to load.</div>
                    )}

                    {/* Text Overlays */}
                    {labels.map((label) => (
                        <div 
                            key={label.id}
                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 group/label px-2 py-1 select-none transition-colors ${draggedLabelId === label.id ? 'z-50 cursor-grabbing bg-brand-900/90 border-brand-400 scale-110 shadow-xl' : 'cursor-grab bg-black/70 backdrop-blur-sm border-white/20 shadow-md'}`}
                            style={{ 
                                left: `${label.x}%`, 
                                top: `${label.y}%`,
                            }}
                            onClick={(e) => e.stopPropagation()} 
                            onMouseDown={(e) => handleLabelMouseDown(e, label.id)}
                        >
                            <span className={`text-white text-sm sm:text-base font-bold border rounded px-2 py-1 block ${draggedLabelId === label.id ? 'border-brand-300' : 'border-transparent'}`}>
                                {label.text}
                            </span>
                            <button 
                                onClick={() => handleDeleteLabel(label.id)}
                                onMouseDown={(e) => e.stopPropagation()} 
                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover/label:opacity-100 transition-all z-10 hover:bg-red-600 hover:scale-110 shadow-sm"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    
                    {/* Active Input Overlay */}
                    {activeLabelInput && (
                        <div 
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                            style={{ left: `${activeLabelInput.x}%`, top: `${activeLabelInput.y}%` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                autoFocus
                                type="text"
                                className="px-3 py-1.5 rounded-lg border-2 border-brand-500 shadow-2xl outline-none text-sm min-w-[150px] bg-slate-900 text-white font-medium"
                                placeholder="Enter label..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        finalizeLabel(e.currentTarget.value);
                                    } else if (e.key === 'Escape') {
                                        setActiveLabelInput(null);
                                    }
                                }}
                                onBlur={(e) => finalizeLabel(e.currentTarget.value)}
                            />
                        </div>
                    )}
                    
                    {textMode && !activeLabelInput && generatedImage && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-medium pointer-events-none border border-white/20">
                            Click anywhere on the image to add a label
                        </div>
                    )}
                </div>
            </div>

            <div className="p-8 bg-slate-900/80">
                <p className="text-center text-gray-400 mb-6 font-medium">Download your graphical abstract to continue to feedback.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
                    <button 
                        onClick={() => downloadImage('jpg')}
                        className="flex-1 max-w-xs flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-brand-500/25 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download JPG
                    </button>
                    <button 
                         onClick={() => downloadImage('pdf')}
                        className="flex-1 max-w-xs flex items-center justify-center gap-2 bg-transparent border-2 border-slate-600 text-gray-300 hover:bg-slate-800 hover:text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    </div>
  );

  const renderFeedbackPage = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in w-full max-w-2xl mx-auto py-10">
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 w-full text-center">
            {feedbackSubmitted ? (
                <div className="py-10 animate-fade-in">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Thank You!</h2>
                    <p className="text-gray-400 mb-8">Your feedback helps us improve the scientific accuracy of our models.</p>
                    <button 
                        onClick={resetApp}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-all border border-slate-600 hover:border-brand-500"
                    >
                        Create Another Abstract
                    </button>
                </div>
            ) : (
                <>
                    <h2 className="text-3xl font-bold text-white mb-2">Rate Your Experience</h2>
                    <p className="text-gray-400 mb-8">How accurate was the graphical abstract for your scientific needs?</p>
                    
                    <div className="flex justify-center gap-2 mb-8">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`p-2 transition-transform hover:scale-125 focus:outline-none ${rating >= star ? 'text-yellow-400' : 'text-slate-700 hover:text-yellow-400/50'}`}
                            >
                                <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                            </button>
                        ))}
                    </div>

                    <textarea 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500 outline-none resize-none mb-6 min-h-[120px]"
                        placeholder="Any suggestions for improvement? (Optional)"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                    ></textarea>

                    <button 
                        onClick={() => setFeedbackSubmitted(true)}
                        disabled={rating === 0}
                        className={`w-full font-bold py-4 px-6 rounded-xl transition-all shadow-lg ${rating > 0 ? 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white hover:scale-[1.02]' : 'bg-slate-800 text-gray-500 cursor-not-allowed'}`}
                    >
                        Submit Feedback
                    </button>
                    
                    <button 
                        onClick={resetApp}
                        className="mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
                    >
                        Skip & Return to Dashboard
                    </button>
                </>
            )}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-brand-500/30">
        {/* Navbar */}
        {currentStep !== AppStep.AUTH && (
            <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentStep(AppStep.DASHBOARD)}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <span className="font-bold text-lg text-white tracking-tight">GraphiGen <span className="text-brand-400">AI</span></span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                            <img src={user?.avatar} alt="Profile" className="w-6 h-6 rounded-full border border-slate-600" />
                            <span className="text-sm font-medium text-gray-300">{user?.name}</span>
                        </div>
                        <button 
                            onClick={() => { setUser(null); setCurrentStep(AppStep.AUTH); }}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Sign Out"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </nav>
        )}

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col items-center px-4 md:px-6 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-brand-900/20 blur-[100px] rounded-full pointer-events-none -z-10 mix-blend-screen"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

            {currentStep === AppStep.AUTH && renderAuth()}
            {currentStep === AppStep.DASHBOARD && renderDashboard()}
            {currentStep === AppStep.PROMPT && renderPrompt()}
            {currentStep === AppStep.STYLE && renderStyle()}
            {currentStep === AppStep.GENERATING && renderGenerating()}
            {currentStep === AppStep.RESULT && renderResult()}
            {currentStep === AppStep.FEEDBACK && renderFeedbackPage()}
        </main>
    </div>
  );
}