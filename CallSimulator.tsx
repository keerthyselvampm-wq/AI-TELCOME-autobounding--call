import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone, PhoneOff, Mic, MicOff, User, Bot, Clock, Wifi, WifiOff,
  Languages, MessageSquare, Keyboard, Volume2, Globe, ChevronDown
} from 'lucide-react'

type AgentType = 'internship' | 'missed_joining'
type Phase = 'idle' | 'connecting' | 'connected' | 'ended'
type InputMode = 'voice' | 'text'

interface TranscriptEntry {
  role: 'user' | 'ai'
  text: string
  timestamp: number
}

interface WsMessage {
  type: 'ai_response' | 'call_ended' | 'audio_end' | 'audio_fallback_trigger' | 'user_transcript'
  message?: string
  action?: string
  state?: string
  audio_url?: string | null
  collected_data?: Record<string, string>
  reason?: string
  duration?: number
  language?: string
  text?: string
}

const AGENTS: { value: AgentType; label: string; desc: string; labelTa: string }[] = [
  {
    value: 'internship',
    label: 'Internship Enquiries',
    desc: 'Domain info, registration, slot booking',
    labelTa: 'இன்டர்ன்ஷிப் விசாரணைகள்',
  },
  {
    value: 'missed_joining',
    label: 'Missed Joining Follow-up',
    desc: 'Collect reason, reschedule date & batch',
    labelTa: 'சேரத் தவறியவர்கள் பின்தொடர்தல்',
  },
]

const STATE_LABELS: Record<string, string> = {
  greeting: 'Greeting', collect_name: 'Collecting Name',
  collect_college: 'Collecting College', collect_domain: 'Collecting Domain',
  collect_joining_date: 'Collecting Joining Date', collect_duration: 'Collecting Duration',
  collect_batch: 'Collecting Batch', collect_contact: 'Collecting Contact',
  check_slots: 'Checking Slots', confirm: 'Confirming Registration',
  completed: 'Completed', cancelled: 'Cancelled',
  intro: 'Introduction', collect_reason: 'Collecting Reason',
  offer_reschedule: 'Offering Reschedule', collect_new_date: 'Collecting New Date',
  collect_new_batch: 'Collecting New Batch',
}

const STATE_LABELS_TA: Record<string, string> = {
  greeting: 'வரவேற்பு', collect_name: 'பெயர் சேகரிப்பு',
  collect_college: 'கல்லூரி சேகரிப்பு', collect_domain: 'துறை தேர்வு',
  collect_joining_date: 'சேரும் தேதி', collect_duration: 'கால அளவு',
  collect_batch: 'நேரம் தேர்வு', collect_contact: 'தொடர்பு எண்',
  check_slots: 'இடம் சரிபார்ப்பு', confirm: 'உறுதிப்படுத்தல்',
  completed: 'முடிந்தது', cancelled: 'ரத்து செய்யப்பட்டது',
  intro: 'அறிமுகம்', collect_reason: 'காரணம் சேகரிப்பு',
  offer_reschedule: 'மறு திட்டமிடல்', collect_new_date: 'புதிய தேதி',
  collect_new_batch: 'புதிய நேரம்',
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function CallSimulator() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [agentType, setAgentType] = useState<AgentType>('internship')
  const [language, setLanguage] = useState<'english' | 'tamil'>('english')
  const [inputMode, setInputMode] = useState<InputMode>('voice')
  const [textInput, setTextInput] = useState('')
  const [studentId, setStudentId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('student_id')
    return id ? Number(id) : null
  })
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentState, setCurrentState] = useState('')
  const [currentLanguage, setCurrentLanguage] = useState('')
  const [timer, setTimer] = useState(0)
  const [isMuted, setMuted] = useState(false)
  const [isAISpeaking, setAISpeaking] = useState(false)
  const [isUserSpeaking, setUserSpeaking] = useState(false)
  const [micStatus, setMicStatus] = useState('inactive')
  const [connStatus, setConnStatus] = useState('disconnected')
  const [collectedData, setCollectedData] = useState<Record<string, string>>({})
  const [callResult, setCallResult] = useState<{ reason: string; duration: number } | null>(null)
  const [error, setError] = useState('')
  const [showLangMenu, setShowLangMenu] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const langRef = useRef(language)
  langRef.current = language

  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted
  const isAISpeakingRef = useRef(isAISpeaking)
  isAISpeakingRef.current = isAISpeaking
  const inputModeRef = useRef(inputMode)
  inputModeRef.current = inputMode
  const currentLanguageRef = useRef(currentLanguage)
  currentLanguageRef.current = currentLanguage
  const timerSecondsRef = useRef(timer)
  timerSecondsRef.current = timer

  // Web Audio Capturer References
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)

  // Audio Streaming Accumulator References
  const audioChunksRef = useRef<ArrayBuffer[]>([])

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => [...prev, entry])
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    setTimer(0)
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
  }, [])

  const stopAudioCapture = useCallback(() => {
    if (processorNodeRef.current) {
      try { processorNodeRef.current.disconnect() } catch {}
      processorNodeRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch {}
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    setMicStatus('inactive')
    setUserSpeaking(false)
  }, [])

  const startAudioCapture = useCallback(async () => {
    if (isMutedRef.current || isAISpeakingRef.current || inputModeRef.current !== 'voice') return
    stopAudioCapture()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      mediaStreamRef.current = stream

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorNodeRef.current = processor

      processor.onaudioprocess = (e) => {
        if (isAISpeakingRef.current || isMutedRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        const pcmData = new Int16Array(inputData.length)
        let hasSpeech = false
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          if (Math.abs(s) > 0.02) {
            hasSpeech = true
          }
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcmData.buffer)
          setUserSpeaking(hasSpeech)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      setMicStatus('active')
    } catch (e: any) {
      console.warn("Mic access failed:", e)
      setError("Could not access microphone: " + e.message)
      setMicStatus('error')
    }
  }, [stopAudioCapture])

  // Initialize standard audio player with auto-cleanup
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.onended = () => {
      setAISpeaking(false)
      isAISpeakingRef.current = false
      if (phaseRef.current === 'connected' && inputModeRef.current === 'voice' && !isMutedRef.current) {
        setTimeout(() => {
          if (phaseRef.current === 'connected' && !isAISpeakingRef.current && !isMutedRef.current) {
            startAudioCapture()
          }
        }, 200)
      }
    }
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [startAudioCapture])

  const speakWithBrowser = useCallback((text: string, lang?: string) => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) { resolve(); return }
      setAISpeaking(true)
      isAISpeakingRef.current = true
      stopAudioCapture()

      try { window.speechSynthesis.cancel() } catch {}

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'tamil' ? 'ta-IN' : 'en-US'
      utterance.rate = lang === 'tamil' ? 0.85 : 1.0
      utterance.pitch = lang === 'tamil' ? 1.05 : 1.0

      // Prevent Chrome garbage collection bug where onend never fires for transient utterances
      if (!(window as any)._utterances) {
        (window as any)._utterances = []
      }
      (window as any)._utterances.push(utterance)
      
      const finish = () => {
        (window as any)._utterances = ((window as any)._utterances || []).filter((u: any) => u !== utterance)
        setAISpeaking(false)
        isAISpeakingRef.current = false
        if (
          phaseRef.current === 'connected' &&
          inputModeRef.current === 'voice' &&
          !isMutedRef.current
        ) {
          setTimeout(() => {
            if (
              phaseRef.current === 'connected' &&
              inputModeRef.current === 'voice' &&
              !isMutedRef.current &&
              !isAISpeakingRef.current
            ) {
              startAudioCapture()
            }
          }, 300)
        }
        resolve()
      }
      utterance.onend = finish
      utterance.onerror = finish
      speechSynthesis.speak(utterance)
    })
  }, [startAudioCapture, stopAudioCapture])

  const sendTextMessage = useCallback(() => {
    if (!textInput.trim() || !wsRef.current) return
    const text = textInput.trim()
    setTextInput('')
    addTranscript({ role: 'user', text, timestamp: Date.now() })
    wsRef.current.send(JSON.stringify({ type: 'user_text', text, language: langRef.current }))
  }, [textInput, addTranscript])

  const handleStartCall = useCallback(async () => {
    setError('')
    setPhase('connecting')
    setConnStatus('connecting')
    setTranscript([])
    setCurrentState('greeting')
    setCollectedData({})
    setCallResult(null)
    setTimer(0)

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/ws/call`
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        setConnStatus('connected')
        setPhase('connected')
        startTimer()
        audioChunksRef.current = []

        ws.send(JSON.stringify({
          type: 'start_call',
          agent_type: agentType,
          student_id: studentId,
          language: langRef.current,
        }))

        if (inputMode === 'voice') startAudioCapture()
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary audio packet received - accumulate chunks
          if (!isAISpeakingRef.current) {
            setAISpeaking(true)
            isAISpeakingRef.current = true
            stopAudioCapture()
            audioChunksRef.current = []
          }
          audioChunksRef.current.push(event.data)
        } else {
          // Text event received
          const msg = JSON.parse(event.data)
          if (msg.type === 'ai_response') {
            const text = msg.message || ''
            const lang = msg.language || 'english'
            addTranscript({ role: 'ai', text, timestamp: Date.now() })
            if (msg.state) setCurrentState(msg.state)
            if (msg.collected_data) setCollectedData(msg.collected_data)
            setCurrentLanguage(lang)

            if (msg.action === 'loading') {
              setAISpeaking(true)
            } else if (msg.action === 'completed' || msg.action === 'cancelled') {
              setCallResult({ reason: msg.action, duration: timerSecondsRef.current })
            }
          } else if (msg.type === 'user_transcript') {
            // Live speech transcript finalized by backend Deepgram
            addTranscript({ role: 'user', text: msg.text, timestamp: Date.now() })
            setUserSpeaking(false)
          } else if (msg.type === 'audio_end') {
            // Stream complete - combine and play the accumulated chunks
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' })
              const url = URL.createObjectURL(blob)
              if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.src = url
                audioRef.current.play().catch(err => {
                  console.warn("Playout start failed:", err)
                  setAISpeaking(false)
                  isAISpeakingRef.current = false
                  if (phaseRef.current === 'connected' && inputModeRef.current === 'voice' && !isMutedRef.current) {
                    startAudioCapture()
                  }
                })
              }
            } else {
              setAISpeaking(false)
              isAISpeakingRef.current = false
              if (phaseRef.current === 'connected' && inputModeRef.current === 'voice' && !isMutedRef.current) {
                startAudioCapture()
              }
            }
          } else if (msg.type === 'audio_fallback_trigger') {
            // TTS API failed or key missing, use client side speech synthesis
            await speakWithBrowser(msg.text || '', currentLanguageRef.current)
          } else if (msg.type === 'call_ended') {
            setCallResult({ reason: msg.reason || 'ended', duration: msg.duration || timerSecondsRef.current })
          }
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection failed. Is the backend running?')
        setConnStatus('error')
        setPhase('idle')
      }

      ws.onclose = () => {
        setConnStatus('disconnected')
        if (phase === 'connected') setPhase('ended')
      }
    } catch (e: any) {
      setError(`Failed to connect: ${e.message}`)
      setPhase('idle')
    }
  }, [agentType, startTimer, startAudioCapture, stopAudioCapture, addTranscript, speakWithBrowser, timer, studentId, inputMode])

  const handleEndCall = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_call' }))
    }
    stopAudioCapture()
    stopTimer()
    setPhase('ended')
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    window.speechSynthesis?.cancel()
    setAISpeaking(false)
    setConnStatus('disconnected')
  }, [stopAudioCapture, stopTimer])

  const handleToggleMute = useCallback(() => {
    setMuted(m => {
      const nextMute = !m
      if (nextMute) {
        stopAudioCapture()
      } else {
        startAudioCapture()
      }
      return nextMute
    })
  }, [startAudioCapture, stopAudioCapture])

  const handleNewCall = useCallback(() => {
    setPhase('idle')
    setConnStatus('disconnected')
    setTranscript([]); setCurrentState(''); setCollectedData({})
    setCallResult(null); setTimer(0); setMicStatus('inactive')
    setAISpeaking(false); setUserSpeaking(false); setError('')
    wsRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      stopAudioCapture()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
      window.speechSynthesis?.cancel()
      if (wsRef.current) wsRef.current.close()
    }
  }, [stopTimer, stopAudioCapture])

  if (phase === 'idle') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {language === 'tamil' ? 'AI அழைப்பு உருவகப்படுத்தி' : 'AI Call Simulator'}
          </h1>
          <p className="text-sm text-gray-500">
            {language === 'tamil'
              ? 'தொலைபேசி அழைப்பு இல்லாமல் AI உரையாடலை சோதிக்கவும்'
              : 'Test the AI conversation without making a real phone call.'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {language === 'tamil' ? 'அமைப்புகள்' : 'Settings'}
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Globe className="w-4 h-4" />
                {language === 'tamil' ? 'தமிழ்' : 'English'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 animate-scale-in">
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${language === 'english' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                      onClick={() => { setLanguage('english'); setShowLangMenu(false) }}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${language === 'tamil' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                      onClick={() => { setLanguage('tamil'); setShowLangMenu(false) }}
                    >
                      🇮🇳 தமிழ்
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {AGENTS.map(a => (
              <label
                key={a.value}
                className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  agentType === a.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="agent"
                  value={a.value}
                  checked={agentType === a.value}
                  onChange={() => setAgentType(a.value)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {language === 'tamil' ? a.labelTa : a.label}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{a.desc}</p>
                  </div>
                  <div className={`p-3 rounded-full transition-all ${
                    agentType === a.value ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Phone className="w-5 h-5" />
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-voice"
                checked={inputMode === 'voice'}
                onChange={() => setInputMode('voice')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mode-voice" className="text-sm font-medium text-gray-700 flex items-center gap-1.5 flex-nowrap">
                <Mic className="w-4 h-4" /> Voice
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-text"
                checked={inputMode === 'text'}
                onChange={() => setInputMode('text')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mode-text" className="text-sm font-medium text-gray-700 flex items-center gap-1.5 flex-nowrap">
                <Keyboard className="w-4 h-4" /> Text
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleStartCall}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            {language === 'tamil' ? 'AI அழைப்பைத் தொடங்கு' : 'Start AI Call'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {language === 'tamil'
              ? 'மைக்ரோஃபோன் அனுமதி தேவை. Chrome அல்லது Edge இல் சிறப்பாக செயல்படும்.'
              : 'Requires microphone permission. Best in Chrome or Edge.'}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'ended' || (phase === 'connected' && callResult)) {
    const isTa = currentLanguage === 'tamil'
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
            <PhoneOff className="w-10 h-10 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isTa ? 'அழைப்பு முடிந்தது' : 'Call Ended'}
          </h2>
          <p className="text-gray-500">
            {isTa ? 'கால அளவு: ' : 'Duration: '}{formatTime(callResult?.duration || timer)}
          </p>
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
            callResult?.reason === 'completed' ? 'bg-green-100 text-green-700' :
            callResult?.reason === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {callResult?.reason === 'completed' ? (isTa ? 'வெற்றிகரமாக முடிந்தது' : 'Completed') :
             callResult?.reason === 'cancelled' ? (isTa ? 'ரத்து செய்யப்பட்டது' : 'Cancelled') :
             isTa ? 'அழைப்பு முடிந்தது' : 'Call Ended'}
          </div>

          {Object.keys(collectedData).length > 0 && (
            <div className="text-left p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {isTa ? 'சேகரிக்கப்பட்ட தகவல்கள்' : 'Collected Information'}
              </p>
              <div className="space-y-2">
                {Object.entries(collectedData).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-gray-900">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 max-h-48 overflow-y-auto text-left">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {isTa ? 'உரையாடல்' : 'Transcript'}
            </p>
            <div className="space-y-2">
              {transcript.map((entry, i) => (
                <p key={i} className={`text-sm ${entry.role === 'ai' ? 'text-blue-700' : 'text-gray-600'}`}>
                  <span className="font-semibold">{entry.role === 'ai' ? 'AI: ' : (isTa ? 'நீ: ' : 'You: ')}</span>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>

          <button onClick={handleNewCall} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            {isTa ? 'புதிய அழைப்பைத் தொடங்கு' : 'Start New Call'}
          </button>
        </div>
      </div>
    )
  }

  const isTa = currentLanguage === 'tamil'
  const stateLabels = isTa ? STATE_LABELS_TA : STATE_LABELS

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              {connStatus === 'connected' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <Wifi className="w-3 h-3 mr-1" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  <WifiOff className="w-3 h-3 mr-1" /> {connStatus}
                </span>
              )}
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 font-mono">
              <Clock className="w-4 h-4" /> {formatTime(timer)}
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 text-sm col-auto whitespace-nowrap">
              <Mic className={`w-4 h-4 ${micStatus === 'active' ? 'text-green-500' : 'text-gray-400'}`} />
              {micStatus === 'active' ? (isTa ? 'ஒலிவாங்கி இயக்கத்தில்' : 'Mic On') : (isTa ? 'ஒலிவாங்கி முடக்கம்' : 'Mic Off')}
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-gray-400" />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                currentLanguage === 'tamil' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {currentLanguage === 'tamil' ? 'தமிழ்' : 'EN'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {currentState && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {stateLabels[currentState] || currentState}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {agentType === 'missed_joining' ? (isTa ? 'சேரத் தவறியவர்கள்' : 'Missed Joining') : (isTa ? 'இன்டர்ன்ஷிப்' : 'Internship')}
            </span>
          </div>

          <div className="flex items-center justify-center gap-8 sm:gap-16 py-6">
            <div className="text-center">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all mx-auto ${
                isUserSpeaking ? 'bg-green-100 ring-4 ring-green-400 shadow-lg shadow-green-200' : 'bg-gray-100 ring-2 ring-gray-200'
              }`}>
                <User className={`w-10 h-10 sm:w-12 sm:h-12 ${isUserSpeaking ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-3">{isTa ? 'நீங்கள்' : 'You'}</p>
              {isUserSpeaking && <p className="text-xs text-green-600 animate-pulse mt-1">{isTa ? 'பேசுகிறீர்கள்...' : 'Speaking...'}</p>}
            </div>

            <div className="text-gray-300 text-3xl font-light animate-pulse-slow">→</div>

            <div className="text-center">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all mx-auto ${
                isAISpeaking ? 'bg-blue-100 ring-4 ring-blue-400 shadow-lg shadow-blue-200' : 'bg-gray-100 ring-2 ring-gray-200'
              }`}>
                <Bot className={`w-10 h-10 sm:w-12 sm:h-12 ${isAISpeaking ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-3">VDart AI</p>
              {isAISpeaking && <p className="text-xs text-blue-600 animate-pulse mt-1">{isTa ? 'பேசுகிறது...' : 'Speaking...'}</p>}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {isTa ? 'நேரடி உரையாடல்' : 'Live Transcript'}
            </p>
            <div className="space-y-2">
              {transcript.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {isTa ? 'உரையாடல் தொடங்க காத்திருக்கிறது...' : 'Waiting for conversation...'}
                </p>
              )}
              {transcript.map((entry, i) => (
                <div key={i} className={`p-2.5 rounded-lg ${
                  entry.role === 'ai' ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">
                    {entry.role === 'ai' ? 'VDart AI' : (isTa ? 'நீங்கள்' : 'You')}
                  </p>
                  <p className={`text-sm ${entry.role === 'ai' ? 'text-blue-800' : 'text-gray-800'}`}>
                    {entry.text}
                  </p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {inputMode === 'text' && phase === 'connected' && (
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isTa ? 'உங்கள் செய்தியை இங்கே தட்டச்சு செய்யவும்...' : 'Type your message here...'}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendTextMessage()}
              />
              <button onClick={sendTextMessage} disabled={!textInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {isTa ? 'அனுப்பு' : 'Send'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            {inputMode === 'voice' && (
              <button
                onClick={handleToggleMute}
                className={`p-4 rounded-full transition-all shadow-lg ${
                  isMuted
                    ? 'bg-red-100 text-red-600 hover:bg-red-200 shadow-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isMuted ? (isTa ? 'ஒலிவாங்கியை இயக்கு' : 'Unmute') : (isTa ? 'ஒலிவாங்கியை முடக்கு' : 'Mute')}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-200 hover:shadow-xl hover:shadow-red-300"
              title={isTa ? 'அழைப்பை முடி' : 'End Call'}
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
