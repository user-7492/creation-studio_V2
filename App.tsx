import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Video, 
  User, 
  Activity, 
  Plus, 
  Settings2, 
  Zap,
  ChevronDown,
  X,
  Wand2,
  Loader2,
  Sparkles,
  Download,
  Share2,
  Play,
  Key,
  CheckCircle2,
  AlertCircle,
  Palette,
  Check
} from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { generateImageWithGemini, generateVideoWithGemini } from './services/geminiService';
import { AspectRatio, GeneratedItem, GenerationMode, MediaType, StylePreset } from './types';

// Icons for the style strip
const StyleIcon = ({ color, delay }: { color: string, delay: string }) => (
  <div 
    className={`w-8 h-8 rounded-full ${color} flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer animate-fade-in-up`}
    style={{ animationDelay: delay }}
  >
    <div className="w-3.5 h-3.5 bg-white/40 rounded-full backdrop-blur-sm"></div>
  </div>
);

// Predefined Styles
const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cinematic',
    name: '电影质感',
    promptSuffix: "cinematic lighting, 8k, highly detailed, photorealistic, movie scene, dramatic atmosphere, IMAX quality",
    previewUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'anime',
    name: '日系动漫',
    promptSuffix: "anime style, studio ghibli style, vibrant colors, detailed lines, cel shaded, makoto shinkai style",
    previewUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    promptSuffix: "cyberpunk, neon lights, futuristic city, sci-fi, dark atmosphere, glowing accents, chrome metal",
    previewUrl: "https://images.unsplash.com/photo-1515630278258-407f66498911?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: '3d-render',
    name: '3D 渲染',
    promptSuffix: "3d render, unreal engine 5, octane render, clay material, isometric, soft lighting, pixar style",
    previewUrl: "https://images.unsplash.com/photo-1633412802994-5c058f151b66?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'oil-painting',
    name: '印象油画',
    promptSuffix: "oil painting, van gogh style, thick brushstrokes, impressionism, artistic, canvas texture",
    previewUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'sketch',
    name: '素描手绘',
    promptSuffix: "pencil sketch, graphite, charcoal drawing, rough lines, artistic, monochrome, paper texture",
    previewUrl: "https://images.unsplash.com/photo-1596548438137-d51ea5c83ca5?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'polaroid',
    name: '复古胶片',
    promptSuffix: "polaroid photo, vintage camera, film grain, noise, vignette, nostalgic, 1990s aesthetic",
    previewUrl: "https://images.unsplash.com/photo-1517260739337-6799d239ce83?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 'fantasy',
    name: '奇幻仙境',
    promptSuffix: "fantasy world, ethereal, magical, dreamlike, glowing particles, mystic, concept art",
    previewUrl: "https://images.unsplash.com/photo-1462759353907-b2ea5ebd72e7?auto=format&fit=crop&w=300&q=80"
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GenerationMode>(GenerationMode.Image);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Style State
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);

  // API Key State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('user_gemini_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  // Determine if current mode is video-based
  const isVideoMode = activeTab !== GenerationMode.Image;

  // Filter ratios based on mode (Veo only supports 16:9 and 9:16)
  const availableRatios = isVideoMode 
    ? [AspectRatio.Wide, AspectRatio.Tall]
    : Object.values(AspectRatio);

  // Reset ratio if incompatible when switching modes
  useEffect(() => {
    if (isVideoMode && ![AspectRatio.Wide, AspectRatio.Tall].includes(aspectRatio)) {
        setAspectRatio(AspectRatio.Wide);
    }
  }, [isVideoMode, aspectRatio]);

  // Sync temp key when modal opens
  useEffect(() => {
    if (showKeyModal) {
      setTempKey(apiKey);
    }
  }, [showKeyModal, apiKey]);

  const handleSaveKey = () => {
    setApiKey(tempKey);
    localStorage.setItem('user_gemini_api_key', tempKey);
    setShowKeyModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        processFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !referenceImage) return;

    // API Key Selection for Video (Veo)
    if (isVideoMode && !apiKey) {
      try {
        const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio?.openSelectKey();
        }
      } catch (e) {
          console.warn("AISTUDIO key check failed or not available", e);
      }
    }

    setIsGenerating(true);
    try {
      let newItems: GeneratedItem[] = [];
      const timestamp = Date.now();
      const idBase = timestamp.toString();
      const currentKey = apiKey || undefined;

      // Construct final prompt with style
      let finalPrompt = prompt;
      if (selectedStyle && !isVideoMode) {
          finalPrompt = `${prompt}, ${selectedStyle.promptSuffix}`;
      }

      if (isVideoMode) {
         if (activeTab === GenerationMode.DigitalHuman) finalPrompt = `A photorealistic digital human character, ${prompt}`;
         if (activeTab === GenerationMode.Motion) finalPrompt = `Cinematic motion video, ${prompt}`;
         
         // Veo can also take style modifiers
         if (selectedStyle) {
             finalPrompt += `, ${selectedStyle.promptSuffix}`;
         }

         const videoUrl = await generateVideoWithGemini(finalPrompt, referenceImage, aspectRatio, currentKey);
         newItems.push({
             id: idBase,
             url: videoUrl,
             prompt: finalPrompt || (referenceImage ? 'Image to Video' : 'Video'),
             timestamp,
             type: 'video'
         });
      } else {
         const imageUrls = await generateImageWithGemini(finalPrompt, referenceImage, aspectRatio, currentKey);
         newItems = imageUrls.map((url, idx) => ({
             id: idBase + idx,
             url,
             prompt: prompt || 'Image to Image', // Keep display prompt simple
             timestamp,
             type: 'image'
         }));
      }

      setGeneratedItems(prev => [...newItems, ...prev]);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`生成失败: ${msg}\n请检查您的 API Key 是否正确或是否有权限使用该模型。`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getPlaceholder = () => {
      switch(activeTab) {
          case GenerationMode.Video: return "描述你想生成的视频画面... 例如：一只在霓虹灯下奔跑的赛博朋克猫";
          case GenerationMode.DigitalHuman: return "描述数字人的外貌特征和动作... 例如：一位穿着职业装的新闻主播正在播报";
          case GenerationMode.Motion: return "描述动作或上传参考图... 例如：海浪拍打礁石的慢动作特写";
          default: return "在此描述你想生成的画面... \n例如：赛博朋克风格的未来城市街道，霓虹灯闪烁，雨夜，电影质感，8k分辨率";
      }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col font-sans relative overflow-x-hidden text-slate-800">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      
      <Header onApiKeyClick={() => setShowKeyModal(true)} />

      {/* Style Selection Modal */}
      {showStyleModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStyleModal(false)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 relative z-10 animate-fade-in-up max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Palette size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">选择画面风格</h3>
                    </div>
                    <button onClick={() => setShowStyleModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {/* No Style Option */}
                        <div 
                            onClick={() => { setSelectedStyle(null); setShowStyleModal(false); }}
                            className={`
                                cursor-pointer rounded-xl border-2 transition-all p-4 flex flex-col items-center justify-center h-40 group
                                ${!selectedStyle 
                                    ? 'border-indigo-600 bg-indigo-50' 
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                }
                            `}>
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <X size={20} className="text-gray-500" />
                            </div>
                            <span className={`font-medium text-sm ${!selectedStyle ? 'text-indigo-700' : 'text-gray-600'}`}>不使用风格</span>
                        </div>

                        {STYLE_PRESETS.map((style) => (
                            <div 
                                key={style.id}
                                onClick={() => { setSelectedStyle(style); setShowStyleModal(false); }}
                                className={`
                                    relative cursor-pointer rounded-xl overflow-hidden aspect-[3/4] group transition-all duration-300 border-2
                                    ${selectedStyle?.id === style.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-transparent hover:border-indigo-300'}
                                `}>
                                <img src={style.previewUrl} alt={style.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                
                                {/* Selected Checkmark */}
                                {selectedStyle?.id === style.id && (
                                    <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1 shadow-lg">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                                
                                <div className="absolute bottom-3 left-3 text-white">
                                    <p className="font-bold text-sm tracking-wide shadow-black drop-shadow-md">{style.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowKeyModal(false)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative z-10 animate-fade-in-up">
                <button 
                    onClick={() => setShowKeyModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
                
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <Key size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">设置 API Key</h3>
                </div>
                
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                    请输入您的 Google Gemini API Key 以启用高级生成功能。Key 将仅存储在您的本地浏览器中。
                </p>
                
                <div className="mb-6">
                    <input 
                        type="password" 
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700 bg-gray-50 transition-all font-mono text-sm"
                    />
                    <div className="mt-2 flex items-start space-x-2 text-xs text-gray-400">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>如未填写，将尝试使用系统默认 Key (可能受限)。</span>
                    </div>
                </div>
                
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setShowKeyModal(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                        取消
                    </button>
                    <button 
                        onClick={handleSaveKey}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-2">
                        <CheckCircle2 size={16} />
                        <span>保存设置</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center pt-28 pb-24 px-4 sm:px-6 relative z-10 w-full max-w-5xl mx-auto">
        
        {/* Title Section */}
        <div className="text-center mb-10 w-full animate-fade-in-up">
          <h1 className="text-5xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 drop-shadow-sm">
            {isVideoMode ? '灵动视频，瞬间生成' : '创意无限，一触即发'}
          </h1>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 mt-4">
             <div className="flex space-x-[-8px]">
                <StyleIcon color="bg-gradient-to-tr from-purple-400 to-indigo-500" delay="0ms" />
                <StyleIcon color="bg-gradient-to-tr from-blue-400 to-cyan-500" delay="100ms" />
                <StyleIcon color="bg-gradient-to-tr from-pink-400 to-rose-500" delay="200ms" />
                <StyleIcon color="bg-gradient-to-tr from-amber-400 to-orange-500" delay="300ms" />
             </div>
             <span className="pl-2 font-medium">海量风格模型，<span onClick={() => setShowStyleModal(true)} className="text-indigo-600 cursor-pointer hover:underline decoration-2 underline-offset-2">自由探索</span></span>
          </div>
        </div>

        {/* Main Interface Box */}
        <div className="w-full relative z-10">
          
          {/* Tabs */}
          <div className="flex items-end pl-4 space-x-2 overflow-x-auto no-scrollbar">
            {[
                { id: GenerationMode.Video, icon: Video, label: '视频生成' },
                { id: GenerationMode.Image, icon: ImageIcon, label: '图片生成' },
                { id: GenerationMode.DigitalHuman, icon: User, label: '数字人' },
                { id: GenerationMode.Motion, icon: Activity, label: '动作模仿' }
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as GenerationMode)}
                    className={`
                        group flex items-center px-6 py-3 rounded-t-2xl text-sm font-semibold transition-all duration-200 relative whitespace-nowrap
                        ${activeTab === tab.id 
                            ? 'bg-white text-indigo-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-20 translate-y-[1px]' 
                            : 'bg-white/40 text-gray-500 hover:bg-white/60 hover:text-gray-700 z-10 backdrop-blur-sm'
                        }
                    `}>
                    <tab.icon size={18} className={`mr-2.5 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
                    {tab.label}
                    {activeTab === tab.id && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    )}
                </button>
            ))}
          </div>

          {/* Input Area Card */}
          <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-soft p-1.5 flex flex-col relative z-20 border border-white/60 ring-1 ring-black/5">
            <div className="bg-slate-50/50 rounded-[20px] p-5 flex flex-col min-h-[240px]">
                
                <div className="flex flex-1 gap-5">
                   {/* Upload Area */}
                   <div className="flex-shrink-0">
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            w-28 h-28 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center group relative overflow-hidden bg-white
                            ${isDragOver 
                                ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-inner' 
                                : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30'
                            }
                        `}>
                        {referenceImage ? (
                            <>
                              <img src={referenceImage} alt="Reference" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                 <span className="text-white text-xs font-medium border border-white/50 px-2 py-1 rounded-full">更换</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setReferenceImage(null); }}
                                className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors backdrop-blur-md">
                                <X size={10} strokeWidth={3} />
                              </button>
                            </>
                        ) : (
                            <>
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-2 group-hover:bg-indigo-100 group-hover:scale-110 transition-all">
                                    <Plus size={18} className="text-indigo-500" strokeWidth={3} />
                                </div>
                                <span className="text-xs font-medium text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    {isVideoMode ? '首帧/参考' : '参考图'}
                                </span>
                            </>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                   </div>

                   {/* Text Area */}
                   <div className="flex-1 relative">
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={getPlaceholder()}
                        className="w-full h-full resize-none outline-none bg-transparent text-gray-800 placeholder-gray-400 text-base leading-relaxed p-2 font-light focus:placeholder-gray-300 transition-colors"
                      />
                      {!prompt && !referenceImage && (
                          <div className="absolute bottom-2 right-2 flex gap-2">
                             <span className="text-xs text-gray-300 bg-white/50 px-2 py-1 rounded-md border border-gray-100">支持中英文</span>
                          </div>
                      )}
                      
                      {/* Selected Style Badge inside Text Area */}
                      {selectedStyle && (
                        <div className="absolute bottom-2 left-2 animate-fade-in-up">
                            <span className="inline-flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium border border-indigo-100">
                                <Palette size={12} className="fill-current" />
                                <span>风格: {selectedStyle.name}</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedStyle(null); }} 
                                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5 transition-colors">
                                    <X size={10} />
                                </button>
                            </span>
                        </div>
                      )}
                   </div>

                   {/* Right Style Selector - Updated to be functional */}
                   {!isVideoMode && (
                       <div className="w-36 flex-shrink-0 border-l border-gray-200/60 pl-5 flex flex-col justify-center hidden sm:flex">
                          <div 
                             onClick={() => setShowStyleModal(true)}
                             className="w-full aspect-[4/5] bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all relative overflow-hidden group ring-1 ring-black/5"
                          >
                             {selectedStyle ? (
                                <>
                                    <img src={selectedStyle.previewUrl} alt={selectedStyle.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                    <div className="absolute bottom-3 left-0 w-full text-center px-2">
                                        <span className="inline-block text-[10px] font-bold text-white/90 bg-indigo-600/80 px-2 py-1 rounded-full backdrop-blur-sm border border-white/10 shadow-sm">
                                            {selectedStyle.name}
                                        </span>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black/40 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                        <Settings2 size={12} />
                                    </div>
                                </>
                             ) : (
                                <>
                                     <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1633412802994-5c058f151b66?q=80&w=200&auto=format&fit=crop')] bg-cover bg-center opacity-70 group-hover:scale-110 transition-transform duration-700 grayscale group-hover:grayscale-0"></div>
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                                     
                                     <div className="absolute top-2 right-2 w-6 h-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white opacity-80 group-hover:opacity-100 group-hover:bg-indigo-500 group-hover:border-indigo-400 transition-all">
                                        <Plus size={14} strokeWidth={3} />
                                     </div>
                                     
                                     <div className="absolute bottom-3 left-0 w-full text-center px-2">
                                        <span className="inline-block text-[10px] font-bold text-white/90 bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm border border-white/10 group-hover:bg-indigo-600/80 transition-colors">
                                            选择风格
                                        </span>
                                     </div>
                                </>
                             )}
                          </div>
                       </div>
                   )}
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-4">
               <div className="flex items-center space-x-3">
                  
                  {/* Model Selector */}
                  <div className="relative group">
                    <button className="flex items-center space-x-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl transition-all shadow-sm border border-gray-200 hover:border-indigo-300 hover:text-indigo-600">
                        <div className={`w-5 h-5 rounded text-[10px] flex items-center justify-center text-white font-bold ${isVideoMode ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-indigo-500 to-fuchsia-500'}`}>
                            {isVideoMode ? 'V' : 'G'}
                        </div>
                        <span>{isVideoMode ? 'Veo 3.1 Fast' : 'Gemini 2.5 Flash'}</span>
                    </button>
                  </div>

                  {/* Ratio / Count Selector */}
                  <div className="relative group">
                    <button className="flex items-center space-x-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl transition-all shadow-sm border border-gray-200 hover:border-indigo-300 hover:text-indigo-600">
                        <Settings2 size={16} className="text-gray-500 group-hover:text-indigo-500" />
                        <span>{aspectRatio} {isVideoMode ? '' : '· 1张'}</span>
                        <ChevronDown size={14} className="text-gray-400 group-hover:text-indigo-400 transition-transform group-hover:rotate-180" />
                    </button>
                    {/* Ratio Dropdown */}
                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 hidden group-hover:block w-36 z-50 animate-fade-in-up origin-top-left">
                        {availableRatios.map((ratio) => (
                             <button 
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex justify-between items-center ${aspectRatio === ratio ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <span>{ratio}</span>
                                {aspectRatio === ratio && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                             </button>
                        ))}
                    </div>
                  </div>
               </div>

               {/* Generate Button */}
               <div className="relative flex-1 sm:flex-none flex justify-end">
                    {/* Discount Tag */}
                    <div className="absolute -top-3 right-0 bg-gradient-to-r from-amber-100 to-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200/50 shadow-sm z-10 animate-pulse-slow">
                        {isVideoMode ? '付费模型' : '积分 5 折'}
                    </div>
                   <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || (!prompt && !referenceImage)}
                        className={`
                            group flex items-center justify-center space-x-2 px-10 py-3 rounded-xl text-base font-semibold transition-all duration-300 relative overflow-hidden w-full sm:w-auto
                            ${(isGenerating || (!prompt && !referenceImage)) 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                                : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5'
                            }
                        `}>
                        {isGenerating ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            isVideoMode ? <Play size={20} className="fill-current" /> : <Sparkles size={20} className={`fill-current ${(prompt || referenceImage) ? 'animate-pulse' : ''}`} />
                        )}
                        <span>
                            {isGenerating ? (isVideoMode ? '视频生成中...' : '正在创作...') : (isVideoMode ? '生成视频' : '立即生成')}
                        </span>
                        
                        {/* Shimmer effect */}
                        {(!isGenerating && (prompt || referenceImage)) && (
                             <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20"></div>
                        )}
                   </button>
               </div>
            </div>
          </div>
        </div>

        {/* Generated Results Area */}
        {generatedItems.length > 0 && (
            <div className="w-full mt-16 mb-20 animate-fade-in-up">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <Wand2 size={20} className="mr-2.5 text-indigo-500" />
                        创作成果
                    </h2>
                    <span className="text-sm text-gray-400">{generatedItems.length} 个作品</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {generatedItems.map((item, idx) => (
                        <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-500 border border-gray-100 aspect-square" style={{ animationDelay: `${idx * 100}ms` }}>
                            {item.type === 'video' ? (
                                <video 
                                    src={item.url} 
                                    className="w-full h-full object-cover" 
                                    controls 
                                    autoPlay 
                                    muted 
                                    loop 
                                />
                            ) : (
                                <img src={item.url} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            )}
                            
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 pointer-events-none group-hover:pointer-events-auto">
                                <p className="text-white/90 text-xs line-clamp-2 mb-3 font-light leading-relaxed">{item.prompt}</p>
                                <div className="flex space-x-2">
                                    <a href={item.url} download={`generated-${item.id}.${item.type === 'video' ? 'mp4' : 'png'}`} className="flex-1 bg-white/20 backdrop-blur-md text-white text-xs font-medium py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center gap-1">
                                        <Download size={14} /> 下载
                                    </a>
                                    <button className="w-8 h-8 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors">
                                        <Share2 size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Video Badge */}
                            {item.type === 'video' && (
                                <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">
                                    <Play size={10} className="text-white fill-white" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

      </main>

      <Footer />
    </div>
  );
};

export default App;
