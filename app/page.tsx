'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import useSWR from 'swr'
import { Drink, User, OrderWithDetails, Session, Place } from '@/lib/types'
import { DrinkCard } from '@/components/drink-card'
import { OrderBoard } from '@/components/order-board'
import { AdminPanel } from '@/components/admin-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Coffee, Grid3x2 as Grid3X3, Settings, ChevronLeft, ChevronRight, DollarSign, Users, Calendar, Bell, X, Printer, CircleCheck as CheckCircle2, LogOut, Eye, EyeOff, Loader2, Sparkles, ShieldCheck, ClipboardList, MapPin, Archive, Lock, Clock, Trash2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { ReceiptModal } from '@/components/receipt-modal'
import { CashierDashboard } from '@/components/cashier-dashboard'
import Image from 'next/image'

// ↑ Bump this version every time you deploy a new update
const APP_VERSION = '1.8'

const apiFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

interface AdminMessage {
  id: string
  title: string
  message: string
  created_at: string
}

type TabType = 'menu' | 'board' | 'admin'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [currentPlace, setCurrentPlace] = useState<Place | null>(null)
  const [placeCode, setPlaceCode] = useState('')
  const [placeLookupLoading, setPlaceLookupLoading] = useState(false)
  const [placeLookupError, setPlaceLookupError] = useState('')
  const [showPlacesPicker, setShowPlacesPicker] = useState(false)
  const [allActivePlaces, setAllActivePlaces] = useState<Place[]>([])
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [isDevAdmin, setIsDevAdmin] = useState(false)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [guestName, setGuestName] = useState('')
  const [loginError, setLoginError] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<TabType>('menu')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [devAdminName, setDevAdminName] = useState('')
  const [showDevWelcome, setShowDevWelcome] = useState(false)
  const [showPlaceAdminWelcome, setShowPlaceAdminWelcome] = useState(false)
  const [placeAdminWelcomeName, setPlaceAdminWelcomeName] = useState('')
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false)
  const [isCreatingNewSession, setIsCreatingNewSession] = useState(false)
  const [savedDevName, setSavedDevName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showPlaceAdminConfirm, setShowPlaceAdminConfirm] = useState(false)
  const [showPlaceAdminLanding, setShowPlaceAdminLanding] = useState(false)
  const [placeAdminConfirmName, setPlaceAdminConfirmName] = useState('')
  const [placeAdminConfirmPwd, setPlaceAdminConfirmPwd] = useState('')
  const [placeAdminConfirmError, setPlaceAdminConfirmError] = useState('')
  const [isVerifyingPlaceAdmin, setIsVerifyingPlaceAdmin] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dateOrders, setDateOrders] = useState<OrderWithDetails[] | null>(null)
  const [isLoadingDateOrders, setIsLoadingDateOrders] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeName, setWelcomeName] = useState('')
  const [showMessages, setShowMessages] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [cartNotes, setCartNotes] = useState<Record<string, string>>({})
  const [showTableModal, setShowTableModal] = useState(false)
  const [pendingTableNumber, setPendingTableNumber] = useState('')
  const [pendingCustomerName, setPendingCustomerName] = useState('')
  const [tableModalError, setTableModalError] = useState('')

  // Rating state
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [showSurpriseModal, setShowSurpriseModal] = useState(false)
  const [surpriseDrink, setSurpiseDrink] = useState<Drink | null>(null)
  const [isSurprising, setIsSurprising] = useState(false)
  const [menuCategory, setMenuCategory] = useState<'hot' | 'cold' | 'shisha'>('hot')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // Cashier login state
  const [showCashierLogin, setShowCashierLogin] = useState(false)
  const [cashierLoginName, setCashierLoginName] = useState('')
  const [cashierLoginPwd, setCashierLoginPwd] = useState('')
  const [cashierLoginError, setCashierLoginError] = useState('')
  const [isCashierLoggingIn, setIsCashierLoggingIn] = useState(false)

  // Dev admin board tab state
  const [boardDevPlaceId, setBoardDevPlaceId] = useState('')
  const [boardDevPlaces, setBoardDevPlaces] = useState<Place[]>([])
  const [boardDevOrders, setBoardDevOrders] = useState<OrderWithDetails[]>([])
  const [isFetchingBoardOrders, setIsFetchingBoardOrders] = useState(false)
  const [boardDevSessions, setBoardDevSessions] = useState<Session[]>([])
  const [selectedBoardDevSessionId, setSelectedBoardDevSessionId] = useState<string | null>(null)
  // Multi-session state for regular users
  const [dateSessions, setDateSessions] = useState<Session[]>([])
  const [selectedDateSessionId, setSelectedDateSessionId] = useState<string | null>(null)
  // Dev admin menu tab state
  const [menuDevPlaceId, setMenuDevPlaceId] = useState('')

  // Archive state
  const [showArchivePasswordModal, setShowArchivePasswordModal] = useState(false)
  const [showDrinkCountsModal, setShowDrinkCountsModal] = useState(false)
  const [archivePasswordInput, setArchivePasswordInput] = useState('')
  const [archivePasswordError, setArchivePasswordError] = useState('')
  const [isVerifyingArchivePassword, setIsVerifyingArchivePassword] = useState(false)
  const [archiveUnlocked, setArchiveUnlocked] = useState(false)
  const [archivedSessions, setArchivedSessions] = useState<Session[]>([])
  const [selectedArchivedSessionId, setSelectedArchivedSessionId] = useState<string | null>(null)
  const [archivedOrders, setArchivedOrders] = useState<OrderWithDetails[]>([])
  const [isLoadingArchivedOrders, setIsLoadingArchivedOrders] = useState(false)
  const [showArchiveView, setShowArchiveView] = useState(false)
  // Track today's archived sessions for the archive button indicator
  const [todaysArchivedCount, setTodaysArchivedCount] = useState(0)
  // Archive session deletion state
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [showDeleteSessionConfirm, setShowDeleteSessionConfirm] = useState(false)
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  // Cache for session customer info
  const [sessionCustomerCache, setSessionCustomerCache] = useState<Record<string, { customerName: string | null; tableNumber: string | null }>>({})
  const cacheSessionCustomerInfo = async (sessionId: string) => {
    if (sessionCustomerCache[sessionId]) return sessionCustomerCache[sessionId]
    try {
      const res = await fetch(`/api/orders?session_id=${sessionId}`)
      const data = await res.json()
      const orders = Array.isArray(data) ? data : []
      if (orders.length > 0) {
        const info = {
          customerName: orders[0].customer_name || orders[0].user?.name || null,
          tableNumber: orders[0].table_number || orders[0].user?.table_number || null
        }
        setSessionCustomerCache(prev => ({ ...prev, [sessionId]: info }))
        return info
      }
    } catch (err) {
      console.error('Error fetching session orders:', err)
    }
    return { customerName: null, tableNumber: null }
  }

  const placeParam = currentPlace ? `?place_id=${currentPlace.id}` : ''

  const { data: drinks = [], mutate: mutateDrinks } = useSWR<Drink[]>(
    `/api/drinks${placeParam}`, apiFetcher, { refreshInterval: 5000 })
  const { data: users = [], mutate: mutateUsers } = useSWR<User[]>(
    `/api/users${placeParam}`, apiFetcher, { refreshInterval: 5000 })
  const { data: session, mutate: mutateSession } = useSWR<Session>(
    `/api/sessions${placeParam}`, apiFetcher)
  const { data: messages = [], mutate: mutateMessages } = useSWR<AdminMessage[]>(
    `/api/messages${placeParam}`, apiFetcher, { refreshInterval: 2000 })
  const { data: inventory = [] } = useSWR<{ drink_id: string; quantity: number }[]>(
    '/api/inventory', apiFetcher, { refreshInterval: 5000 })
  
  // Create inventory map for quick lookup
  const inventoryMap = inventory.reduce((acc, item) => {
    acc[item.drink_id] = item.quantity
    return acc
  }, {} as Record<string, number>)

  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [previousPendingOrderIds, setPreviousPendingOrderIds] = useState<Set<string>>(new Set())
  const [floatingMessage, setFloatingMessage] = useState<AdminMessage | null>(null)

  // Order tracking state
  type TrackedOrder = { id: string; drinkName: string; quantity: number; status: string; notes?: string | null; updatedAt: string; orderTrackingEnabled: boolean }
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([])
  const [showTracker, setShowTracker] = useState(false)
  const [trackerMinimized, setTrackerMinimized] = useState(false)
  const [prevTrackedStatuses, setPrevTrackedStatuses] = useState<Record<string, string>>({})
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const processedMessageIds = useRef<Set<string>>(new Set())
  
  const unreadMessages = messages

  // Restore user session from localStorage on page load/refresh
  useEffect(() => {
    setSelectedDate(new Date())

    // ── QR code URL params: ?place=CODE&table=NUM ──────────────────
    const urlParams = new URLSearchParams(window.location.search)
    const qrPlaceRaw = urlParams.get('place')
    const qrTable = urlParams.get('table')

    // Decode in case param arrived URL-encoded (double-encoding guard)
    const qrPlaceCode = qrPlaceRaw
      ? (() => { try { return decodeURIComponent(qrPlaceRaw) } catch { return qrPlaceRaw } })()
      : null
    const qrTableDecoded = qrTable
      ? (() => { try { return decodeURIComponent(qrTable) } catch { return qrTable } })()
      : null

    if (qrTableDecoded) setTableNumber(qrTableDecoded)

    if (qrPlaceCode) {
      // Auto-lookup place from QR and skip straight to menu
      fetch(`/api/places/lookup?code=${encodeURIComponent(qrPlaceCode)}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error && data.id) {
            setCurrentPlace(data)
            localStorage.setItem('qa3da_place', JSON.stringify(data))
          }
        })
        .catch(() => {})
    } else {
      // No QR param — restore from localStorage as normal
      try {
        const savedPlace = localStorage.getItem('qa3da_place')
        if (savedPlace) setCurrentPlace(JSON.parse(savedPlace) as Place)
      } catch {}
    }

    try {
      const saved = localStorage.getItem('qa3da_user')
      if (saved) {
        const user = JSON.parse(saved) as User
        setCurrentUser(user)
        // Restore admin flag if user is a place admin
        if (user.role === 'admin') {
          setIsAdmin(true)
        }
      }
    } catch {}

    // Restore dev admin session
    try {
      const devAdmin = localStorage.getItem('qa3da_devadmin')
      if (devAdmin) {
        const { name } = JSON.parse(devAdmin)
        setSavedDevName(name || '')
        setIsDevAdmin(true)
        setIsAdmin(true)
      }
    } catch {}

    // Restore active tab
    try {
      const savedTab = localStorage.getItem('qa3da_tab')
      if (savedTab === 'menu' || savedTab === 'board' || savedTab === 'admin') {
        setActiveTab(savedTab as TabType)
      }
    } catch {}

    // Restore archive unlocked state
    try {
      const savedArchiveUnlocked = localStorage.getItem('qa3da_archive_unlocked')
      if (savedArchiveUnlocked === 'true') {
        setArchiveUnlocked(true)
      }
    } catch {}

    // Show update banner if this is a new version (stays until user explicitly closes)
    const savedVersion = localStorage.getItem('qa3da_app_version')
    if (savedVersion && savedVersion !== APP_VERSION) {
      setShowUpdateBanner(true)
      // Don't save new version yet — only save when user dismisses banner
    } else {
      localStorage.setItem('qa3da_app_version', APP_VERSION)
    }
    setMounted(true)
  }, [])

  // Auto-login shared user when place is loaded from localStorage (no user saved)
  useEffect(() => {
    if (!mounted) return
    if (currentUser) return
    if (!currentPlace) return
    if (isAdmin || isDevAdmin) return
    const sharedName = `__زبون__${currentPlace.id}`
    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sharedName, password: '', place_id: currentPlace.id })
    })
      .then(r => r.json())
      .then(data => {
        if (data.exists && data.user) {
          setCurrentUser(data.user)
          localStorage.setItem('qa3da_user', JSON.stringify(data.user))
        } else {
          // Create shared user
          return fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: sharedName, password: '', place_id: currentPlace.id })
          }).then(r => r.json()).then(user => {
            if (user?.id) {
              setCurrentUser(user)
              localStorage.setItem('qa3da_user', JSON.stringify(user))
            }
          })
        }
      })
      .catch(() => {})
  }, [mounted, currentPlace?.id])

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('/sounds/notification.wav')
    audio.volume = 0.5
    audio.play().catch(() => {})
  }

  // Show floating message when new admin message arrives
  useEffect(() => {
    if (messages.length > 0 && currentUser && !floatingMessage) {
      const newMessage = messages.find(msg => !processedMessageIds.current.has(msg.id))
      if (newMessage) {
        processedMessageIds.current.add(newMessage.id)
        setFloatingMessage(newMessage)
        
        // Play sound
        playNotificationSound()
        
        // Auto-delete from database
        fetch(`/api/messages/${newMessage.id}`, { method: 'DELETE' }).then(() => {
          mutateMessages(messages.filter(m => m.id !== newMessage.id), false)
        })
      }
    }
  }, [messages, currentUser, floatingMessage, mutateMessages])

  // Keep archive unlocked state in sync with localStorage
  useEffect(() => {
    if (archiveUnlocked) {
      localStorage.setItem('qa3da_archive_unlocked', 'true')
    }
  }, [archiveUnlocked])

  const dismissFloatingMessage = () => {
    setFloatingMessage(null)
  }

  const handleDismissMessage = async (msgId: string) => {
    await fetch(`/api/messages/${msgId}`, { method: 'DELETE' })
    mutateMessages(messages.filter(m => m.id !== msgId), false)
  }

  // Auto-delete messages when user opens the messages modal
  const handleOpenMessages = async () => {
    setShowMessages(true)
    // Mark all messages as read by deleting them when viewed
    if (messages.length > 0) {
      // Delete all messages after user views them
      for (const msg of messages) {
        await fetch(`/api/messages/${msg.id}`, { method: 'DELETE' })
      }
      // Update local state after a short delay to let user read
      setTimeout(() => {
        mutateMessages([], false)
      }, 5000) // Give user 5 seconds to read before clearing
    }
  }

  const fetchOrders = useCallback(async () => {
    if (!session?.id) return
    try {
      const res = await fetch(`/api/orders?session_id=${session.id}`)
      if (!res.ok) {
        console.error(`[v0] Failed to fetch orders: ${res.status}`)
        return
      }
      const text = await res.text()
      if (!text) {
        setOrders([])
        return
      }
      const data = JSON.parse(text)
      
      const newOrders = Array.isArray(data) ? data : []
    
    // Check for completed orders for the current user (filter by table if shared user)
    if (currentUser) {
      const currentTable = tableNumber || localStorage.getItem('qa3da_table_today') || ''
      const isSharedUser = currentUser.name?.startsWith('__زبون__')
      const userOrders = newOrders.filter(o => {
        if (o.user_id !== currentUser.id) return false
        if (isSharedUser && currentTable) return o.user?.table_number === currentTable
        return true
      })
      const currentPendingIds = new Set(
        userOrders.filter(o => o.status === 'pending').map(o => o.id)
      )
      
      // Find orders that were pending but now completed
      previousPendingOrderIds.forEach(orderId => {
        if (!currentPendingIds.has(orderId)) {
          const completedOrder = userOrders.find(o => o.id === orderId && o.status === 'completed')
          if (completedOrder) {
            toast.success(
              `طلبك جاهز: ${completedOrder.drink?.name}`,
              {
                duration: 6000,
                icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
                description: 'يمكنك استلام طلبك الآن'
              }
            )
          }
        }
      })
      
      // Update previous pending orders
      setPreviousPendingOrderIds(currentPendingIds)
    }
    
    setOrders(newOrders)
    } catch (err) {
      console.error('[v0] Error fetching orders:', err)
    }
  }, [session?.id, currentUser, previousPendingOrderIds])

  // ── Order tracking polling effect ───────────────────────────────────
  useEffect(() => {
    if (!showTracker || !session?.id) return

    const pollTrack = async () => {
      try {
        const savedTable = tableNumber || localStorage.getItem('qa3da_table_today') || ''
        const trackUrl = savedTable
          ? `/api/orders/track?session_id=${session.id}&table_number=${encodeURIComponent(savedTable)}`
          : `/api/orders/track?session_id=${session.id}`
        const res  = await fetch(trackUrl)
        const data = await res.json()
        if (!Array.isArray(data)) return

        setTrackedOrders(data)

        // Detect status changes → play sound + toast
        const newStatuses: Record<string, string> = {}
        data.forEach((o: { id: string; status: string; drinkName: string }) => {
          newStatuses[o.id] = o.status
          const prev = prevTrackedStatuses[o.id]
          if (prev && prev !== o.status) {
            if (o.status === 'preparing') {
              toast.info(`☕ جاري تحضير: ${o.drinkName}`)
            } else if (o.status === 'ready') {
              toast.success(`✅ تم التحضير: ${o.drinkName}`, { description: 'طلبك جاهز وبيجيلك دلوقتي!', duration: 8000 })
              try { new Audio('/sounds/ready.mp3').play().catch(() => {}) } catch { /* silent */ }
            } else if (o.status === 'on_the_way') {
              toast.success(`🚶 طلبك في الطريق اليك: ${o.drinkName}`, { description: 'الويتر بياخد طلبك للطاولة', duration: 8000 })
            } else if (o.status === 'completed') {
              toast.success(`🎉 تم التسليم: ${o.drinkName}`, { description: 'استمتع بطلبك!', duration: 6000 })
            }
          }
        })
        setPrevTrackedStatuses(newStatuses)

        // Auto-hide if all orders are delivered
        const allDone = data.length > 0 && data.every((o: { status: string }) => o.status === 'completed')
        if (allDone) {
          setTimeout(() => setTrackerMinimized(true), 8000)
        }
      } catch { /* silent */ }
    }

    pollTrack()
    const interval = setInterval(pollTrack, 5000)
    trackingIntervalRef.current = interval
    return () => clearInterval(interval)
  }, [showTracker, session?.id, tableNumber])

  const fetchBoardPlaces = async () => {
    const res = await fetch('/api/places')
    if (res.ok) {
      const list = await res.json()
      setBoardDevPlaces(list)
      return list as Place[]
    }
    return [] as Place[]
  }

  const fetchBoardOrdersForPlace = async (pid: string, date?: Date, sessionId?: string) => {
    if (!pid) { setBoardDevOrders([]); setBoardDevSessions([]); setSelectedBoardDevSessionId(null); return }
    setIsFetchingBoardOrders(true)
    try {
      const d = date ?? new Date()
      const dateStr = d.toISOString().split('T')[0]

      // If a specific sessionId is requested, just swap orders without refetching sessions
      if (sessionId) {
        const ordRes = await fetch(`/api/orders?session_id=${sessionId}`)
        const data = await ordRes.json()
        setBoardDevOrders(Array.isArray(data) ? data : [])
        return
      }

      // Fetch ALL sessions for this date
      const sessRes = await fetch(`/api/sessions?date=${dateStr}&all=true&place_id=${pid}`)
      const sessions = await sessRes.json()
      if (!Array.isArray(sessions) || sessions.length === 0) {
        setBoardDevOrders([]); setBoardDevSessions([]); setSelectedBoardDevSessionId(null); return
      }
      setBoardDevSessions(sessions)
      // Default: active session first, else the most recent
      const defaultSess = sessions.find((s: Session) => s.is_active) ?? sessions[sessions.length - 1]
      setSelectedBoardDevSessionId(defaultSess.id)

      const ordRes = await fetch(`/api/orders?session_id=${defaultSess.id}`)
      const data = await ordRes.json()
      setBoardDevOrders(Array.isArray(data) ? data : [])
    } catch { setBoardDevOrders([]); setBoardDevSessions([]); setSelectedBoardDevSessionId(null) }
    finally { setIsFetchingBoardOrders(false) }
  }

  // Fetch all places for dev admin on mount so logo shows immediately
  useEffect(() => {
    if (isDevAdmin) {
      fetchBoardPlaces().then(list => {
        if (list.length > 0) {
          setMenuDevPlaceId(prev => prev || list[0].id)
          setBoardDevPlaceId(prev => prev || list[0].id)
        }
      })
    }
  }, [isDevAdmin])

  useEffect(() => {
    // Initialize inventory system on first load
    fetch('/api/setup-inventory', { method: 'POST' })
      .then(res => res.json())
      .then(data => console.log('[v0] Inventory setup:', data))
      .catch(err => console.error('[v0] Inventory setup error:', err))
  }, [])

  // Persist active tab on every change
  useEffect(() => {
    if (mounted) localStorage.setItem('qa3da_tab', activeTab)
  }, [activeTab, mounted])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 3000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        mutateSession()
        fetchOrders()
      }
    }
    const interval = setInterval(checkMidnight, 60000)
    return () => clearInterval(interval)
  }, [mutateSession, fetchOrders])

  const handleLogin = async () => {
    setLoginError('')
    if (!userName.trim()) {
      setLoginError('أدخل اسمك أولاً')
      return
    }

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName.trim(), password: userPassword, place_id: currentPlace?.id || null })
      })

      if (!res.ok && res.status !== 401) {
        setLoginError('حدث خطأ في الاتصال. حاول تاني')
        return
      }

      const data = await res.json()

      if (data.error) {
        if (data.error.toLowerCase().includes('database') || data.error.toLowerCase().includes('not configured')) {
          setLoginError('خطأ في قاعدة البيانات. تواصل مع المسؤول')
        } else {
          setLoginError('كلمة المرور غلط — أعد المحاولة')
          setUserPassword('')
        }
        return
      }

      if (!data.exists) {
        setLoginError('الاسم ده مش موجود. اضغط على Sign Up عشان تسجل حساب جديد')
        return
      }

      if (data.requiresPassword) {
        setLoginError('أدخل كلمة المرور')
        return
      }

      setCurrentUser(data.user)
      localStorage.setItem('qa3da_user', JSON.stringify(data.user))
      setWelcomeName(data.user.name)
      setShowWelcome(true)
      setTimeout(() => setShowWelcome(false), 3000)
    } catch (err) {
      console.error('[v0] Login error:', err)
      setLoginError('حدث خطأ. تأكد من الاتصال بالإنترنت')
    }
  }

  const validatePassword = (pwd: string, name: string): string | null => {
    if (!pwd.trim()) return 'الباسورد مطلوب'

    // Minimum 5 characters
    if (pwd.trim().length < 5) return 'الباسورد لازم يكون 5 أحرف ��و أكتر'

    // Can't be same as username
    if (pwd.toLowerCase() === name.toLowerCase().trim()) return 'الباسورد ما ينفعش يكون نفس اسمك'

    // Check for 4+ sequential digits (e.g. 1234, 5678)
    for (let i = 0; i <= pwd.length - 4; i++) {
      const codes = [pwd.charCodeAt(i), pwd.charCodeAt(i+1), pwd.charCodeAt(i+2), pwd.charCodeAt(i+3)]
      const allDigits = codes.every(c => c >= 48 && c <= 57)
      if (allDigits) {
        const sequential = codes[1] - codes[0] === 1 && codes[2] - codes[1] === 1 && codes[3] - codes[2] === 1
        const reverseSeq = codes[1] - codes[0] === -1 && codes[2] - codes[1] === -1 && codes[3] - codes[2] === -1
        if (sequential || reverseSeq) return 'الباسورد ما ينفعش يحتوي على أرقام متتالية (مثال: 1234)'
      }
    }

    // Check for 4+ sequential letters (e.g. abcd, wxyz)
    for (let i = 0; i <= pwd.length - 4; i++) {
      const lower = pwd.toLowerCase()
      const codes = [lower.charCodeAt(i), lower.charCodeAt(i+1), lower.charCodeAt(i+2), lower.charCodeAt(i+3)]
      const allLetters = codes.every(c => c >= 97 && c <= 122)
      if (allLetters) {
        const sequential = codes[1] - codes[0] === 1 && codes[2] - codes[1] === 1 && codes[3] - codes[2] === 1
        const reverseSeq = codes[1] - codes[0] === -1 && codes[2] - codes[1] === -1 && codes[3] - codes[2] === -1
        if (sequential || reverseSeq) return 'الباسورد ما ينفعش يحتوي على حروف متتالية (مثال: abcd)'
      }
    }

    return null
  }

  const handleCreateUser = async () => {
    const pwdError = validatePassword(newPassword, userName)
    if (pwdError) {
      setLoginError(pwdError + ' — أعد المحاولة')
      setNewPassword('')
      setConfirmPassword('')
      return
    }
    if (newPassword !== confirmPassword) {
      setLoginError('الباسورد مش متطابق — أعد المحاولة')
      setNewPassword('')
      setConfirmPassword('')
      return
    }
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: userName.trim(),
        password: newPassword,
        place_id: currentPlace?.id || null
      })
    })
    const data = await res.json()

    if (data.error) {
      if (data.code === '23505') {
        setLoginError('الاسم ده موجود قبل كده')
      } else {
        setLoginError('حصل مشكلة في إنشاء الحساب: ' + data.error)
      }
      return
    }

    setCurrentUser(data)
    localStorage.setItem('qa3da_user', JSON.stringify(data))
    setIsNewUser(false)
    setWelcomeName(data.name)
    setShowWelcome(true)
    setTimeout(() => setShowWelcome(false), 3000)
    mutateUsers()
  }

  const handleLogout = () => {
    localStorage.removeItem('qa3da_user')
    localStorage.removeItem('qa3da_place')
    localStorage.removeItem('qa3da_devadmin')
    localStorage.removeItem('qa3da_tab')
    setCurrentUser(null)
    setCurrentPlace(null)
    setPlaceCode('')
    setPlaceLookupError('')
    setUserName('')
    setUserPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTableNumber('')
    setCart({})
    setCartNotes({})
    setIsNewUser(false)
    setLoginError('')
    setIsAdmin(false)
    setIsDevAdmin(false)
    setActiveTab('menu')
    setShowAdminLogin(false)
    setShowPlaceAdminConfirm(false)
  }

  const handleLogoClick = () => {
    if (showStars) return
    setShowStars(true)
    setTimeout(() => setShowStars(false), 3000)
  }

  const handleGlobalClick = (e: React.MouseEvent<HTMLElement>) => {
    if (showStars) return
    const target = e.target as HTMLElement
    const tag = target.tagName.toLowerCase()
    const decorativeTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'label']
    if (!decorativeTags.includes(tag)) return
    const interactiveParent = target.closest('button, a, input, textarea, select, [role="button"], [onclick]')
    if (interactiveParent) return
    const text = target.textContent?.trim() ?? ''
    if (!text || text.length < 2) return
    handleLogoClick()
  }

  const handleCashierLogin = async () => {
    if (!cashierLoginName.trim() || !cashierLoginPwd.trim()) {
      setCashierLoginError('أدخل الاسم وكلمة المرور')
      return
    }
    setIsCashierLoggingIn(true)
    setCashierLoginError('')
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cashierLoginName.trim(), password: cashierLoginPwd, place_id: null })
      })
      const data = await res.json()
      if (!data.exists || !data.user) {
        setCashierLoginError('اسم المستخدم أو كلمة المرور غلط')
        return
      }
      if (data.user.role !== 'cashier') {
        setCashierLoginError('هذا الحساب مش كاشير — استخدم تسجيل دخول الأدمن')
        return
      }
      if (data.user.place_id) {
        const placesRes = await fetch('/api/places')
        const places = await placesRes.json()
        const place = Array.isArray(places) ? places.find((p: Place) => p.id === data.user.place_id) : null
        if (place) {
          setCurrentPlace(place)
          localStorage.setItem('qa3da_place', JSON.stringify(place))
        }
      }
      setCurrentUser(data.user)
      localStorage.setItem('qa3da_user', JSON.stringify(data.user))
      setShowCashierLogin(false)
      setCashierLoginName('')
      setCashierLoginPwd('')
    } catch {
      setCashierLoginError('حدث خطأ. تأكد من الاتصال بالإنترنت')
    } finally {
      setIsCashierLoggingIn(false)
    }
  }

  const handleAddToCart = (drinkId: string) => {
    setCart(prev => ({
      ...prev,
      [drinkId]: (prev[drinkId] || 0) + 1
    }))
  }

  const handleRemoveFromCart = (drinkId: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[drinkId] > 1) {
        newCart[drinkId]--
      } else {
        delete newCart[drinkId]
      }
      return newCart
    })
  }

  const handleSubmitOrder = async () => {
    if (isDevAdmin) {
      if (!menuDevPlaceId) {
        toast.error('اختار مكان الأول من القائمة')
        return
      }
      const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0)
      if (cartItems.length === 0) return
      setPendingTableNumber('')
      setPendingCustomerName('')
      setTableModalError('')
      setShowTableModal(true)
      return
    }
    if (!session && !currentUser) {
      toast.error('في مشكلة في الجلسة، حاول تحدّث الصفحة')
      return
    }

    const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0)
    if (cartItems.length === 0) return

    // If table number came from QR URL — skip modal entirely
    if (tableNumber) {
      handleConfirmTableAndSubmit(tableNumber)
      return
    }

    // Show table number modal — always start empty
    setPendingTableNumber('')
    setPendingCustomerName('')
    setGuestName('')
    setTableModalError('')
    setShowTableModal(true)
  }

  const handleConfirmTableAndSubmit = async (tableOverride?: string) => {
    const tableNum = String(tableOverride ?? pendingTableNumber ?? '').trim()
    const customerName = pendingCustomerName.trim()
    
    if (!tableNum) {
      setTableModalError('رقم الطربيزة مطلوب')
      return
    }
    
    if (!customerName) {
      setTableModalError('اسم الزبون مطلوب')
      return
    }

    setIsSubmittingOrder(true)
    try {
      let activeSessionId: string | null = null
      let resolvedUser = currentUser

      if (isDevAdmin) {
        // Fetch/create session for the selected place
        const sessionRes = await fetch(`/api/sessions?place_id=${menuDevPlaceId}`)
        if (sessionRes.ok) {
          const devSession = await sessionRes.json()
          activeSessionId = devSession?.id || null
        }
      } else {
        // If no user, find or create the shared user for this place
        if (!resolvedUser) {
          const sharedName = `__زبون__${currentPlace?.id || 'global'}`
          try {
            const loginRes = await fetch('/api/users/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: sharedName, password: '', place_id: currentPlace?.id || null })
            })
            const loginData = await loginRes.json()
            if (loginData.exists && loginData.user) {
              resolvedUser = loginData.user
            } else {
              const createRes = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: sharedName, password: '', place_id: currentPlace?.id || null })
              })
              if (!createRes.ok) {
                setTableModalError('في مشكلة في إنشاء حسابك، حاول تاني')
                setIsSubmittingOrder(false)
                return
              }
              resolvedUser = await createRes.json()
            }
          } catch {
            setTableModalError('في مشكلة في الاتصال، حاول تاني')
            setIsSubmittingOrder(false)
            return
          }
          if (!resolvedUser?.id) {
            setTableModalError('في مشكلة في إنشاء حسابك، حاول تاني')
            setIsSubmittingOrder(false)
            return
          }
          setCurrentUser(resolvedUser)
          localStorage.setItem('qa3da_user', JSON.stringify(resolvedUser))
        }

        // Save table number to user
        await fetch(`/api/users/${resolvedUser!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_number: tableNum })
        })

        // Update local user state
        const newUser = { ...resolvedUser!, table_number: tableNum }
        setCurrentUser(newUser)
        localStorage.setItem('qa3da_user', JSON.stringify(newUser))
        resolvedUser = newUser

        // Remember table number for today only
        const today = new Date().toISOString().slice(0, 10)
        localStorage.setItem('qa3da_table_date', today)
        localStorage.setItem('qa3da_table_today', tableNum)

        activeSessionId = session?.id || null
        if (!activeSessionId) {
          // Try to fetch session for place
          const sRes = await fetch(`/api/sessions?place_id=${currentPlace?.id}`)
          if (sRes.ok) { const s = await sRes.json(); activeSessionId = s?.id || null }
        }
      }

      if (!activeSessionId) {
        setTableModalError('مفيش جلسة نشطة للمكان ده')
        return
      }

      setShowTableModal(false)

      const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0)
      let anyFailed = false

      for (const [drinkId, quantity] of cartItems) {
        const drink = drinks.find(d => d.id === drinkId)
        const orderNotes = isDevAdmin
          ? [cartNotes[drinkId]?.trim(), `طاولة ${tableNum}`, 'مطور'].filter(Boolean).join(' | ')
          : cartNotes[drinkId]?.trim() || null
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: activeSessionId,
            user_id: isDevAdmin ? null : resolvedUser?.id || null,
            drink_id: drinkId,
            quantity,
            total_price: (drink?.price || 0) * quantity,
            notes: orderNotes,
            customer_name: customerName,
            table_number: tableNum,
            customer_phone: null
          })
        })
        if (!orderRes.ok) {
          anyFailed = true
          console.error('Order creation failed for drink:', drinkId, await orderRes.text())
        }

        await fetch(`/api/inventory/${drinkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'decrement', quantity })
        })
      }

      setCart({})
      setCartNotes({})
      setPendingCustomerName('')
      setPendingTableNumber('')
      setRatingValue(0)
      setRatingSubmitted(false)
      if (anyFailed) {
        toast.error('في مشكلة في بعض الطلبات، تواصل مع الكاشير')
      } else {
        toast.success('تم إرسال طلبك بنجاح!')
        // Show tracker widget if tracking is enabled for this place
        if (currentPlace?.order_tracking_enabled !== false && !isDevAdmin) {
          setShowTracker(true)
        }
      }
      if (isDevAdmin && menuDevPlaceId) {
        setBoardDevPlaceId(menuDevPlaceId)
        await fetchBoardPlaces()
        fetchBoardOrdersForPlace(menuDevPlaceId)
      } else {
        fetchOrders()
      }
      setActiveTab('board')
    } catch (err) {
      console.error('Order submission error:', err)
      toast.error('حدث خطأ أثناء إرسال الطلب، حاول تاني')
      setTableModalError('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const handleSurpriseMe = () => {
    const available = drinks.filter(d => {
      if ((inventoryMap[d.id] ?? 0) <= 0) return false
      const cat = (d.category || '').toLowerCase()
      const nameHasShisha = d.name?.includes('شيشة') || d.name?.toLowerCase().includes('shisha')
      if (menuCategory === 'hot') return cat === 'hot' && !nameHasShisha
      if (menuCategory === 'cold') return cat === 'cold' && !nameHasShisha
      if (menuCategory === 'shisha') return cat === 'shisha' || nameHasShisha
      return true
    })
    if (available.length === 0) return
    setIsSurprising(true)
    setSurpiseDrink(null)
    setShowSurpriseModal(true)
    let count = 0
    const maxSpins = 12
    const interval = setInterval(() => {
      const random = available[Math.floor(Math.random() * available.length)]
      setSurpiseDrink(random)
      count++
      if (count >= maxSpins) {
        clearInterval(interval)
        setIsSurprising(false)
      }
    }, 120)
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
      fetchOrders()
      if (isDevAdmin && boardDevPlaceId) {
        fetchBoardOrdersForPlace(boardDevPlaceId, selectedDate ?? new Date())
      }
    } catch {
      toast.error('فشل حذف الطلب')
    }
  }

  const handleUserPasswordReset = async (userId: string) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: null })
    })
    mutateUsers()
  }

  const handleUserPasswordSet = async (userId: string, password: string) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    mutateUsers()
  }

  const handleUserDelete = async (userId: string) => {
    await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    mutateUsers()
  }

  const handleAdminLogin = () => {
    if (!devAdminName.trim()) { setAdminError('أدخل اسم المطور'); return }
    if (adminPassword === 'Basem.s.ebeid#@55!') {
      const name = devAdminName.trim()
      setSavedDevName(name)
      setIsAdmin(true)
      setIsDevAdmin(true)
      setShowAdminLogin(false)
      setDevAdminName('')
      setAdminPassword('')
      setAdminError('')
      setActiveTab('admin')
      localStorage.setItem('qa3da_devadmin', JSON.stringify({ name }))
      localStorage.setItem('qa3da_tab', 'admin')
      setShowDevWelcome(true)
      setTimeout(() => setShowDevWelcome(false), 4000)
    } else {
      setAdminError('كلمة المرور غلط — أعد المحاولة')
      setAdminPassword('')
    }
  }

  const handlePlaceAdminConfirm = async () => {
    if (!placeAdminConfirmName.trim() || !placeAdminConfirmPwd.trim()) {
      setPlaceAdminConfirmError('أدخل الاسم والباسورد')
      return
    }
    setIsVerifyingPlaceAdmin(true)
    setPlaceAdminConfirmError('')
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: placeAdminConfirmName.trim(), password: placeAdminConfirmPwd, place_id: currentPlace?.id || null })
      })
      const data = await res.json()
      if (!data.exists || !data.user || data.user.role !== 'admin') {
        setPlaceAdminConfirmError('الاسم أو الباسورد غلط — أعد المحاولة')
        setPlaceAdminConfirmPwd('')
        return
      }
      setIsAdmin(true)
      setShowPlaceAdminConfirm(false)
      setPlaceAdminConfirmName('')
      setPlaceAdminConfirmPwd('')
      setPlaceAdminConfirmError('')
      setActiveTab('admin')
      localStorage.setItem('qa3da_tab', 'admin')
      setPlaceAdminWelcomeName(data.user.name)
      setShowPlaceAdminWelcome(true)
      setTimeout(() => setShowPlaceAdminWelcome(false), 3500)
    } catch {
      setPlaceAdminConfirmError('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsVerifyingPlaceAdmin(false)
    }
  }

  const handlePlaceAdminFromLanding = async () => {
    if (!placeCode.trim()) { setPlaceAdminConfirmError('أدخل اسم المكان أولاً'); return }
    if (!placeAdminConfirmName.trim() || !placeAdminConfirmPwd.trim()) {
      setPlaceAdminConfirmError('أدخل اسم الأدمن والباسورد')
      return
    }
    setIsVerifyingPlaceAdmin(true)
    setPlaceAdminConfirmError('')
    try {
      // Look up place
      const placeRes = await fetch(`/api/places/lookup?code=${encodeURIComponent(placeCode.trim())}`)
      const placeData = await placeRes.json()
      if (!placeRes.ok) { setPlaceAdminConfirmError(placeData.error || 'المكان مش موجود'); return }

      // Verify admin credentials
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: placeAdminConfirmName.trim(), password: placeAdminConfirmPwd, place_id: placeData.id })
      })
      const loginData = await loginRes.json()
      if (!loginData.exists || !loginData.user || loginData.user.role !== 'admin') {
        setPlaceAdminConfirmError('الاسم أو الباسورد غلط — أعد المحاولة')
        setPlaceAdminConfirmPwd('')
        return
      }

      // All good — set up admin session
      setCurrentPlace(placeData)
      localStorage.setItem('qa3da_place', JSON.stringify(placeData))
      setCurrentUser(loginData.user)
      localStorage.setItem('qa3da_user', JSON.stringify(loginData.user))
      setIsAdmin(true)
      setShowPlaceAdminLanding(false)
      setPlaceAdminConfirmName('')
      setPlaceAdminConfirmPwd('')
      setPlaceAdminConfirmError('')
      setPlaceCode('')
      setActiveTab('admin')
      localStorage.setItem('qa3da_tab', 'admin')
      setPlaceAdminWelcomeName(loginData.user.name)
      setShowPlaceAdminWelcome(true)
      setTimeout(() => setShowPlaceAdminWelcome(false), 3500)
    } catch { setPlaceAdminConfirmError('حدث خطأ، حاول مرة أخرى') }
    finally { setIsVerifyingPlaceAdmin(false) }
  }

  const handleNewSession = async () => {
    setIsCreatingNewSession(true)
    try {
      const placeId = isDevAdmin ? boardDevPlaceId : (currentPlace?.id ?? null)
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', place_id: placeId }),
      })
      setShowNewSessionConfirm(false)
      if (isDevAdmin) {
        await fetchBoardOrdersForPlace(boardDevPlaceId)
      } else {
        await mutateSession()
      }
    } catch { /* silent */ }
    finally { setIsCreatingNewSession(false) }
  }

  const handleVerifyArchivePassword = async () => {
    if (!archivePasswordInput.trim()) {
      setArchivePasswordError('أدخل كلمة السر')
      return
    }
    setIsVerifyingArchivePassword(true)
    setArchivePasswordError('')
    try {
      const res = await fetch('/api/settings?key=archive_password')
      const data = await res.json()
      if (data.value === archivePasswordInput) {
        setArchiveUnlocked(true)
        // Save the unlocked state to localStorage
        localStorage.setItem('qa3da_archive_unlocked', 'true')
        setShowArchivePasswordModal(false)
        setArchivePasswordInput('')
        setShowArchiveView(true)
        // Fetch archived sessions — show today's archived sessions first
        const placeId = currentPlace?.id
        const today = new Date().toISOString().split('T')[0]
        const sessRes = await fetch(`/api/sessions/archived${placeId ? `?place_id=${placeId}` : ''}`)
        if (!sessRes.ok) {
          setArchivePasswordError('فشل جلب الجلسات المؤرشفة')
          return
        }
        const sessText = await sessRes.text()
        if (!sessText) {
          setArchivedSessions([])
          return
        }
        const sessData = JSON.parse(sessText)
        // Filter to show today's archived sessions first, then older ones
        const allSessions = Array.isArray(sessData) ? sessData : []
        const todayArchived = allSessions.filter(s => s.date === today)
        const olderArchived = allSessions.filter(s => s.date !== today)
        const sortedSessions = [...todayArchived, ...olderArchived]
        setArchivedSessions(sortedSessions)
        // Cache customer info for each session
        sortedSessions.forEach(sess => {
          cacheSessionCustomerInfo(sess.id).catch(err => console.error('Error caching session info:', err))
        })
      } else {
        setArchivePasswordError('كلمة السر غير صحيحة')
      }
    } catch {
      setArchivePasswordError('حدث خطأ. حاول مرة أخرى')
    } finally {
      setIsVerifyingArchivePassword(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return
    setIsDeletingSession(true)
    try {
      const res = await fetch(`/api/sessions/${sessionToDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        // Remove from archived sessions list
        setArchivedSessions(archivedSessions.filter(s => s.id !== sessionToDelete.id))
        setShowDeleteSessionConfirm(false)
        setSessionToDelete(null)
        toast.success('تم حذف الجلسة بنجاح')
      } else {
        toast.error('فشل حذف الجلسة')
      }
    } catch (err) {
      console.error('[v0] Error deleting session:', err)
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setIsDeletingSession(false)
    }
  }

  const handlePlaceSelect = async () => {
    if (!placeCode.trim()) { setPlaceLookupError('أدخل كود المكان أولاً'); return }
    setPlaceLookupLoading(true)
    setPlaceLookupError('')
    try {
      const res = await fetch(`/api/places/lookup?code=${encodeURIComponent(placeCode.trim())}`)
      const data = await res.json()
      if (!res.ok) { setPlaceLookupError(data.error || 'المكان مش موجود'); return }
      setCurrentPlace(data)
      localStorage.setItem('qa3da_place', JSON.stringify(data))
    } catch {
      setPlaceLookupError('حدث خطأ. تأكد من الاتصال')
    } finally {
      setPlaceLookupLoading(false)
    }
  }

  const handleOpenPlacesPicker = async () => {
    setShowPlacesPicker(true)
    if (allActivePlaces.length > 0) return
    setIsLoadingPlaces(true)
    try {
      const res = await fetch('/api/places')
      const data = await res.json()
      if (Array.isArray(data)) setAllActivePlaces(data.filter((p: Place) => p.is_active))
    } catch {}
    finally { setIsLoadingPlaces(false) }
  }

  // ─── Auto-login shared user for a place ──────────────���────
  const autoLoginSharedUser = async (place: Place) => {
    const sharedName = `__زبون__${place.id}`
    try {
      // Try to find existing shared user
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sharedName, password: '', place_id: place.id })
      })
      const loginData = await loginRes.json()
      if (loginData.exists && loginData.user) {
        setCurrentUser(loginData.user)
        localStorage.setItem('qa3da_user', JSON.stringify(loginData.user))
        return
      }
      // Not found — create shared user
      const createRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sharedName, password: '', place_id: place.id })
      })
      if (createRes.ok) {
        const user = await createRes.json()
        if (user?.id) {
          setCurrentUser(user)
          localStorage.setItem('qa3da_user', JSON.stringify(user))
        }
      }
    } catch {}
  }

  const handleSelectPlaceFromPicker = (place: Place) => {
    setCurrentPlace(place)
    localStorage.setItem('qa3da_place', JSON.stringify(place))
    setShowPlacesPicker(false)
    autoLoginSharedUser(place)
  }

  const cartTotal = Object.entries(cart).reduce((total, [drinkId, qty]) => {
    const drink = drinks.find(d => d.id === drinkId)
    return total + (drink?.price || 0) * qty
  }, 0)

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  const effectiveDate = selectedDate ?? new Date()
  const todayStr = new Date().toDateString()
  const isToday = effectiveDate.toDateString() === todayStr
  const isFuture = effectiveDate > new Date(new Date().setHours(23, 59, 59, 999))

  // Orders to show in board tab — use live SWR orders only when viewing today's active session
  const viewingLiveSession = selectedDateSessionId === session?.id || (!selectedDateSessionId && isToday)
  const boardOrders = (isToday && viewingLiveSession) ? orders : (dateOrders ?? [])

  const totalOrdersPrice = boardOrders.reduce((total, order) => {
    return total + (order.drink?.price || 0) * order.quantity
  }, 0)

  const uniqueUsers = [...new Set(boardOrders.map(o => o.user_id))].length

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-EG', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Fetch ALL sessions for the current date and resolve orders for the default one
  useEffect(() => {
    if (isFuture) { setDateOrders(null); setDateSessions([]); setSelectedDateSessionId(null); return }

    const dateStr = effectiveDate.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]
    const pid = currentPlace?.id ? `&place_id=${currentPlace.id}` : ''

    setIsLoadingDateOrders(true)
    fetch(`/api/sessions?date=${dateStr}&all=true${pid}`)
      .then(r => r.json())
      .then(async (sessions: Session[]) => {
        if (!Array.isArray(sessions) || sessions.length === 0) {
          setDateSessions([]); setSelectedDateSessionId(null); setDateOrders([]); return
        }
        // Filter to show only active sessions for today; for past dates show all
        const isToday = dateStr === todayStr
        const activeSessions = isToday ? sessions.filter(s => s.is_active) : sessions
        setDateSessions(activeSessions)
        
        // Default: active session first, else the most recent
        const defaultSess = activeSessions.find(s => s.is_active) ?? activeSessions[activeSessions.length - 1]
        if (!defaultSess) { setSelectedDateSessionId(null); setDateOrders([]); return }
        setSelectedDateSessionId(defaultSess.id)

        // For today's active session, live orders come from SWR — no need to fetch here
        if (defaultSess.is_active && dateStr === todayStr) {
          setDateOrders(null); return
        }
        const res = await fetch(`/api/orders?session_id=${defaultSess.id}`)
        const data = await res.json()
        setDateOrders(Array.isArray(data) ? data : [])
      })
      .catch(() => { setDateSessions([]); setSelectedDateSessionId(null); setDateOrders([]) })
      .finally(() => setIsLoadingDateOrders(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDate.toDateString(), currentPlace?.id, session?.id])

  // Fetch today's archived sessions count to show on archive button
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const pid = currentPlace?.id ? `?place_id=${currentPlace.id}` : ''
    
    fetch(`/api/sessions?date=${today}&all=true${pid}`)
      .then(r => r.json())
      .then((sessions: Session[]) => {
        if (Array.isArray(sessions)) {
          const archivedCount = sessions.filter(s => !s.is_active).length
          setTodaysArchivedCount(archivedCount)
        }
      })
      .catch(() => setTodaysArchivedCount(0))
  }, [currentPlace?.id, session?.id])

  // Re-fetch dev admin board orders when selected date changes
  useEffect(() => {
    if (!isDevAdmin || !boardDevPlaceId) return
    fetchBoardOrdersForPlace(boardDevPlaceId, selectedDate ?? new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDate.toDateString(), boardDevPlaceId])

  // Header Component
  const Header = () => (
    <header className="sticky top-0 z-40 border-b border-zinc-700/60 bg-zinc-800/90 backdrop-blur-sm">
      {/* Creative developer attribution bar */}
      <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0', textShadow: '0 0 12px rgba(212,160,23,0.8), 0 0 24px rgba(212,160,23,0.4)' }}>
            Developed by Basem Samir Ebeid
          </span>
          <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('menu'); if (isDevAdmin) fetchBoardPlaces().then(list => { if (list.length > 0) setMenuDevPlaceId(prev => prev || list[0].id) }) }}
            className={`flex h-11 w-11 items-center justify-center rounded-full overflow-hidden transition-colors border-2 ${
              activeTab === 'menu' ? 'border-primary shadow-lg' : 'border-transparent hover:border-primary/40'
            }`}
            style={activeTab === 'menu' ? { boxShadow: '0 0 10px rgba(212,160,23,0.5)' } : {}}
          >
            <img src="/images/qa3da-logo.jpg" alt="SîpFlõw" className="h-full w-full object-cover" />
          </button>
          <button
            onClick={() => { setActiveTab('board'); if (isDevAdmin) fetchBoardPlaces().then(list => { if (list.length > 0) { const pid = list[0].id; setBoardDevPlaceId(prev => { const chosen = prev || pid; fetchBoardOrdersForPlace(chosen); return chosen }) } }) }}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              activeTab === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Grid3X3 className="h-5 w-5" />
          </button>
          {/* Admin button: only for place admins (not dev admin) */}
          {!isDevAdmin && currentUser?.role === 'admin' && (
            <button
              onClick={() => {
                if (isAdmin) {
                  setActiveTab('admin')
                } else {
                  setPlaceAdminConfirmName('')
                  setPlaceAdminConfirmPwd('')
                  setPlaceAdminConfirmError('')
                  setShowPlaceAdminConfirm(true)
                }
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                activeTab === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
          {/* Dev Admin VIP badge button */}
          {isDevAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${
                activeTab === 'admin'
                  ? 'shadow-lg scale-105'
                  : 'opacity-90 hover:opacity-100 hover:scale-105'
              }`}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5, #0ea5e9)',
                color: '#fff',
                boxShadow: activeTab === 'admin' ? '0 0 16px rgba(124,58,237,0.7)' : '0 2px 8px rgba(79,70,229,0.4)'
              }}
            >
              <span>👑</span>
              <span>Admin VIP</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(currentUser || isDevAdmin) && (
            <>
              <button
                onClick={handleLogout}
                className="flex h-11 w-11 items-center justify-center rounded-full text-destructive hover:bg-destructive/10 transition-colors"
                title="تسجيل خروج"
              >
                <LogOut className="h-5 w-5" />
              </button>
              {currentUser && (
                <button
                  onClick={handleOpenMessages}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <Bell className="h-5 w-5" />
                  {unreadMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unreadMessages.length}
                    </span>
                  )}
                </button>
              )}
            </>
          )}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
            title="SîpFlõw"
          >
            <span className="text-lg font-bold text-foreground">SîpFlõw</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden bg-black border-2" style={{ borderColor: '#D4A017' }}>
              <img src="/images/qa3da-logo.jpg" alt="SîpFlõw" className="h-full w-full object-cover" />
            </div>
          </button>
        </div>
      </div>
    </header>
  )

  // Prevent hydration mismatch - don't render until client-side mount
  if (!mounted) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center" dir="rtl" onClick={handleGlobalClick} suppressHydrationWarning>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  // Place Selection Screen
  if (!currentPlace && !isAdmin) {
    return (
      <main className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center p-6" dir="rtl" onClick={handleGlobalClick} suppressHydrationWarning>
        <div className="relative overflow-hidden py-[5px] w-full absolute top-0" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60">✦</span>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0' }}>Developed by Basem Samir Ebeid</span>
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60">✦</span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6 mt-8">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-xl px-4 py-3 text-center"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #2d3461 75%, #1a2744 100%)',
              border: '1px solid rgba(99,102,241,0.35)',
              boxShadow: '0 4px 18px rgba(79,70,229,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
            <div className="absolute top-1.5 right-2 text-indigo-300/25 text-[9px] tracking-widest">✦ ✦</div>
            <div className="absolute top-1.5 left-2 text-indigo-300/25 text-[9px] tracking-widest">✦ ✦</div>
            <p className="text-[9px] tracking-[0.22em] uppercase font-semibold mb-1" style={{ color: '#a5b4fc' }}>
              Welcome · أهلاً وسهلاً
            </p>
            <p className="text-sm font-bold leading-snug" style={{ color: '#e0e7ff', fontFamily: 'Georgia, serif' }}>
              نتمنى لكم يوماً جميلاً وممتعاً معنا في{' '}
              <span style={{ color: '#fbbf24' }}>SîpFlõw</span> ☕
            </p>
            <div className="mt-2 mx-auto h-px w-20 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #818cf8, transparent)' }} />
          </div>

          {/* Logo */}
          <div className="flex flex-col items-center space-y-3">
            {/* Logo with rotating golden zigzag frame */}
            <div className="relative flex items-center justify-center" style={{ width: 164, height: 164 }}>

              {/* ── Outer animated zigzag stroke ring (counter-rotates) ── */}
              <svg
                viewBox="0 0 180 180"
                className="animate-zigzag-ring"
                style={{ position: 'absolute', top: -8, left: -8, width: 180, height: 180, zIndex: 0 }}
              >
                <defs>
                  <linearGradient id="zigStrokeGoldA" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#FFF3A3" />
                    <stop offset="35%"  stopColor="#D4A017" />
                    <stop offset="65%"  stopColor="#F5D060" />
                    <stop offset="100%" stopColor="#A07010" />
                  </linearGradient>
                </defs>
                <polygon
                  fill="none"
                  stroke="url(#zigStrokeGoldA)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-zigzag-dash"
                  points="90,2 110.7,12.73 134,13.79 146.57,33.43 166.21,46 167.27,69.3 178,90 167.27,110.7 166.21,134 146.57,146.57 134,166.21 110.7,167.27 90,178 69.3,167.27 46,166.21 33.43,146.57 13.79,134 12.73,110.7 2,90 12.73,69.3 13.79,46 33.43,33.43 46,13.79 69.3,12.73"
                />
              </svg>

              {/* Circular logo */}
              <div className="absolute rounded-full overflow-hidden bg-black shadow-lg" style={{ width: 128, height: 128, zIndex: 1 }}>
                <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" fill sizes="128px" loading="eager" style={{ objectFit: 'cover', objectPosition: 'center' }} />
              </div>
            </div>
            <p className="text-4xl font-bold" style={{ color: '#C17A3A', fontFamily: 'Georgia, serif' }}>SîpFlõw</p>
            <p className="text-sm text-gray-400 tracking-widest">Order Management System</p>
          </div>

          {/* Place Picker Button */}
          <div>
            <button
              onClick={handleOpenPlacesPicker}
              disabled={isLoadingPlaces}
              className="w-full rounded-2xl flex items-center justify-between px-4 py-3 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #0f0a00, #1c1200)',
                border: '1px solid rgba(212,160,23,0.35)',
                boxShadow: '0 0 18px rgba(212,160,23,0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.2)' }}>
                  {isLoadingPlaces
                    ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#D4A017' }} />
                    : <MapPin className="h-4 w-4" style={{ color: '#D4A017' }} />}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold leading-tight" style={{ color: '#e8c76a' }}>
                    {isLoadingPlaces ? '��اري التحميل...' : 'اختار مكانك'}
                  </p>
                  {!isLoadingPlaces && (
                    <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'rgba(212,160,23,0.5)' }}>لتقديم طلبك</p>
                  )}
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: 'rgba(212,160,23,0.4)' }} />
            </button>
          </div>

          {/* Admin Buttons */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] tracking-[0.2em] uppercase text-gray-600 mb-1">للإدارة فقط</p>
            <div className="flex flex-col gap-2 w-full">

              {/* Dev Admin — eye-catching full-width premium button */}
              <button
                onClick={() => setShowAdminLogin(true)}
                className="relative w-full overflow-hidden rounded-2xl py-4 px-5 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #0d0520 0%, #1a0a3d 40%, #2d1060 70%, #1a0a3d 100%)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  boxShadow: '0 0 30px rgba(124,58,237,0.25), 0 0 60px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
                }}
              >
                {/* Glow orb */}
                <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full blur-xl opacity-40" style={{ background: 'radial-gradient(#a78bfa, transparent)' }} />
                <div className="absolute -bottom-4 -left-4 h-12 w-12 rounded-full blur-xl opacity-30" style={{ background: 'radial-gradient(#818cf8, transparent)' }} />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    👑
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: '#c4b5fd' }}>Developer Admin</p>
                    <p className="text-[11px]" style={{ color: 'rgba(167,139,250,0.6)' }}>System Control Panel</p>
                  </div>
                </div>
                <div className="relative flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#a78bfa' }} />
                  <span className="text-[10px] font-bold tracking-wider" style={{ color: '#a78bfa' }}>VIP</span>
                </div>
              </button>

              {/* Second row: 4 buttons 2x2 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setShowPlaceAdminLanding(true); setPlaceAdminConfirmError('') }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.25)' }}
                >
                  <span className="text-lg">⚙️</span>
                  <span className="text-[10px] font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Place Admin
                  </span>
                </button>

                <button
                  onClick={() => { setShowCashierLogin(true); setCashierLoginError('') }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}
                >
                  <span className="text-lg">🧾</span>
                  <span className="text-[10px] font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Cashier
                  </span>
                </button>

                <button
                  onClick={() => window.location.href = '/waiter'}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.3)' }}
                >
                  <span className="text-lg">🛎️</span>
                  <span className="text-[10px] font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #D4A017, #f0c040)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Waiter
                  </span>
                </button>

                <button
                  onClick={() => window.location.href = '/bar'}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.25)' }}
                >
                  <span className="text-lg">☕</span>
                  <span className="text-[10px] font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Bar
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Login Modal for Developer on place screen */}
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
            <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(244,63,94,0.2)' }}>
              <div className="text-center mb-7">
                <div className="relative mx-auto mb-5 h-20 w-20">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden border border-rose-500/30 shadow-lg shadow-rose-500/15">
                    <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 0 10px rgba(244,63,94,0.5)' }}>
                    <ShieldCheck className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                  style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                  بوابة المطور
                </div>
                <h1 className="text-xl font-bold text-white">SîpFlõw · Dev Admin</h1>
                <p className="text-xs text-zinc-500 mt-1">الوصول الكامل للنظام</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">الاسم</label>
                  <Input value={devAdminName} onChange={e => { setDevAdminName(e.target.value); setAdminError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="اسمك..." dir="rtl"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-rose-500/40 focus-visible:border-rose-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                  <Input type="password" value={adminPassword} onChange={e => { setAdminPassword(e.target.value); setAdminError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="••••••••" dir="ltr"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-rose-500/40 focus-visible:border-rose-500/50" />
                </div>
                {adminError && <p className="text-center text-sm text-rose-400">{adminError}</p>}
                <button onClick={handleAdminLogin}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', boxShadow: '0 2px 14px rgba(244,63,94,0.3)' }}>
                  <ShieldCheck className="h-4 w-4" />
                  دخول المطور
                </button>
                <button onClick={() => { setShowAdminLogin(false); setDevAdminName(''); setAdminPassword(''); setAdminError('') }}
                  className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cashier Login Modal */}
        {showCashierLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
            <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div className="text-center mb-7">
                <div className="relative mx-auto mb-5 h-20 w-20">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden border border-violet-500/30 shadow-lg shadow-violet-500/15">
                    <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                    <ClipboardList className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  بوابة الكاشير
                </div>
                <h1 className="text-xl font-bold text-white">SîpFlõw · كاشير</h1>
                <p className="text-xs text-zinc-500 mt-1">إدارة الطلبات والإيرادات</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم المستخدم</label>
                  <Input value={cashierLoginName} onChange={e => { setCashierLoginName(e.target.value); setCashierLoginError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleCashierLogin()}
                    placeholder="username" dir="ltr"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                  <Input type="password" value={cashierLoginPwd} onChange={e => { setCashierLoginPwd(e.target.value); setCashierLoginError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleCashierLogin()}
                    placeholder="••••••••" dir="ltr"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50" />
                </div>
                {cashierLoginError && <p className="text-center text-sm text-rose-400">{cashierLoginError}</p>}
                <button onClick={handleCashierLogin} disabled={isCashierLoggingIn}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: isCashierLoggingIn ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', boxShadow: '0 2px 14px rgba(168,85,247,0.3)' }}>
                  {isCashierLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  {isCashierLoggingIn ? 'جاري الدخول...' : 'دخول كاشير'}
                </button>
                <button onClick={() => { setShowCashierLogin(false); setCashierLoginName(''); setCashierLoginPwd(''); setCashierLoginError('') }}
                  className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Place Admin login from landing screen */}
        {showPlaceAdminLanding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
            <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.2)' }}>
              <div className="text-center mb-7">
                <div className="relative mx-auto mb-5 h-20 w-20">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid rgba(212,160,23,0.35)', boxShadow: '0 4px 20px rgba(212,160,23,0.15)' }}>
                    <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', boxShadow: '0 0 10px rgba(212,160,23,0.5)' }}>
                    <Settings className="h-3.5 w-3.5 text-black" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                  style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#D4A017' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  بوابة إدارة المكان
                </div>
                <h1 className="text-xl font-bold text-white">SîpFlõw · أدمن</h1>
                <p className="text-xs text-zinc-500 mt-1">إدارة المكان والطلبات والإعدادات</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم المكان</label>
                  <Input value={placeCode} onChange={e => { setPlaceCode(e.target.value); setPlaceAdminConfirmError('') }}
                    onKeyDown={e => e.key === 'Enter' && handlePlaceAdminFromLanding()}
                    placeholder="مثال: كافيه النيل" dir="rtl"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم الأدمن</label>
                  <Input value={placeAdminConfirmName} onChange={e => { setPlaceAdminConfirmName(e.target.value); setPlaceAdminConfirmError('') }}
                    onKeyDown={e => e.key === 'Enter' && handlePlaceAdminFromLanding()}
                    placeholder="اسمك..." dir="rtl"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                  <Input type="password" value={placeAdminConfirmPwd} onChange={e => { setPlaceAdminConfirmPwd(e.target.value); setPlaceAdminConfirmError('') }}
                    onKeyDown={e => e.key === 'Enter' && handlePlaceAdminFromLanding()}
                    placeholder="••••••••" dir="ltr"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
                </div>
                {placeAdminConfirmError && <p className="text-center text-sm text-rose-400">{placeAdminConfirmError}</p>}
                <button onClick={handlePlaceAdminFromLanding} disabled={isVerifyingPlaceAdmin}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: isVerifyingPlaceAdmin ? 'rgba(212,160,23,0.3)' : 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800', boxShadow: '0 2px 14px rgba(212,160,23,0.3)' }}>
                  {isVerifyingPlaceAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  {isVerifyingPlaceAdmin ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
                </button>
                <button onClick={() => { setShowPlaceAdminLanding(false); setPlaceAdminConfirmName(''); setPlaceAdminConfirmError('') }}
                  className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Places Picker Bottom Sheet ── */}
        {showPlacesPicker && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowPlacesPicker(false)} />
            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl pb-safe" dir="rtl"
              style={{ background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', border: '1px solid rgba(212,160,23,0.2)', borderBottom: 'none' }}>
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2">
                <p className="font-bold text-white text-sm">اختر مكانك</p>
                <button onClick={() => setShowPlacesPicker(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Horizontal scroll strip */}
              <div className="px-4 pb-6 pt-2">
                {isLoadingPlaces ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <div className="h-5 w-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                    <p className="text-sm text-gray-500">جاري التحميل...</p>
                  </div>
                ) : allActivePlaces.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <span className="text-2xl">🏪</span>
                    <p className="text-sm text-gray-500">لا توجد أماكن متاحة</p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {allActivePlaces.map(place => (
                      <button
                        key={place.id}
                        onClick={() => handleSelectPlaceFromPicker(place)}
                        className="flex flex-col items-center gap-2 rounded-2xl p-3 shrink-0 w-28 text-center transition-all active:scale-95"
                        style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.25)' }}
                      >
                        <div className="h-14 w-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
                          {place.logo_url
                            ? <img src={place.logo_url} alt={place.name} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : '🏪'}
                        </div>
                        <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{place.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    )
  }

  // Login Screen
  if (!currentUser && !isDevAdmin && (isAdmin || showAdminLogin)) {
    return (
      <main className="relative min-h-screen bg-black overflow-hidden" dir="ltr" onClick={handleGlobalClick}>
        {/* Developer attribution bar */}
        <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0', textShadow: '0 0 12px rgba(212,160,23,0.8), 0 0 24px rgba(212,160,23,0.4)' }}>
              Developed by Basem Samir Ebeid
            </span>
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
          </div>
        </div>
        {/* Version tag */}
        <div className="w-full flex items-center justify-end px-4 py-2">
          <span className="text-xs text-gray-600 font-mono">V{APP_VERSION}</span>
        </div>

        <div className="relative z-10 flex min-h-[calc(100vh-32px)] items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            {/* Logo and Branding */}
            <div className="flex flex-col items-center space-y-3">
              {/* Logo with rotating golden zigzag frame */}
              <div className="relative flex items-center justify-center" style={{ width: 164, height: 164 }}>

                {/* ── Outer animated zigzag stroke ring (counter-rotates) ── */}
                <svg
                  viewBox="0 0 180 180"
                  className="animate-zigzag-ring"
                  style={{ position: 'absolute', top: -8, left: -8, width: 180, height: 180, zIndex: 0 }}
                >
                  <defs>
                    <linearGradient id="zigStrokeGoldB" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%"   stopColor="#FFF3A3" />
                      <stop offset="35%"  stopColor="#D4A017" />
                      <stop offset="65%"  stopColor="#F5D060" />
                      <stop offset="100%" stopColor="#A07010" />
                    </linearGradient>
                  </defs>
                  <polygon
                    fill="none"
                    stroke="url(#zigStrokeGoldB)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-zigzag-dash"
                    points="90,2 110.7,12.73 134,13.79 146.57,33.43 166.21,46 167.27,69.3 178,90 167.27,110.7 166.21,134 146.57,146.57 134,166.21 110.7,167.27 90,178 69.3,167.27 46,166.21 33.43,146.57 13.79,134 12.73,110.7 2,90 12.73,69.3 13.79,46 33.43,33.43 46,13.79 69.3,12.73"
                  />
                </svg>

                {/* Circular logo */}
                <div className="absolute rounded-full overflow-hidden bg-black shadow-lg" style={{ width: 128, height: 128, zIndex: 1 }}>
                  <Image
                    src="/images/qa3da-logo.jpg"
                    alt="SîpFlõw"
                    fill
                    sizes="128px"
                    style={{ objectFit: 'cover', objectPosition: 'center' }}
                  />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-4xl font-bold" style={{ color: '#C17A3A', fontFamily: 'Georgia, serif', textShadow: '0 0 24px rgba(193,122,58,0.4)', letterSpacing: '0.05em' }}>
                  SîpFlõw
                </p>
                <div className="h-0.5 w-16 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #D4A017, transparent)' }} />
                <p className="text-xs tracking-[0.25em] text-gray-400 uppercase font-medium pt-1">Powered by</p>
                <p className="text-2xl font-bold" style={{ color: '#D4A017', textShadow: '0 0 20px rgba(212,160,23,0.3)' }}>
                  SipFlow
                </p>
              </div>
            </div>

            {/* Place badge */}
            {currentPlace && (
              <div className="flex flex-col items-center gap-3">
                {/* Place logo */}
                {currentPlace.logo_url && (
                  <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 shadow-lg" style={{ borderColor: 'rgba(212,160,23,0.4)', boxShadow: '0 0 24px rgba(212,160,23,0.25)' }}>
                    <img src={currentPlace.logo_url} alt={currentPlace.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(212,160,23,0.15)', border: '1px solid rgba(212,160,23,0.3)' }}>
                  <span className="text-sm font-semibold" style={{ color: '#D4A017' }}>📍 {currentPlace.name}</span>
                  <button
                    onClick={() => { setCurrentPlace(null); localStorage.removeItem('qa3da_place'); setPlaceCode('') }}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors mr-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Welcome Header */}
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white">
                <span className="text-5xl">👋</span> Welcome Back
              </h1>
              <p className="text-center text-base font-medium" style={{ color: '#D4A017', textShadow: '0 0 16px rgba(212,160,23,0.5)' }}>
                ✨ كل SîpFlõw حكاية... وكل مشروب لحظة ✨
              </p>
            </div>

            {!isNewUser ? (
              <div className="space-y-5">
                {/* Full Name Input */}
                <div className="space-y-2">
                  <label className="text-base font-semibold text-white block text-right">Full Name</label>
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter your name"
                    className="h-14 border-0 bg-[#1a1a1a] text-white placeholder:text-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-base font-semibold text-white block text-right">Password</label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="Enter your Password"
                      className="h-14 border-0 bg-[#1a1a1a] text-white placeholder:text-gray-600 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400">
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Forgot password and Remember me */}
                <div className="flex items-center justify-between">
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    Forgot password
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-400">Remember me</span>
                    <input type="checkbox" className="w-5 h-5 rounded border-0 bg-white/10 text-blue-500 cursor-pointer" />
                  </label>
                </div>

                {loginError && (
                  <p className="text-center text-sm text-red-400">{loginError}</p>
                )}

                {/* Log In Button */}
                <Button
                  className="h-14 w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold rounded-full text-lg shadow-lg"
                  onClick={handleLogin}
                >
                  Log In
                </Button>

                {/* Sign Up Link */}
                <div className="text-center space-y-4">
                  <p className="text-gray-400">
                    <button
                      onClick={() => { setIsNewUser(true); setUserName(''); setLoginError('') }}
                      className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                    >
                      Sign Up
                    </button>
                    {' '}?Don't have an account
                  </p>

                  {/* Greeting banner */}
                  <div className="relative overflow-hidden rounded-2xl px-5 py-4"
                    style={{
                      background: 'linear-gradient(135deg, #1a0533 0%, #0d1f4f 40%, #0a2e1a 100%)',
                      boxShadow: '0 0 24px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.07)'
                    }}
                  >
                    {/* Decorative glow blobs */}
                    <div className="absolute -top-4 -left-4 h-16 w-16 rounded-full opacity-30"
                      style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }} />
                    <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full opacity-25"
                      style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full opacity-10"
                      style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />

                    {/* Stars decoration */}
                    <div className="relative flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-yellow-300 text-sm">✦</span>
                        <span className="text-purple-300 text-xs">✦</span>
                        <span className="text-blue-300 text-sm">✦</span>
                      </div>
                      <p className="text-center text-base font-bold leading-relaxed"
                        style={{
                          background: 'linear-gradient(90deg, #c084fc, #818cf8, #34d399)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none'
                        }}
                      >
                        ✨ نتمنى لكم يوماً جميلاً ✨
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-blue-300 text-xs">✦</span>
                        <span className="text-purple-300 text-sm">✦</span>
                        <span className="text-yellow-300 text-xs">✦</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Name field in signup */}
                <div>
                  <Label className="text-sm text-gray-300">Full Name *</Label>
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
                    placeholder="Enter your name"
                    className="mt-1 h-12 border-0 bg-white/10 text-white placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-300">Password *</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter Password..."
                    className="mt-1 h-12 border-0 bg-white/10 text-white placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <p className="mt-1 text-xs text-gray-500">لا أرقام متتالية (1234) · لا حروف متتالية (abcd) · لا يكون نفس اسمك</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-300">Confirm Password *</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password..."
                    className="mt-1 h-12 border-0 bg-white/10 text-white placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                {loginError && (
                  <p className="text-center text-sm text-red-400">{loginError}</p>
                )}
                <Button
                  className="h-12 w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold rounded-full text-base shadow-lg"
                  onClick={handleCreateUser}
                >
                  Create Account
                </Button>
                <Button
                  className="h-12 w-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors rounded-full text-base backdrop-blur-sm"
                  onClick={() => {
                    setIsNewUser(false)
                    setNewPassword('')
                    setConfirmPassword('')
                    setLoginError('')
                  }}
                >
                  Back
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Place Admin Confirm Dialog */}
        {showPlaceAdminConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
            <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.2)' }}>
              <div className="text-center mb-7">
                <div className="relative mx-auto mb-5 h-20 w-20">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid rgba(212,160,23,0.35)', boxShadow: '0 4px 20px rgba(212,160,23,0.15)' }}>
                    <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', boxShadow: '0 0 10px rgba(212,160,23,0.5)' }}>
                    <Settings className="h-3.5 w-3.5 text-black" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                  style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#D4A017' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  بوابة إدارة المكان
                </div>
                <h1 className="text-xl font-bold text-white">SîpFlõw · أدمن</h1>
                <p className="text-xs text-zinc-500 mt-1">أدخل بيانات حساب الأدمن للتأكيد</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم الأدمن</label>
                  <Input value={placeAdminConfirmName} onChange={e => setPlaceAdminConfirmName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePlaceAdminConfirm()}
                    placeholder="اسمك..." dir="rtl"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                  <Input type="password" value={placeAdminConfirmPwd} onChange={e => setPlaceAdminConfirmPwd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePlaceAdminConfirm()}
                    placeholder="••••••••" dir="ltr"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
                </div>
                {placeAdminConfirmError && <p className="text-center text-sm text-rose-400">{placeAdminConfirmError}</p>}
                <button onClick={handlePlaceAdminConfirm} disabled={isVerifyingPlaceAdmin}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: isVerifyingPlaceAdmin ? 'rgba(212,160,23,0.3)' : 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800', boxShadow: '0 2px 14px rgba(212,160,23,0.3)' }}>
                  {isVerifyingPlaceAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  {isVerifyingPlaceAdmin ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
                </button>
                <button onClick={() => { setShowPlaceAdminConfirm(false); setPlaceAdminConfirmName(''); setPlaceAdminConfirmError('') }}
                  className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    )
  }

  // Cashier view — full-screen cashier dashboard
  if (currentUser?.role === 'cashier' && currentPlace) {
    return (
      <CashierDashboard
        currentUser={currentUser}
        currentPlace={currentPlace}
        onLogout={handleLogout}
      />
    )
  }

  // Main App
  return (
    <main className="relative min-h-screen bg-zinc-900 overflow-hidden" onClick={handleGlobalClick} suppressHydrationWarning>
      {/* Background decorative shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      
      <div className="relative z-10">
        <Header />
      </div>

      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="sticky top-0 z-40 w-full" style={{ background: 'linear-gradient(90deg, #1a3a1a, #1f5c1f, #2a7a2a, #1f5c1f, #1a3a1a)' }}>
          <div className="flex items-center justify-between px-4 py-2.5 max-w-2xl mx-auto">
            <button
              onClick={() => { setShowUpdateBanner(false); localStorage.setItem('qa3da_app_version', APP_VERSION) }}
              className="text-green-200/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-center">
              <span className="text-sm font-semibold text-green-100">تم تحديث التطبيق بميزات جديدة</span>
              <Sparkles className="h-4 w-4 text-green-300 animate-pulse" />
            </div>
            <span className="text-xs text-green-300/60 font-mono">v{APP_VERSION}</span>
          </div>
        </div>
      )}

      {/* Messages Modal */}
      {showMessages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                رسائل من الإدارة
              </h2>
              <button
                onClick={() => setShowMessages(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 max-h-[60vh]">
              {messages.length > 0 ? messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="rounded-xl border border-primary/30 bg-primary/5 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{msg.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{msg.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleDateString('ar-EG', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismissMessage(msg.id)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                      title="تم القراءة"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد رسائل حتى الآن</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Welcome Message Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl text-center animate-in fade-in zoom-in duration-300">
            <div className="mb-4 flex justify-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-black">
                <Image 
                  src="/images/qa3da-logo.jpg" 
                  alt="SîpFlõw" 
                  fill 
                  style={{ objectFit: 'cover', objectPosition: 'center' }}
                />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">أهلاً وسهلاً</h2>
            <p className="text-xl font-semibold text-foreground mb-1">{welcomeName}</p>
            <p className="text-muted-foreground">نورت SîpFlõw!</p>
          </div>
        </div>
      )}

      {/* Dev Admin special welcome */}
      {showDevWelcome && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f0800 0%, #1a0d00 50%, #0f0800 100%)' }} dir="rtl">
          {/* Grid background */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#D4A017 1px, transparent 1px), linear-gradient(90deg, #D4A017 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* Radial glow */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, #92400e22 0%, transparent 70%)' }} />

          <div className="relative w-full max-w-xs px-6 text-center animate-in fade-in zoom-in-95 duration-700">
            {/* Corner brackets */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />

            {/* Sparkles row — top */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="text-lg" style={{ color: '#fbbf24' }}>✦</span>
              <span className="text-sm" style={{ color: '#f97316' }}>✦</span>
              <span className="text-lg" style={{ color: '#D4A017' }}>✦</span>
              <span className="text-sm" style={{ color: '#fbbf24' }}>✦</span>
              <span className="text-lg" style={{ color: '#f97316' }}>✦</span>
            </div>

            {/* Icon */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, #D4A01733 0%, transparent 70%)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              <div className="h-20 w-20 rounded-full overflow-hidden border-2" style={{ borderColor: 'rgba(212,160,23,0.5)', boxShadow: '0 0 40px #D4A01740, inset 0 1px 0 #ffffff10' }}>
                <img src="/images/qa3da-logo.jpg" alt="SîpFlõw" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Access label */}
            <p className="text-[10px] tracking-[0.5em] uppercase font-mono mb-2" style={{ color: '#D4A017' }}>✦ ACCESS GRANTED ✦</p>

            {/* Personal greeting */}
            <p className="text-sm mb-1" style={{ color: 'rgba(212,160,23,0.7)' }}>أهلاً وسهلاً يا</p>
            <h2 className="text-4xl font-black tracking-tight mb-1 leading-none" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 50%, #D4A017 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {savedDevName}
            </h2>
            <p className="text-xs mb-1" style={{ color: 'rgba(212,160,23,0.6)' }}>مرحباً بعودتك لنظام SîpFlõw</p>
            <p className="font-mono text-[10px] tracking-widest mb-5" style={{ color: 'rgba(212,160,23,0.3)' }}>SYSTEM DEVELOPER · ROOT</p>

            {/* Separator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #D4A01760)' }} />
              <div className="h-1.5 w-1.5 rotate-45" style={{ background: '#D4A017' }} />
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #D4A01760, transparent)' }} />
            </div>

            {/* Status rows */}
            <div className="space-y-2 text-right font-mono text-[11px] mb-5">
              {[
                { label: 'الأماكن', value: 'UNLOCKED', color: '#34d399' },
                { label: 'الإحصائيات', value: 'FULL ACCESS', color: '#34d399' },
                { label: 'المستخدمين', value: 'FULL ACCESS', color: '#34d399' },
                { label: 'صلاح��ة النظام', value: 'SUPERADMIN', color: '#fbbf24' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded" style={{ background: 'rgba(212,160,23,0.04)', border: '1px solid rgba(212,160,23,0.15)' }}>
                  <span style={{ color: item.color, fontSize: '10px', letterSpacing: '0.05em' }}>{item.value}</span>
                  <span style={{ color: 'rgba(212,160,23,0.7)' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Sparkles row — bottom */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-sm" style={{ color: '#f97316' }}>✦</span>
              <span className="text-lg" style={{ color: '#D4A017' }}>✦</span>
              <span className="text-sm" style={{ color: '#fbbf24' }}>✦</span>
            </div>

            {/* Footer */}
            <p className="font-mono text-[10px] tracking-widest" style={{ color: 'rgba(212,160,23,0.3)' }}>SîpFlõw · SipFlow</p>
          </div>
        </div>
      )}

      {/* Place Admin welcome */}
      {showPlaceAdminWelcome && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f0800 0%, #1a0d00 50%, #0f0800 100%)' }} dir="rtl">
          {/* Warm glow */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, #92400e22 0%, transparent 70%)' }} />

          <div className="relative w-full max-w-xs px-6 text-center animate-in fade-in zoom-in-95 duration-600">
            {/* Corner brackets — amber */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2" style={{ borderColor: 'rgba(212,160,23,0.5)' }} />

            {/* Sparkles — top */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="text-lg" style={{ color: '#fbbf24' }}>✦</span>
              <span className="text-sm" style={{ color: '#f97316' }}>✦</span>
              <span className="text-lg" style={{ color: '#D4A017' }}>✦</span>
              <span className="text-sm" style={{ color: '#fbbf24' }}>✦</span>
              <span className="text-lg" style={{ color: '#f97316' }}>✦</span>
            </div>

            {/* Icon */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, #D4A01733 0%, transparent 70%)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              <div className="h-20 w-20 rounded-full flex items-center justify-center border" style={{ borderColor: 'rgba(212,160,23,0.3)', background: 'linear-gradient(135deg, #2a1500, #3d1f00)', boxShadow: '0 0 40px #D4A01740, inset 0 1px 0 #ffffff10' }}>
                <span className="text-4xl">⚙️</span>
              </div>
            </div>

            {/* Greeting */}
            <p className="text-sm mb-1" style={{ color: 'rgba(212,160,23,0.7)' }}>أهلاً وسهلاً يا</p>
            <h2 className="text-3xl font-black tracking-tight mb-2 leading-none" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 50%, #D4A017 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {placeAdminWelcomeName}
            </h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(212,160,23,0.6)' }}>تفضل بإدارة مكانك</p>

            {/* Separator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #D4A01760)' }} />
              <div className="h-1.5 w-1.5 rotate-45" style={{ background: '#D4A017' }} />
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #D4A01760, transparent)' }} />
            </div>

            {/* Simple status */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-5" style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.15)' }}>
              <span className="text-xs font-semibold" style={{ color: '#34d399' }}>متاحة الآن</span>
              <span className="text-xs" style={{ color: 'rgba(212,160,23,0.7)' }}>لوحة الإدارة</span>
            </div>

            {/* Sparkles — bottom */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-sm" style={{ color: '#f97316' }}>✦</span>
              <span className="text-lg" style={{ color: '#D4A017' }}>✦</span>
              <span className="text-sm" style={{ color: '#fbbf24' }}>✦</span>
            </div>

            <p className="text-[10px] tracking-widest font-mono" style={{ color: 'rgba(212,160,23,0.3)' }}>SîpFlõw · SipFlow</p>
          </div>
        </div>
      )}

      {/* New Session confirmation dialog */}
      {showNewSessionConfirm && (
        <div className="fixed inset-0 z-[998] flex items-end justify-center pb-8 px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} dir="rtl">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" style={{ background: 'linear-gradient(160deg, #1a0d00, #2a1600)', border: '1px solid rgba(212,160,23,0.2)' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center border-b" style={{ borderColor: 'rgba(212,160,23,0.15)' }}>
              <div className="text-3xl mb-2">☕</div>
              <h3 className="text-lg font-bold" style={{ color: '#fbbf24' }}>SîpFlõw جديدة؟</h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(212,160,23,0.6)' }}>
                الطلبات الحالية هتتحفظ في SîpFlõw دي وتبدأ SîpFlõw جديدة منفصلة
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4">
              <button
                onClick={() => setShowNewSessionConfirm(false)}
                disabled={isCreatingNewSession}
                className="flex-1 rounded-2xl py-3 text-sm font-semibold transition-all"
                style={{ background: 'rgba(212,160,23,0.08)', color: 'rgba(212,160,23,0.7)', border: '1px solid rgba(212,160,23,0.15)' }}
              >
                لا، رجّع
              </button>
              <button
                onClick={handleNewSession}
                disabled={isCreatingNewSession}
                className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #D4A017, #f97316)', color: '#0f0800', boxShadow: '0 4px 12px rgba(212,160,23,0.3)' }}
              >
                {isCreatingNewSession ? '⏳ جاري...' : 'أيوه، ابدأ SîpFlõw جديدة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Password Modal */}
      {showArchivePasswordModal && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} dir="rtl">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" style={{ background: 'linear-gradient(160deg, #1a0d00, #2a1600)', border: '1px solid rgba(212,160,23,0.3)' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center border-b" style={{ borderColor: 'rgba(212,160,23,0.15)' }}>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(212,160,23,0.15)' }}>
                <Archive className="h-8 w-8" style={{ color: '#D4A017' }} />
              </div>
              <h3 className="text-xl font-bold" style={{ color: '#fbbf24' }}>أرشيف SîpFlõw</h3>
              <p className="text-sm mt-2" style={{ color: 'rgba(212,160,23,0.6)' }}>
                أدخل كلمة السر للوصول للـ SîpFlõw القديمة
              </p>
            </div>

            {/* Password Input */}
            <div className="p-6 space-y-4">
              <div className="relative">
                <Input
                  type="password"
                  value={archivePasswordInput}
                  onChange={e => { setArchivePasswordInput(e.target.value); setArchivePasswordError('') }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleVerifyArchivePassword()
                    }
                  }}
                  placeholder="كلمة سر الأرشيف"
                  className="h-12 text-center text-lg border-2 rounded-xl"
                  style={{ borderColor: archivePasswordError ? 'rgba(239,68,68,0.5)' : 'rgba(212,160,23,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                  autoFocus
                />
              </div>
              
              {archivePasswordError && (
                <p className="text-sm text-center" style={{ color: '#f87171' }}>{archivePasswordError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowArchivePasswordModal(false)
                    setArchivePasswordInput('')
                    setArchivePasswordError('')
                  }}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold transition-all"
                  style={{ background: 'rgba(212,160,23,0.08)', color: 'rgba(212,160,23,0.7)', border: '1px solid rgba(212,160,23,0.15)' }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleVerifyArchivePassword}
                  disabled={isVerifyingArchivePassword || !archivePasswordInput.trim()}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #D4A017, #f97316)', color: '#0f0800', boxShadow: '0 4px 12px rgba(212,160,23,0.3)' }}
                >
                  {isVerifyingArchivePassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      فتح الأرشيف
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {showDeleteSessionConfirm && sessionToDelete && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} dir="rtl">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" style={{ background: 'linear-gradient(160deg, #1a0d00, #2a1600)', border: '1px solid rgba(212,160,23,0.3)' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center border-b" style={{ borderColor: 'rgba(212,160,23,0.15)' }}>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Trash2 className="h-8 w-8" style={{ color: '#ef4444' }} />
              </div>
              <h3 className="text-xl font-bold" style={{ color: '#fbbf24' }}>حذف الجلسة</h3>
              <p className="text-sm mt-2" style={{ color: 'rgba(212,160,23,0.6)' }}>
                هل أنت متأكد من حذف هذه الـ SîpFlõw؟ سيتم حذف جميع الطلبات أيضاً
              </p>
            </div>

            {/* Session Info */}
            <div className="px-6 pt-4 pb-2">
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,160,23,0.08)' }}>
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                  SîpFlõw من {new Date(sessionToDelete.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(212,160,23,0.6)' }}>
                  {new Date(sessionToDelete.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteSessionConfirm(false)
                    setSessionToDelete(null)
                  }}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold transition-all"
                  style={{ background: 'rgba(212,160,23,0.08)', color: 'rgba(212,160,23,0.7)', border: '1px solid rgba(212,160,23,0.15)' }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDeleteSession}
                  disabled={isDeletingSession}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                >
                  {isDeletingSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-2xl p-4">
        {/* Surprise Me Modal */}
        {showSurpriseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(160deg, #1a0050, #3a0080)' }}>
              {/* Header */}
              <div className="p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #fff 0%, transparent 60%)' }} />
                <p className="text-5xl mb-2">{isSurprising ? '🎲' : '✨'}</p>
                <h2 className="text-xl font-black text-white">
                  {isSurprising ? 'جاري الاختيار...' : 'مشروبك العشوائي!'}
                </h2>
              </div>
              {/* Drink Display */}
              <div className={`mx-4 mb-4 rounded-2xl bg-white/10 p-5 text-center transition-all duration-100 ${isSurprising ? 'scale-95 opacity-70' : 'scale-100 opacity-100'}`}>
                {surpriseDrink ? (
                  <>
                    {surpriseDrink.image_url && (
                      <div className="relative w-24 h-24 mx-auto mb-3 rounded-2xl overflow-hidden">
                        <Image src={surpriseDrink.image_url} alt={surpriseDrink.name} fill className="object-cover" />
                      </div>
                    )}
                    {!surpriseDrink.image_url && <p className="text-6xl mb-3">☕</p>}
                    <h3 className="text-2xl font-black text-white mb-1">{surpriseDrink.name}</h3>
                    <p className="text-purple-200 text-lg font-bold">{surpriseDrink.price} ج.م</p>
                  </>
                ) : (
                  <p className="text-white/50 py-6">...</p>
                )}
              </div>
              {/* Actions */}
              {!isSurprising && surpriseDrink && (
                <div className="flex gap-3 p-4 pt-0">
                  <Button
                    className="flex-1 h-12 font-bold text-base rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #9000ff, #6a00cc)', color: '#fff' }}
                    onClick={() => {
                      handleAddToCart(surpriseDrink.id)
                      setShowSurpriseModal(false)
                    }}
                  >
                    أضفه للسلة 🛒
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 px-4 rounded-xl border-white/20 text-white hover:bg-white/10"
                    onClick={handleSurpriseMe}
                  >
                    🔄
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12 px-4 rounded-xl text-white/60 hover:bg-white/10"
                    onClick={() => setShowSurpriseModal(false)}
                  >
                    لأ
                  </Button>
                </div>
              )}
              {isSurprising && (
                <div className="flex justify-center p-4 pt-0">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Order Status Tracker Widget ── */}
        {showTracker && trackedOrders.length > 0 && !isDevAdmin && (() => {
          const total         = trackedOrders.length
          const deliveredCount = trackedOrders.filter(o => o.status === 'completed').length
          const onWayCount    = trackedOrders.filter(o => o.status === 'on_the_way').length
          const doneCount     = deliveredCount + onWayCount
          const prepCount     = trackedOrders.filter(o => o.status === 'preparing').length
          const allDone       = deliveredCount === total

          return (
            <>
              {/* Mini floating button when minimized */}
              {trackerMinimized && (
                <button
                  onClick={() => setTrackerMinimized(false)}
                  className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-xl border transition-all"
                  style={{ background: 'rgba(10,8,6,0.95)', borderColor: 'rgba(212,160,23,0.5)', color: '#D4A017' }}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  📍 طلبي
                  {!allDone && <span className="rounded-full bg-amber-500/20 px-1.5 text-amber-300">{total - doneCount}</span>}
                  {allDone && <span className="text-green-400">✓</span>}
                </button>
              )}

              {/* Full widget */}
              {!trackerMinimized && (
                <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:w-80" dir="rtl">
                  <div className="rounded-2xl border shadow-2xl overflow-hidden" style={{ background: 'rgba(10,8,6,0.97)', borderColor: allDone ? 'rgba(34,197,94,0.5)' : 'rgba(212,160,23,0.4)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(212,160,23,0.15)', background: allDone ? 'rgba(34,197,94,0.08)' : 'rgba(212,160,23,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${allDone ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
                        <span className="text-sm font-bold" style={{ color: allDone ? '#4ade80' : onWayCount > 0 ? '#60a5fa' : '#D4A017' }}>
                          {allDone ? 'تم التسليم ✓' : onWayCount > 0 ? 'طلبك في الطريق اليك 🚶' : 'تتبع طلبك'}
                        </span>
                      </div>
                      <button onClick={() => setTrackerMinimized(true)} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" title="تصغير">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Orders list with per-order stage bar */}
                    <div className="divide-y max-h-64 overflow-y-auto" style={{ borderColor: 'rgba(212,160,23,0.08)' }}>
                      {trackedOrders.map(o => {
                        const isDelivered  = o.status === 'completed'
                        const isOnTheWay   = o.status === 'on_the_way'
                        const isReady      = o.status === 'ready'
                        const isPreparing  = o.status === 'preparing'
                        const badgeText    = isDelivered ? 'تم التسليم ✓' : isOnTheWay ? 'في الطريق اليك 🚶' : isReady ? 'تم التحضير ✓' : isPreparing ? 'يتحضر ☕' : 'انتظار ⏳'
                        const badgeClass   = isDelivered ? 'bg-green-500/15 text-green-400' : isOnTheWay ? 'bg-blue-500/15 text-blue-400' : isReady ? 'bg-emerald-500/15 text-emerald-400' : isPreparing ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                        return (
                          <div key={o.id} className="px-4 py-3 space-y-2">
                            {/* Drink name + qty */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground truncate max-w-[55%]">
                                {o.drinkName}
                                {o.quantity > 1 && <span className="text-muted-foreground text-xs mr-1 font-normal">× {o.quantity}</span>}
                              </span>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </div>
                            {/* 4-stage progress bar */}
                            <div className="flex items-center gap-1" dir="rtl">
                              {/* Stage 1: preparing */}
                              <div className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${isPreparing || isReady || isOnTheWay || isDelivered ? 'bg-amber-500' : 'bg-amber-500/25'}`} />
                              <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-700 ${isReady || isOnTheWay || isDelivered ? 'bg-emerald-400' : isPreparing ? 'bg-amber-400' : 'bg-zinc-700'}`} />
                              {/* Stage 2: ready (bar done) */}
                              <div className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${isReady ? 'bg-emerald-400/60 animate-pulse' : isOnTheWay || isDelivered ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                              <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-700 ${isOnTheWay || isDelivered ? 'bg-blue-400' : 'bg-zinc-700'}`} />
                              {/* Stage 3: on the way */}
                              <div className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${isOnTheWay ? 'bg-blue-400/60 animate-pulse' : isDelivered ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                              <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-700 ${isDelivered ? 'bg-green-400' : 'bg-zinc-700'}`} />
                              {/* Stage 4: delivered */}
                              <div className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${isDelivered ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-zinc-800'}`} />
                            </div>
                            {/* Stage labels */}
                            <div className="flex items-center justify-between text-[9px] text-zinc-600 px-0.5" dir="rtl">
                              <span className={isPreparing ? 'text-amber-400' : isReady || isOnTheWay || isDelivered ? 'text-amber-500' : ''}>يتحضر</span>
                              <span className={isReady ? 'text-emerald-400' : isOnTheWay || isDelivered ? 'text-emerald-500/70' : ''}>تم التحضير</span>
                              <span className={isOnTheWay ? 'text-blue-400' : isDelivered ? 'text-blue-400/70' : ''}>في الطريق</span>
                              <span className={isDelivered ? 'text-green-400' : ''}>تم التسليم</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Overall summary row */}
                    <div className="px-4 py-2.5 border-t flex items-center justify-between" style={{ borderColor: 'rgba(212,160,23,0.12)', background: 'rgba(0,0,0,0.3)' }}>
                      <div className="flex gap-2 text-[11px]">
                        {prepCount > 0 && <span className="text-amber-400">☕ {prepCount} يتحضر</span>}
                        {onWayCount > 0 && <span className="text-blue-400">🚶 {onWayCount} في الطريق</span>}
                        {deliveredCount > 0 && <span className="text-green-400">✅ {deliveredCount} تسليم</span>}
                        {total - prepCount - doneCount > 0 && <span className="text-zinc-500">⏳ {total - prepCount - doneCount} انتظار</span>}
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: allDone ? '#4ade80' : '#D4A017' }}>
                        {doneCount}/{total}
                      </span>
                    </div>

                    {/* Rating section — shown when all orders delivered */}
                    {allDone && (
                      <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(212,160,23,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                        {ratingSubmitted ? (
                          <p className="text-center text-sm text-green-400 font-semibold">شكراً على تقييمك! 🎉</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-center text-xs text-zinc-400">كيف كانت تجربتك؟</p>
                            <div className="flex justify-center gap-1" dir="ltr">
                              {[1,2,3,4,5].map(star => (
                                <button
                                  key={star}
                                  onMouseEnter={() => setRatingHover(star)}
                                  onMouseLeave={() => setRatingHover(0)}
                                  onClick={async () => {
                                    setRatingValue(star)
                                    setIsSubmittingRating(true)
                                    try {
                                      await Promise.all(
                                        trackedOrders.map(o =>
                                          fetch(`/api/orders/${o.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ rating: star })
                                          })
                                        )
                                      )
                                      setRatingSubmitted(true)
                                    } catch { /* silent */ }
                                    finally { setIsSubmittingRating(false) }
                                  }}
                                  disabled={isSubmittingRating}
                                  className="text-2xl transition-transform hover:scale-125 disabled:opacity-50"
                                  style={{ color: star <= (ratingHover || ratingValue) ? '#f59e0b' : '#3f3f46' }}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {showTableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl text-center" dir="rtl">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-4xl">
                  🪑
                </div>
              </div>
              <h2 className="mb-1 text-xl font-bold text-foreground">تأكيد الطلب</h2>
              <p className="mb-5 text-sm text-muted-foreground">أدخل اسمك ورقم الطربيزة</p>
              
              {/* Customer Name Input */}
              <label className="block text-right text-sm font-semibold mb-2 text-muted-foreground">اسمك</label>
              <Input
                value={pendingCustomerName}
                onChange={(e) => { setPendingCustomerName(e.target.value); setTableModalError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmTableAndSubmit()}
                placeholder="مثال: أحمد"
                className="h-12 text-center text-lg font-bold border-2 border-amber-500/40 bg-background focus:ring-2 focus:ring-amber-500 rounded-xl mb-4"
              />
              
              {/* Table Number Input */}
              <label className="block text-right text-sm font-semibold mb-2 text-muted-foreground">رقم الطربيزة</label>
              <Input
                value={pendingTableNumber}
                onChange={(e) => { setPendingTableNumber(e.target.value); setTableModalError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmTableAndSubmit()}
                placeholder="مثال: 5"
                className="h-12 text-center text-lg font-bold border-2 border-amber-500/40 bg-background focus:ring-2 focus:ring-amber-500 rounded-xl mb-4"
              />

              {tableModalError && (
                <p className="text-sm text-red-400 mb-3">{tableModalError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-base"
                  onClick={() => handleConfirmTableAndSubmit()}
                  disabled={isSubmittingOrder}
                >
                  {isSubmittingOrder ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 px-4 rounded-xl"
                  onClick={() => setShowTableModal(false)}
                  disabled={isSubmittingOrder}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="text-center space-y-3">
              {/* Place logo above menu title */}
              {(() => {
                const logoUrl = isDevAdmin
                  ? boardDevPlaces.find(p => p.id === menuDevPlaceId)?.logo_url
                  : currentPlace?.logo_url
                if (!logoUrl) return null
                return (
                  <div className="flex justify-center">
                    <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 shadow-lg" style={{ borderColor: 'rgba(212,160,23,0.5)' }}>
                      <img src={logoUrl} alt="place logo" className="h-full w-full object-cover" />
                    </div>
                  </div>
                )
              })()}
              <h1 className="text-2xl font-bold text-foreground">منيو المشروبات</h1>
            </div>

            {/* QR table indicator — shown when table comes from QR scan */}
            {tableNumber && !isDevAdmin && (
              <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5"
                style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)' }}>
                <span className="text-lg">🪑</span>
                <span className="text-sm font-semibold" style={{ color: '#D4A017' }}>
                  طاولة رقم {tableNumber}
                </span>
                <span className="text-xs text-muted-foreground">— سيتم تسجيل طلبك تلقائياً لهذه الطاولة</span>
              </div>
            )}

            {/* Dev admin: place selector for menu */}
            {isDevAdmin && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <label className="text-sm text-muted-foreground block">اختر المكان لعرض منيو��</label>
                <select
                  value={menuDevPlaceId}
                  onChange={e => setMenuDevPlaceId(e.target.value)}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان —</option>
                  {boardDevPlaces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {/* Selected place logo */}
                {menuDevPlaceId && (() => {
                  const pl = boardDevPlaces.find(p => p.id === menuDevPlaceId)
                  if (!pl?.logo_url) return null
                  return (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="h-12 w-12 rounded-xl overflow-hidden border shrink-0" style={{ borderColor: 'rgba(212,160,23,0.4)' }}>
                        <img src={pl.logo_url} alt={pl.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#D4A017' }}>{pl.name}</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Dev admin: no place selected for menu */}
            {isDevAdmin && !menuDevPlaceId && (
              <p className="text-center text-muted-foreground py-6">اختر مكاناً لعرض منيو المشروبات</p>
            )}

            {/* Surprise Me Banner — hidden for dev admin without place */}
            {(!isDevAdmin || menuDevPlaceId) && (
            <button
              onClick={handleSurpriseMe}
              className="w-full relative overflow-hidden rounded-2xl p-4 text-right transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #1a0050, #3a0080, #6a00cc, #9000ff)' }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 0%, transparent 50%)' }} />
              <div className="relative flex items-center justify-between">
                <span className="text-4xl animate-spin" style={{ animationDuration: '3s' }}>🎲</span>
                <div className="text-right">
                  <p className="text-lg font-black text-white">مش عارف تختار؟</p>
                  <p className="text-sm text-purple-200">اضغط وهنفاجئك بمشروب عشوائي ✨</p>
                </div>
              </div>
            </button>
            )}

            {/* Category Tabs */}
            {(!isDevAdmin || menuDevPlaceId) && (
            <div className="flex gap-2 rounded-2xl bg-muted p-1.5">
              {([
                { key: 'hot', label: '☕ Hot', active: 'bg-red-500 text-white shadow-sm' },
                { key: 'cold', label: '🧊 Cold', active: 'bg-blue-500 text-white shadow-sm' },
                { key: 'shisha', label: '💨 Shisha', active: 'bg-purple-500 text-white shadow-sm' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setMenuCategory(tab.key)}
                  className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all duration-200 ${
                    menuCategory === tab.key ? tab.active : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            )}

            {(!isDevAdmin || menuDevPlaceId) && (
            <div className="grid grid-cols-2 gap-3">
              {drinks
                .filter(d => {
                  if (isDevAdmin && menuDevPlaceId && d.place_id !== menuDevPlaceId) return false
                  const cat = (d.category || '').toLowerCase()
                  const nameHasShisha = d.name?.includes('شيشة') || d.name?.toLowerCase().includes('shisha')
                  if (menuCategory === 'hot') return cat === 'hot' && !nameHasShisha
                  if (menuCategory === 'cold') return cat === 'cold' && !nameHasShisha
                  if (menuCategory === 'shisha') return cat === 'shisha' || nameHasShisha
                  return true
                })
                .map((drink) => (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    quantity={cart[drink.id] || 0}
                    stock={inventoryMap[drink.id] ?? 0}
                    note={cartNotes[drink.id] || ''}
                    onAdd={() => handleAddToCart(drink.id)}
                    onRemove={() => handleRemoveFromCart(drink.id)}
                    onNoteChange={(note) => setCartNotes(prev => ({ ...prev, [drink.id]: note }))}
                  />
                ))}
              {drinks.filter(d => {
                if (isDevAdmin && menuDevPlaceId && d.place_id !== menuDevPlaceId) return false
                const cat = (d.category || '').toLowerCase()
                const nameHasShisha = d.name?.includes('شيشة') || d.name?.toLowerCase().includes('shisha')
                if (menuCategory === 'hot') return cat === 'hot' && !nameHasShisha
                if (menuCategory === 'cold') return cat === 'cold' && !nameHasShisha
                if (menuCategory === 'shisha') return cat === 'shisha' || nameHasShisha
                return false
              }).length === 0 && (
                <div className="col-span-2 py-12 text-center text-muted-foreground">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>مفيش مشروبات في الفئة دي دلوقتي</p>
                </div>
              )}
            </div>
            )}

            {cartCount > 0 && (!isDevAdmin || menuDevPlaceId) && (
              <div className="sticky bottom-4 rounded-xl border border-border bg-card p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {cartCount} صنف في السلة
                  </span>
                  {cartTotal > 0 && (
                    <span className="font-bold text-primary">{cartTotal.toFixed(2)} ج.م</span>
                  )}
                </div>
                <Button 
                  className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSubmitOrder}
                  disabled={(!isDevAdmin && !session) || isSubmittingOrder}
                >
                  {!isDevAdmin && !session ? 'جاري تحميل الجلسة...' : 'تأكيد الطلب'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Board Tab */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {isToday && (!isDevAdmin || !!boardDevPlaceId) && (
                <button
                  onClick={() => setShowNewSessionConfirm(true)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #D4A017, #f97316)', color: '#0f0800', boxShadow: '0 2px 8px rgba(212,160,23,0.35)' }}
                >
                  <span className="text-sm">+</span>
                  SîpFlõw جديدة
                </button>
              )}
              <h1 className="text-2xl font-bold text-foreground">لوحة SîpFlõw</h1>
            </div>

            {/* Date navigator – all users (year / month / day) */}
            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)

              // Clamp a date to today if it's in the future
              const clamp = (d: Date): Date | null => {
                d.setHours(0, 0, 0, 0)
                if (d >= today) return null  // null = live today
                return d
              }

              // Last day of a given year+month
              const lastDayOf = (y: number, m: number) =>
                new Date(y, m + 1, 0).getDate()

              const yr = effectiveDate.getFullYear()
              const mo = effectiveDate.getMonth()
              const dy = effectiveDate.getDate()

              // ── Year ──────────────────────────────
              const goYearNewer = () => {
                const d = clamp(new Date(yr + 1, mo, Math.min(dy, lastDayOf(yr + 1, mo))))
                setSelectedDate(d)
              }
              const goYearOlder = () => {
                setSelectedDate(new Date(yr - 1, mo, Math.min(dy, lastDayOf(yr - 1, mo))))
              }

              // ── Month ─────────────────────────────
              const goMonthNewer = () => {
                const nm = mo === 11 ? 0 : mo + 1
                const ny = mo === 11 ? yr + 1 : yr
                const d = clamp(new Date(ny, nm, Math.min(dy, lastDayOf(ny, nm))))
                setSelectedDate(d)
              }
              const goMonthOlder = () => {
                const pm = mo === 0 ? 11 : mo - 1
                const py = mo === 0 ? yr - 1 : yr
                setSelectedDate(new Date(py, pm, Math.min(dy, lastDayOf(py, pm))))
              }

              // ── Day ───────────────────────────────
              const goNewer = () => {
                const next = new Date(effectiveDate)
                next.setDate(dy + 1)
                setSelectedDate(clamp(next))
              }
              const goOlder = () => {
                const prev = new Date(effectiveDate)
                prev.setDate(dy - 1)
                setSelectedDate(prev)
              }

              const navBtn = 'flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors'

              return (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {/* ── Year row ── */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
                    <button onClick={goYearNewer} disabled={isToday} className={navBtn}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-muted-foreground tracking-widest">{yr}</span>
                    <button onClick={goYearOlder} className={navBtn}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* ── Month row ── */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
                    <button onClick={goMonthNewer} disabled={isToday} className={navBtn}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-foreground">
                      {effectiveDate.toLocaleDateString('ar-EG', { month: 'long' })}
                    </span>
                    <button onClick={goMonthOlder} className={navBtn}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* ── Day row ── */}
                  <div className="flex items-center justify-between px-2 py-2">
                    <button onClick={goNewer} disabled={isToday} className={navBtn}>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <div className="flex flex-col items-center gap-0.5 flex-1">
                      {isToday ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-sm font-bold text-green-500">اليوم</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-foreground">
                            {effectiveDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric' })}
                          </span>
                          <button
                            onClick={() => setSelectedDate(null)}
                            className="text-[11px] text-primary hover:underline leading-none"
                          >
                            العودة لليوم
                          </button>
                        </>
                      )}
                    </div>

                    <button onClick={goOlder} className={navBtn}>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Session selector — shown when multiple sessions exist for the viewed date */}
            {(() => {
              const sessions = isDevAdmin ? boardDevSessions : dateSessions
              const selectedId = isDevAdmin ? selectedBoardDevSessionId : selectedDateSessionId
              if (sessions.length < 2) return null

              const handleSessionClick = async (sess: Session) => {
                if (isDevAdmin) {
                  setSelectedBoardDevSessionId(sess.id)
                  fetchBoardOrdersForPlace(boardDevPlaceId, selectedDate ?? new Date(), sess.id)
                } else {
                  setSelectedDateSessionId(sess.id)
                  const todayDateStr = new Date().toISOString().split('T')[0]
                  const isTodayActive = sess.is_active && effectiveDate.toISOString().split('T')[0] === todayDateStr
                  if (isTodayActive) {
                    setDateOrders(null)
                  } else {
                    setIsLoadingDateOrders(true)
                    try {
                      const res = await fetch(`/api/orders?session_id=${sess.id}`)
                      const data = await res.json()
                      setDateOrders(Array.isArray(data) ? data : [])
                    } catch { setDateOrders([]) }
                    finally { setIsLoadingDateOrders(false) }
                  }
                }
              }

              return (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {sessions.map((sess, idx) => {
                    const isSelected = selectedId === sess.id
                    const time = new Date(sess.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <button
                        key={sess.id}
                        onClick={() => handleSessionClick(sess)}
                        className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${sess.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                        <span>SîpFlõw {idx + 1}</span>
                        <span className="opacity-60">{time}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Drink Counts Button — shows total ordered items per drink */}
            {!isDevAdmin && !showArchiveView && orders.length > 0 && (
              <button
                onClick={() => setShowDrinkCountsModal(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}
              >
                <Coffee className="h-4 w-4" />
                أعداد المشاريب
                <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full px-1 text-xs font-bold"
                  style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                  {orders.reduce((s, o) => s + (o.quantity || 1), 0)}
                </span>
              </button>
            )}

            {/* Archive Button — shows for non-dev-admin users when there are archived sessions */}
            {!isDevAdmin && !showArchiveView && (
              <button
                onClick={() => {
                  if (archiveUnlocked) {
                    setShowArchiveView(true)
                  } else {
                    setArchivePasswordInput('')
                    setArchivePasswordError('')
                    setShowArchivePasswordModal(true)
                  }
                }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)', color: '#D4A017' }}
              >
                <Archive className="h-4 w-4" />
                {archiveUnlocked ? 'عرض الأرشيف' : 'الأرشيف'}
                {todaysArchivedCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold" style={{ background: 'rgba(212,160,23,0.3)', color: '#D4A017' }}>
                    {todaysArchivedCount}
                  </span>
                )}
                {!archiveUnlocked && <Lock className="h-3 w-3 opacity-60" />}
              </button>
            )}

            {/* Archive View */}
            {!isDevAdmin && showArchiveView && archiveUnlocked && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setArchiveUnlocked(false)
                        localStorage.removeItem('qa3da_archive_unlocked')
                        setShowArchiveView(false)
                        setSelectedArchivedSessionId(null)
                        setArchivedOrders([])
                      }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      style={{ color: '#D4A017' }}
                    >
                      <ChevronRight className="h-4 w-4" />
                      العودة للوحة
                    </button>
                  </div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Archive className="h-5 w-5" style={{ color: '#D4A017' }} />
                    أرشيف SîpFlõw
                  </h2>
                </div>

                {/* Fetch archived sessions on first view */}
                {archivedSessions.length === 0 && !isLoadingArchivedOrders && (
                  <div className="text-center py-8">
                    <button
                      onClick={async () => {
                        setIsLoadingArchivedOrders(true)
                        try {
                          const res = await fetch(`/api/sessions/archived${placeParam}`)
                          if (!res.ok) {
                            setArchivedSessions([])
                            return
                          }
                          const text = await res.text()
                          if (!text) {
                            setArchivedSessions([])
                            return
                          }
                          const data = JSON.parse(text)
                          setArchivedSessions(Array.isArray(data) ? data : [])
                        } catch (err) {
                          console.error('[v0] Error loading archived sessions:', err)
                          setArchivedSessions([])
                        } finally {
                          setIsLoadingArchivedOrders(false)
                        }
                      }}
                      className="flex items-center gap-2 mx-auto rounded-xl px-4 py-2 text-sm font-medium transition-all"
                      style={{ background: 'linear-gradient(135deg, #D4A017, #f97316)', color: '#0f0800' }}
                    >
                      <Archive className="h-4 w-4" />
                      تحميل SîpFlõw المؤرشفة
                    </button>
                  </div>
                )}

                {isLoadingArchivedOrders && !selectedArchivedSessionId && (
                  <div className="rounded-2xl border border-border bg-card p-10 text-center">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3" style={{ color: '#D4A017' }} />
                    <p className="text-muted-foreground text-sm">جاري تحميل الأرشيف...</p>
                  </div>
                )}

                {archivedSessions.length > 0 && !selectedArchivedSessionId && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">اختر جلسة لعرض طلباتها:</p>
                    <div className="grid gap-2">
                      {archivedSessions.map((sess, idx) => {
                        const date = new Date(sess.date)
                        const time = new Date(sess.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        const cached = sessionCustomerCache[sess.id]
                        const customerName = cached?.customerName
                        const tableNumber = cached?.tableNumber
                        const displayName = customerName && tableNumber 
                          ? `${customerName} - طاولة ${tableNumber}`
                          : customerName 
                          ? customerName
                          : tableNumber
                          ? `طاولة ${tableNumber}`
                          : `SîpFlõw ${idx + 1}`
                        return (
                          <div key={sess.id} className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                // Pre-cache customer info if not already cached
                                if (!sessionCustomerCache[sess.id]) {
                                  await cacheSessionCustomerInfo(sess.id)
                                }
                                setSelectedArchivedSessionId(sess.id)
                                setIsLoadingArchivedOrders(true)
                                try {
                                  const res = await fetch(`/api/orders?session_id=${sess.id}`)
                                  const data = await res.json()
                                  setArchivedOrders(Array.isArray(data) ? data : [])
                                } catch {
                                  setArchivedOrders([])
                                } finally {
                                  setIsLoadingArchivedOrders(false)
                                }
                              }}
                              className="flex-1 flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(212,160,23,0.15)' }}>
                                  <Coffee className="h-5 w-5" style={{ color: '#D4A017' }} />
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-left">
                                <p className="text-xs text-muted-foreground">{time}</p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sess.is_active ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>
                                  {sess.is_active ? 'نشطة' : 'منتهية'}
                                </span>
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSessionToDelete(sess)
                                setShowDeleteSessionConfirm(true)
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted transition-colors text-red-500 hover:text-red-600"
                              title="حذف هذه الجلسة"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Archived session orders view */}
                {selectedArchivedSessionId && (
                  <div className="space-y-4">
                    <button
                      onClick={() => {
                        setSelectedArchivedSessionId(null)
                        setArchivedOrders([])
                      }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                      العودة لق��ئمة الأرشيف
                    </button>

                    {isLoadingArchivedOrders ? (
                      <div className="rounded-2xl border border-border bg-card p-10 text-center">
                        <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3" style={{ color: '#D4A017' }} />
                        <p className="text-muted-foreground text-sm">جاري تحميل الطلبات...</p>
                      </div>
                    ) : archivedOrders.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-card p-8 text-center">
                        <p className="text-muted-foreground">لا توجد طلبات في هذه الـ SîpFlõw</p>
                      </div>
                    ) : (
                      <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">الأشخاص</p>
                                <p className="text-2xl font-bold text-foreground">{[...new Set(archivedOrders.map(o => o.user_id))].length}</p>
                              </div>
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                                <Users className="h-6 w-6 text-primary" />
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">الإجمالي</p>
                                <p className="text-2xl font-bold text-foreground">
                                  {archivedOrders.reduce((t, o) => t + (o.drink?.price || 0) * o.quantity, 0).toFixed(0)}
                                </p>
                              </div>
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                                <DollarSign className="h-6 w-6 text-primary" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Orders list */}
                        <div className="space-y-3">
                          {(() => {
                            const grouped = archivedOrders.reduce((acc, o) => {
                              const custName = o.customer_name?.trim()
                              const tableNum = o.table_number || o.user?.table_number
                              const key = custName
                                ? (tableNum ? `${custName}_${tableNum}` : custName)
                                : (tableNum ? `table_${tableNum}` : o.user_id || 'زائر')
                              if (!acc[key]) {
                                const displayName = custName || (tableNum ? `طاولة ${tableNum}` : 'زبون')
                                acc[key] = { orders: [], tableNum: tableNum || null, displayName }
                              }
                              acc[key].orders.push(o)
                              return acc
                            }, {} as Record<string, { orders: OrderWithDetails[]; tableNum?: string | null; displayName: string }>)

                            return Object.entries(grouped).map(([key, { orders: userOrders, tableNum, displayName }]) => {
                              const total = userOrders.reduce((s, o) => s + (o.drink?.price || 0) * o.quantity, 0)
                              return (
                                <div key={key} className="rounded-2xl border border-border bg-card overflow-hidden">
                                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-foreground">{displayName}</span>
                                      {tableNum && !displayName.startsWith('طاولة') && <span className="text-xs text-muted-foreground">- طاولة {tableNum}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">{userOrders.length} صنف</span>
                                      <span className="font-bold text-primary">{total} ج.م</span>
                                    </div>
                                  </div>
                                  <div className="divide-y divide-border">
                                    {userOrders.map(o => (
                                      <div key={o.id} className="px-4 py-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">{o.drink?.name || '—'}</span>
                                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">x{o.quantity}</span>
                                          </div>
                                          <span className="text-sm font-semibold" style={{ color: '#D4A017' }}>{(o.drink?.price || 0) * o.quantity} ج.م</span>
                                        </div>
                                        {o.notes && (
                                          <p className="text-xs text-muted-foreground mt-1">📝 {o.notes}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {new Date(o.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} - {new Date(o.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="px-4 py-3 border-t border-border bg-muted/50">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-muted-foreground">إجمالي {displayName}{tableNum && !displayName.startsWith('طاولة') ? ` - طاولة ${tableNum}` : ''}</span>
                                      <span className="text-lg font-black" style={{ color: '#D4A017' }}>{total} ج.م</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Dev admin: place selector */}
            {isDevAdmin && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <label className="text-sm text-muted-foreground block mb-2">اختر المكان لعرض قعدته</label>
                <select
                  value={boardDevPlaceId}
                  onChange={e => {
                    setBoardDevPlaceId(e.target.value)
                    fetchBoardOrdersForPlace(e.target.value)
                  }}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المك��ن —</option>
                  {boardDevPlaces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dev admin: no place selected */}
            {isDevAdmin && !boardDevPlaceId && (
              <p className="text-center text-muted-foreground py-8">اختر مكاناً لعرض SîpFlõw</p>
            )}

            {/* Dev admin: loading */}
            {isDevAdmin && boardDevPlaceId && isFetchingBoardOrders && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center">
                <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-3" />
                <p className="text-muted-foreground text-sm">جاري تحميل SîpFlõw...</p>
              </div>
            )}

            {/* Board content: show for regular users always, for dev admin after selecting place */}
            {(!isDevAdmin || (boardDevPlaceId && !isFetchingBoardOrders)) && (() => {
              const bo = isDevAdmin ? boardDevOrders : boardOrders
              // Admins (place admin or dev admin) see ALL orders; regular customers see only their table
              const isPlaceAdmin = !isDevAdmin && currentUser?.role === 'admin'
              const isAnyAdmin = isDevAdmin || isPlaceAdmin
              const tableNum = !isAnyAdmin ? currentUser?.table_number : null
              const filteredBo = tableNum
                ? bo.filter(o => o.user?.table_number === tableNum)
                : bo
              const boTotal = filteredBo.reduce((t, o) => t + (o.drink?.price || 0) * o.quantity, 0)
              const boUsers = [...new Set(filteredBo.map(o => o.user_id))].length
              return (
                <>
                  <div className="flex items-center justify-between">
                    {isAnyAdmin ? (
                      <button
                        onClick={() => setShowReceipt(true)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة الفاتورة
                      </button>
                    ) : <span />}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {isToday ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                          <span>تحديث مباشر</span>
                        </>
                      ) : isFuture ? (
                        <span>📅 يوم قادم</span>
                      ) : (
                        <span>📂 أرشيف</span>
                      )}
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">الأشخاص</p>
                          <p className="text-2xl font-bold text-foreground">{boUsers}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">الإجمالي</p>
                          <p className="text-2xl font-bold text-foreground">
                            {boTotal > 0 ? `${boTotal.toFixed(0)}` : '-'}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                          <DollarSign className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table badge — show which table is being viewed (customers only) */}
                  {!isAnyAdmin && tableNum && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="rounded-full bg-primary/15 border border-primary/30 px-4 py-1.5 text-sm font-semibold text-primary">
                        🪑 طربيزة {tableNum}
                      </span>
                    </div>
                  )}
                  {!isAnyAdmin && !tableNum && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-400">
                      اطلب مشروب وحدد رقم طربيزتك عشان تشوف قعدتك هنا
                    </div>
                  )}

                  {/* Orders */}
                  {!isDevAdmin && isFuture ? (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
                      <div className="mb-4 text-5xl">🌙</div>
                      <h3 className="text-lg font-bold text-foreground mb-2">هذا يوم جديد لم يأتِ بعد</h3>
                      <p className="text-muted-foreground text-sm">ارجع للوراء وشوف قعدات الأيام الفاتت</p>
                    </div>
                  ) : !isDevAdmin && isLoadingDateOrders ? (
                    <div className="rounded-2xl border border-border bg-card p-10 text-center">
                      <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-3" />
                      <p className="text-muted-foreground text-sm">جاري تحميل طلبات هذا اليوم...</p>
                    </div>
                  ) : (
                    <OrderBoard
                      orders={filteredBo}
                      drinks={drinks}
                      currentUser={isToday ? currentUser : null}
                      onDeleteOrder={handleDeleteOrder}
                      isAdmin={isDevAdmin}
                    />
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* Admin Tab */}
        {activeTab === 'admin' && isAdmin && (
          <AdminPanel
            drinks={drinks}
            users={users}
            orders={orders}
            onDrinkAdded={() => mutateDrinks()}
            onDrinkUpdated={() => mutateDrinks()}
            onDrinkDeleted={() => mutateDrinks()}
            onSessionReset={() => { mutateSession(); fetchOrders(); }}
            onUserPasswordReset={handleUserPasswordReset}
            onUserPasswordSet={handleUserPasswordSet}
            onUserDelete={handleUserDelete}
            onRefreshUsers={() => mutateUsers()}
            isInline={true}
            isDevAdmin={isDevAdmin}
            currentPlace={currentPlace}
            placeId={currentUser?.place_id || currentPlace?.id || null}
          />
        )}
      </div>

      {/* ── Drink Counts Modal ── */}
      {showDrinkCountsModal && (() => {
        // Group all orders by drink name and sum quantities
        const counts: Record<string, { name: string; qty: number; category: string }> = {}
        ;(orders as OrderWithDetails[]).forEach(o => {
          const name = o.drink?.name || 'غير معروف'
          const cat  = o.drink?.category || ''
          if (!counts[name]) counts[name] = { name, qty: 0, category: cat }
          counts[name].qty += (o.quantity || 1)
        })
        const sorted = Object.values(counts).sort((a, b) => b.qty - a.qty)
        const totalQty = sorted.reduce((s, d) => s + d.qty, 0)
        const catIcon = (c: string) => c === 'hot' ? '☕' : c === 'cold' ? '🧊' : c === 'shisha' ? '💨' : '🍹'

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4" dir="rtl"
            onClick={() => setShowDrinkCountsModal(false)}>
            <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: '#0c0c1a', border: '1px solid rgba(56,189,248,0.25)', maxHeight: '85vh' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(14,165,233,0.05))', borderBottom: '1px solid rgba(56,189,248,0.15)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
                    <Coffee className="h-4.5 w-4.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">أعداد المشاريب</p>
                    <p className="text-[10px] text-zinc-500">{sorted.length} صنف · {totalQty} وحدة</p>
                  </div>
                </div>
                <button onClick={() => setShowDrinkCountsModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  ✕
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                {sorted.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">لا توجد طلبات بعد</p>
                ) : sorted.map((d, i) => {
                  const pct = Math.round((d.qty / totalQty) * 100)
                  return (
                    <div key={d.name} className="rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{catIcon(d.category)}</span>
                          <span className="text-sm font-semibold text-white">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">{pct}%</span>
                          <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full px-2 text-xs font-black"
                            style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>
                            {d.qty}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Receipt Modal */}
      {showReceipt && (
        <ReceiptModal
          orders={orders}
          drinks={drinks}
          currentUser={currentUser}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Floating Admin Message */}
      {floatingMessage && currentUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-2xl border-2 border-primary bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-primary px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-primary-foreground" />
                <h3 className="text-lg font-bold text-primary-foreground">رسالة من الإدارة</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {floatingMessage.title && (
                <h4 className="text-xl font-bold text-foreground text-center">{floatingMessage.title}</h4>
              )}
              <p className="text-lg text-muted-foreground text-center leading-relaxed">{floatingMessage.message}</p>
            </div>
            <div className="px-6 pb-6">
              <Button 
                onClick={dismissFloatingMessage}
                className="w-full h-12 text-lg font-bold"
              >
                حسناً، فهمت
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Place Admin Confirm Dialog (main app) */}
      {showPlaceAdminConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
          <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.2)' }}>
            <div className="text-center mb-7">
              <div className="relative mx-auto mb-5 h-20 w-20">
                <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid rgba(212,160,23,0.35)', boxShadow: '0 4px 20px rgba(212,160,23,0.15)' }}>
                  <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                </div>
                <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', boxShadow: '0 0 10px rgba(212,160,23,0.5)' }}>
                  <Settings className="h-3.5 w-3.5 text-black" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#D4A017' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                بوابة إدارة المكان
              </div>
              <h1 className="text-xl font-bold text-white">SîpFlõw · أدمن</h1>
              <p className="text-xs text-zinc-500 mt-1">أدخل بيانات حساب الأدمن للتأكيد</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم الأدمن</label>
                <Input value={placeAdminConfirmName} onChange={e => setPlaceAdminConfirmName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePlaceAdminConfirm()}
                  placeholder="اسمك..." dir="rtl"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                <Input type="password" value={placeAdminConfirmPwd} onChange={e => setPlaceAdminConfirmPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePlaceAdminConfirm()}
                  placeholder="••••••••" dir="ltr"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50" />
              </div>
              {placeAdminConfirmError && <p className="text-center text-sm text-rose-400">{placeAdminConfirmError}</p>}
              <button onClick={handlePlaceAdminConfirm} disabled={isVerifyingPlaceAdmin}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: isVerifyingPlaceAdmin ? 'rgba(212,160,23,0.3)' : 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800', boxShadow: '0 2px 14px rgba(212,160,23,0.3)' }}>
                {isVerifyingPlaceAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                {isVerifyingPlaceAdmin ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
              </button>
              <button onClick={() => { setShowPlaceAdminConfirm(false); setPlaceAdminConfirmName(''); setPlaceAdminConfirmError('') }}
                className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toaster 
        position="top-center" 
        richColors 
        toastOptions={{
          style: {
            direction: 'rtl'
          }
        }}
      />

      {/* ✦ Falling Stars Effect */}
      {showStars && (
        <>
          <style>{`
            @keyframes starFall {
              0%   { transform: translateY(-60px) rotate(0deg); opacity: 0; }
              10%  { opacity: 1; }
              90%  { opacity: 1; }
              100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
            }
            @keyframes starFallSide {
              0%   { transform: translateY(-60px) translateX(0px) rotate(0deg); opacity: 0; }
              10%  { opacity: 1; }
              50%  { transform: translateY(55vh) translateX(18px) rotate(180deg); opacity: 1; }
              90%  { opacity: 0.8; }
              100% { transform: translateY(110vh) translateX(-12px) rotate(360deg); opacity: 0; }
            }
          `}</style>
          <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
            {[
              { x: 5,  size: 16, delay: 0,    dur: 2.2, char: '✦' },
              { x: 12, size: 10, delay: 0.15, dur: 1.8, char: '★' },
              { x: 20, size: 18, delay: 0.3,  dur: 2.5, char: '✦' },
              { x: 28, size: 12, delay: 0.05, dur: 2.0, char: '⭐' },
              { x: 35, size: 14, delay: 0.4,  dur: 1.9, char: '✦' },
              { x: 42, size: 20, delay: 0.1,  dur: 2.3, char: '★' },
              { x: 50, size: 11, delay: 0.55, dur: 2.1, char: '✦' },
              { x: 58, size: 15, delay: 0.25, dur: 1.7, char: '⭐' },
              { x: 65, size: 13, delay: 0.35, dur: 2.4, char: '✦' },
              { x: 72, size: 18, delay: 0,    dur: 2.0, char: '★' },
              { x: 80, size: 10, delay: 0.45, dur: 1.8, char: '✦' },
              { x: 88, size: 16, delay: 0.2,  dur: 2.2, char: '⭐' },
              { x: 94, size: 12, delay: 0.6,  dur: 1.9, char: '✦' },
              { x: 8,  size: 14, delay: 0.7,  dur: 2.3, char: '★' },
              { x: 25, size: 19, delay: 0.5,  dur: 1.6, char: '✦' },
              { x: 45, size: 11, delay: 0.65, dur: 2.1, char: '⭐' },
              { x: 62, size: 17, delay: 0.8,  dur: 2.4, char: '✦' },
              { x: 75, size: 13, delay: 0.35, dur: 1.8, char: '★' },
              { x: 90, size: 15, delay: 0.9,  dur: 2.0, char: '✦' },
              { x: 55, size: 22, delay: 0.15, dur: 2.6, char: '⭐' },
            ].map((star, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${star.x}%`,
                  top: '-40px',
                  fontSize: `${star.size}px`,
                  color: i % 3 === 0 ? '#D4A017' : i % 3 === 1 ? '#fbbf24' : '#fff7d6',
                  filter: `drop-shadow(0 0 6px ${i % 3 === 0 ? '#D4A017' : '#fbbf24'}) drop-shadow(0 0 12px rgba(212,160,23,0.6))`,
                  animation: `${i % 2 === 0 ? 'starFall' : 'starFallSide'} ${star.dur}s ${star.delay}s ease-in forwards`,
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {star.char}
              </span>
            ))}
          </div>
        </>
      )}

    </main>
  )
}
