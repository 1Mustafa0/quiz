import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Music, CloudRain, Wind, Upload, X, Play, Pause, Headphones, Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

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
    name: 'rain', 
    url: 'https://www.orangefreesounds.com/wp-content/uploads/2018/06/The-sound-of-rain.mp3', 
    icon: CloudRain 
  },
  { 
    id: 'nature', 
    name: 'nature', 
    url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Birds_forest.ogg', 
    icon: Wind 
  },
];

const FocusMusicPlayer: React.FC = () => {
  const { direction, language, t } = useLanguage();
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
      name: language === 'ar' ? `سورة ${name}` : `Surah ${index + 1} - ${name}`,
      url: `https://server8.mp3quran.net/afs/${(index + 1).toString().padStart(3, '0')}.mp3`,
      icon: Headphones
    })).filter(s => s.name.includes(surahSearch));
  }, [language, surahSearch]);

  const getTrackDisplayName = (track: SoundTrack) => {
    if (track.id === 'rain') return t('focus.rain');
    if (track.id === 'nature') return t('focus.nature');
    return track.name;
  };

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
            setError(t('focus.playError'));
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
              setError(t('focus.loadError'));
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
        title={t('focus.tooltip')}
      >
        <Headphones className={`w-6 h-6 ${isPlaying ? 'animate-bounce' : ''}`} />
        <span className="absolute right-16 bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {t('focus.tooltip')}
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
              className="fixed bottom-24 right-4 z-50 flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-80 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:right-6 dark:border-slate-700 dark:bg-slate-900"
              dir={direction}
            >
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-grow">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                  <Headphones className="w-5 h-5 ml-2 text-indigo-600 dark:text-indigo-400" />
                  {t('focus.title')}
                </h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center dark:bg-red-950/40 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 ml-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Current Track Info */}
              {currentTrack && (
                <div className="bg-indigo-600 rounded-2xl p-4 text-white space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <currentTrack.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <p className="text-xs text-indigo-100 uppercase font-bold tracking-wider">{t('focus.nowPlaying')}</p>
                      <p className="font-medium truncate" dir="auto">{getTrackDisplayName(currentTrack)}</p>
                    </div>
                    <button 
                      onClick={togglePlay}
                      className="w-10 h-10 bg-white text-indigo-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3">
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
              <div className="space-y-2 max-h-80 overflow-y-auto pl-1 custom-scrollbar">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 dark:text-slate-400">{t('focus.quietSounds')}</p>
                {DEFAULT_TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => selectTrack(track)}
                    className={`w-full flex items-center p-3 rounded-xl transition-all ${
                      currentTrack?.id === track.id 
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' 
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <track.icon className={`w-5 h-5 ml-3 ${currentTrack?.id === track.id ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
                    <span className="text-sm font-medium">{track.id === 'rain' ? t('focus.rain') : t('focus.nature')}</span>
                  </button>
                ))}

                {/* Quran Section */}
                <div className="mt-4">
                  <button 
                    onClick={() => setShowSurahs(!showSurahs)}
                    className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors dark:text-slate-400 dark:hover:text-indigo-300"
                  >
                    <span>{t('focus.quran')}</span>
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
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder={t('focus.searchSurah')} 
                            value={surahSearch}
                            onChange={(e) => setSurahSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {filteredSurahs.map((surah) => (
                            <button
                              key={surah.id}
                              onClick={() => selectTrack(surah)}
                              className={`w-full flex items-center p-2 rounded-lg transition-all text-right ${
                                currentTrack?.id === surah.id 
                                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' 
                                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Headphones className={`w-4 h-4 ml-3 ${currentTrack?.id === surah.id ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
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
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mt-4 dark:text-slate-400">{t('focus.uploaded')}</p>
                    {customTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => selectTrack(track)}
                        className={`w-full flex items-center p-3 rounded-xl transition-all ${
                          currentTrack?.id === track.id 
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' 
                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Music className={`w-5 h-5 ml-3 ${currentTrack?.id === track.id ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
                        <span className="text-sm font-medium truncate" dir="auto">{track.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Upload Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all group dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
              >
                <Upload className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold">{t('focus.upload')}</span>
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

      <audio ref={audioRef} loop />
    </>
  );
};

export default FocusMusicPlayer;
