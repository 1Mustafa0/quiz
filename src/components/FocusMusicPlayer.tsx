import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Music, CloudRain, Wind, Upload, X, Play, Pause, Headphones, Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SoundTrack {
  id: string;
  name: string;
  url: string;
  icon: React.ElementType;
  isCustom?: boolean;
}

const SURAH_NAMES = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس"
];

const DEFAULT_TRACKS: SoundTrack[] = [
  { 
    id: 'rain', 
    name: 'صوت المطر', 
    url: 'https://www.soundjay.com/nature/rain-07.mp3', 
    icon: CloudRain 
  },
  { 
    id: 'nature', 
    name: 'أصوات الطبيعة', 
    url: 'https://www.soundjay.com/nature/forest-birds-01.mp3', 
    icon: Wind 
  },
];

const FocusMusicPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SoundTrack | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [customTracks, setCustomTracks] = useState<SoundTrack[]>([]);
  const [surahSearch, setSurahSearch] = useState('');
  const [showSurahs, setShowSurahs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMounted = useRef(true);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const filteredSurahs = useMemo(() => {
    return SURAH_NAMES.map((name, index) => ({
      id: `quran-${index + 1}`,
      name: `سورة ${name}`,
      url: `https://server8.mp3quran.net/afs/${(index + 1).toString().padStart(3, '0')}.mp3`,
      icon: Headphones
    })).filter(s => s.name.includes(surahSearch));
  }, [surahSearch]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Component mount/unmount tracking
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
    };
  }, []);

  // Cleanup custom track URLs when they change or on unmount
  useEffect(() => {
    const tracksToCleanup = [...customTracks];
    return () => {
      tracksToCleanup.forEach(track => {
        if (track.isCustom && track.url.startsWith('blob:')) {
          URL.revokeObjectURL(track.url);
        }
      });
    };
  }, [customTracks]);

  const togglePlay = async () => {
    if (!currentTrack || !audioRef.current) return;
    setError(null);
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        playPromiseRef.current = audioRef.current.play();
        await playPromiseRef.current;
        if (isMounted.current) {
          setIsPlaying(true);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Playback failed:", err);
          if (isMounted.current) {
            setError("فشل تشغيل الملف الصوتي");
            setIsPlaying(false);
          }
        }
      }
    }
  };

  const selectTrack = async (track: SoundTrack) => {
    setError(null);
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      // If there's a pending play promise, we should probably wait or handle it
      // But setting src will abort it anyway, which we handle in the catch block
      
      setCurrentTrack(track);
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.load(); // Force reload for new source
        try {
          playPromiseRef.current = audioRef.current.play();
          await playPromiseRef.current;
          if (isMounted.current) {
            setIsPlaying(true);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error("Audio playback failed:", err);
            if (isMounted.current) {
              setError("فشل تحميل أو تشغيل الملف الصوتي");
              setIsPlaying(false);
            }
          }
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newTrack: SoundTrack = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: url,
        icon: Music,
        isCustom: true
      };
      setCustomTracks(prev => [...prev, newTrack]);
      selectTrack(newTrack);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
        title="وضع التركيز"
      >
        <Headphones className={`w-6 h-6 ${isPlaying ? 'animate-bounce' : ''}`} />
        <span className="absolute right-16 bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          وضع التركيز 🎧
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              key="focus-player"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 right-6 w-80 max-h-[70vh] bg-white/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Headphones className="w-5 h-5 mr-2 text-indigo-600" />
                  صوتياتي
                </h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Current Track Info */}
              {currentTrack && (
                <div className="bg-indigo-600 rounded-2xl p-4 text-white space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <currentTrack.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <p className="text-xs text-indigo-100 uppercase font-bold tracking-wider">جاري التشغيل</p>
                      <p className="font-medium truncate">{currentTrack.name}</p>
                    </div>
                    <button 
                      onClick={togglePlay}
                      className="w-10 h-10 bg-white text-indigo-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <VolumeX className="w-4 h-4 text-indigo-200" />
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="flex-grow h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <Volume2 className="w-4 h-4 text-indigo-200" />
                  </div>
                </div>
              )}

              {/* Track List */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">أصوات هادئة</p>
                {DEFAULT_TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => selectTrack(track)}
                    className={`w-full flex items-center p-3 rounded-xl transition-all ${
                      currentTrack?.id === track.id 
                        ? 'bg-indigo-50 text-indigo-600' 
                        : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <track.icon className={`w-5 h-5 mr-3 ${currentTrack?.id === track.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">{track.name}</span>
                  </button>
                ))}

                {/* Quran Section */}
                <div className="mt-4">
                  <button 
                    onClick={() => setShowSurahs(!showSurahs)}
                    className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    <span>القرآن الكريم (114 سورة)</span>
                    {showSurahs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <AnimatePresence>
                    {showSurahs && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-2 mt-2"
                      >
                        <div className="relative px-2">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="ابحث عن سورة..." 
                            value={surahSearch}
                            onChange={(e) => setSurahSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {filteredSurahs.map((surah) => (
                            <button
                              key={surah.id}
                              onClick={() => selectTrack(surah)}
                              className={`w-full flex items-center p-2 rounded-lg transition-all text-right ${
                                currentTrack?.id === surah.id 
                                  ? 'bg-indigo-50 text-indigo-600' 
                                  : 'hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              <Headphones className={`w-4 h-4 ml-3 ${currentTrack?.id === surah.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                              <span className="text-xs font-medium flex-grow">{surah.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {customTracks.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mt-4">ملفاتك المرفوعة</p>
                    {customTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => selectTrack(track)}
                        className={`w-full flex items-center p-3 rounded-xl transition-all ${
                          currentTrack?.id === track.id 
                            ? 'bg-indigo-50 text-indigo-600' 
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <Music className={`w-5 h-5 mr-3 ${currentTrack?.id === track.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium truncate">{track.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Upload Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-all group"
              >
                <Upload className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold">ارفع ملف صوتي خاص بك</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="audio/*" 
                  className="hidden" 
                />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

      <audio ref={audioRef} loop crossOrigin="anonymous" />
    </>
  );
};

export default FocusMusicPlayer;
