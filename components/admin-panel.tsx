'use client';

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Drink, User, OrderWithDetails, Place, Reservation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Pencil, Upload, RefreshCw, Users, Coffee, Key, BarChart3, TrendingUp, Award, Clock, Send, MessageSquare, Settings2, Hash, UserPlus, UserCog, Minus, Package, Banknote, CheckCircle2, Hourglass, TableProperties, Copy, ExternalLink, Link2, Eye, EyeOff, QrCode, CalendarDays, CalendarCheck, CalendarX, Download, Loader2, Activity } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import Image from 'next/image'
import { CommandCenter } from '@/components/command-center'



interface AdminPanelProps {
  drinks: Drink[]
  users: User[]
  orders: OrderWithDetails[]
  onDrinkAdded: () => void
  onDrinkUpdated: () => void
  onDrinkDeleted: () => void
  onSessionReset: () => void
  onUserPasswordReset: (userId: string) => void
  onUserPasswordSet: (userId: string, password: string) => void
  onUserDelete: (userId: string) => void
  onRefreshUsers?: () => void
  isInline?: boolean
  isDevAdmin?: boolean
  currentPlace?: { id: string; name: string; code: string } | null
  placeId?: string | null
}

const formatDisplayName = (name: string | null | undefined, tableNumber: string | null | undefined): string => {
  if (!name) return '—'
  if (name.startsWith('Guest-') && tableNumber) return `طاولة ${tableNumber}`
  return name
}

export function AdminPanel({ 
  drinks, 
  users,
  orders,
  onDrinkAdded, 
  onDrinkUpdated, 
  onDrinkDeleted, 
  onSessionReset,
  onUserPasswordReset,
  onUserPasswordSet,
  onUserDelete,
  onRefreshUsers,
  isInline = false,
  isDevAdmin = false,
  currentPlace = null,
  placeId = null
}: AdminPanelProps) {
  // Add drink state
  const [newDrinkName, setNewDrinkName] = useState('')
  const [newDrinkPrice, setNewDrinkPrice] = useState('')
  const [newDrinkImage, setNewDrinkImage] = useState<string | null>(null)
  const [newDrinkCategory, setNewDrinkCategory] = useState<'hot' | 'cold' | 'shisha'>('hot')
  const [newDrinkInitialStock, setNewDrinkInitialStock] = useState('100')
  const [devDrinkPlaceId, setDevDrinkPlaceId] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [allDrinksStats, setAllDrinksStats] = useState<{ total: number; byCategory: Record<string, number> } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

  const defaultHours: Record<string, { from: string; to: string }> = {
    "السبت":    { from: "10:00", to: "23:00" },
    "الأحد":    { from: "10:00", to: "23:00" },
    "الإثنين":  { from: "10:00", to: "23:00" },
    "الثلاثاء": { from: "10:00", to: "23:00" },
    "الأربعاء": { from: "10:00", to: "23:00" },
    "الخميس":   { from: "10:00", to: "23:00" },
    "الجمعة":   { from: "10:00", to: "23:00" },
  }
  const defaultEnabled: Record<string, boolean> = {
    "السبت": true, "الأحد": true, "الإثنين": true, "الثلاثاء": true,
    "الأربعاء": false, "الخميس": true, "الجمعة": true,
  }

  const [hours, setHours] = useState<Record<string, { from: string; to: string }>>(defaultHours)
  const [enabledDays, setEnabledDays] = useState<Record<string, boolean>>(defaultEnabled)

  // Refs always hold the latest values — prevents stale-closure bug in async save handler
  const hoursRef = useRef(hours)
  const enabledDaysRef = useRef(enabledDays)
  hoursRef.current = hours
  enabledDaysRef.current = enabledDays

  const [workingHoursPlaceId, setWorkingHoursPlaceId] = useState('')
  const [isSavingHours, setIsSavingHours] = useState(false)
  const [isLoadingHours, setIsLoadingHours] = useState(false)

  const loadWorkingHours = async (pid: string) => {
    if (!pid) return
    setIsLoadingHours(true)
    try {
      const res = await fetch(`/api/settings?key=working_hours_${pid}`)
      const data = await res.json()
      if (data.value) {
        const parsed = JSON.parse(data.value)
        const newHours: Record<string, { from: string; to: string }> = {}
        const newEnabled: Record<string, boolean> = {}
        for (const day of DAYS) {
          newHours[day] = { from: parsed[day]?.from || "10:00", to: parsed[day]?.to || "23:00" }
          newEnabled[day] = typeof parsed[day]?.enabled === 'boolean' ? parsed[day].enabled : true
        }
        setHours(newHours)
        setEnabledDays(newEnabled)
        hoursRef.current = newHours
        enabledDaysRef.current = newEnabled
      }
    } catch { /* silent */ }
    finally { setIsLoadingHours(false) }
  }

  const handleSaveWorkingHours = async () => {
    const targetId = isDevAdmin ? workingHoursPlaceId : placeId
    if (!targetId) { toast.error('اختر المكان أولاً'); return }
    setIsSavingHours(true)
    try {
      // Read from refs to guarantee we get the absolute latest values
      const latestHours = hoursRef.current
      const latestEnabled = enabledDaysRef.current
      const payload: Record<string, { from: string; to: string; enabled: boolean }> = {}
      for (const day of DAYS) {
        payload[day] = { ...latestHours[day], enabled: latestEnabled[day] }
      }
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `working_hours_${targetId}`, value: JSON.stringify(payload) })
      })
      if (res.ok) {
        toast.success('تم حفظ ساعات العمل ✅')
      } else {
        toast.error('حدث خطأ أثناء الحفظ')
      }
    } catch { toast.error('تعذر الاتصال بالخادم') }
    finally { setIsSavingHours(false) }
  }

  useEffect(() => {
    if (!isDevAdmin && placeId) loadWorkingHours(placeId)
  }, [placeId]);
  // User password state
  const [settingPasswordForUser, setSettingPasswordForUser] = useState<User | null>(null)
  const [newUserPassword, setNewUserPassword] = useState('')
  const [confirmUserPassword, setConfirmUserPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [showAdminPass, setShowAdminPass] = useState(false)
  const [revealedPassUserId, setRevealedPassUserId] = useState<string | null>(null)

  // Create user state (dev admin)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [createUserName, setCreateUserName] = useState('')
  const [createUserPassword, setCreateUserPassword] = useState('')
  const [createUserConfirmPass, setCreateUserConfirmPass] = useState('')
  const [createUserPlaceId, setCreateUserPlaceId] = useState('')
  const [createUserTableNum, setCreateUserTableNum] = useState('')
  const [createUserError, setCreateUserError] = useState('')
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [showCreatePass, setShowCreatePass] = useState(false)

  // Admin tabs controlled state
  const [activeAdminTab, setActiveAdminTab] = useState(isDevAdmin ? 'command-center' : 'stats')
  const [staffUrlCopied, setStaffUrlCopied] = useState(false)
  const [staffOrigin, setStaffOrigin] = useState('')

  useEffect(() => {
    setStaffOrigin(window.location.origin)
    fetchStaffUsers()
  }, [])

  const handleCopyStaffUrl = () => {
    const url = `${window.location.origin}/staff`
    navigator.clipboard.writeText(url).then(() => {
      setStaffUrlCopied(true)
      setTimeout(() => setStaffUrlCopied(false), 2500)
    })
  }

  // Edit drink state
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editImage, setEditImage] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Inventory state
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({})
  const [lowStockThreshold, setLowStockThreshold] = useState(10)

  // Table map state
  const [placeTableCount, setPlaceTableCount] = useState(0)

  // Fetch inventory for all drinks
  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory')
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, number> = {}
        data.forEach((item: { drink_id: string; quantity: number }) => {
          map[item.drink_id] = item.quantity
        })
        setInventoryMap(map)
      }
    } catch (err) {
      console.error('Error fetching inventory:', err)
    }
  }

  // Update inventory for a drink
  const updateInventory = async (drinkId: string, quantity: number) => {
    try {
      await fetch(`/api/inventory/${drinkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      })
      setInventoryMap(prev => ({ ...prev, [drinkId]: quantity }))
    } catch (err) {
      console.error('Error updating inventory:', err)
    }
  }

  // ── Fetch global banner settings (dev admin) ──
  const fetchGlobalBanner = async () => {
    try {
      const [enRes, txtRes, colRes] = await Promise.all([
        fetch('/api/settings?key=global_banner_enabled'),
        fetch('/api/settings?key=global_banner_text'),
        fetch('/api/settings?key=global_banner_color'),
      ])
      if (enRes.ok) { const d = await enRes.json(); setGlobalBannerEnabled(d.value === 'true') }
      if (txtRes.ok) { const d = await txtRes.json(); if (d.value) setGlobalBannerText(d.value) }
      if (colRes.ok) { const d = await colRes.json(); if (d.value) setGlobalBannerColor(d.value) }
    } catch {}
  }

  // ── Save global banner ──
  const handleSaveBanner = async () => {
    setIsSavingBanner(true)
    try {
      await Promise.all([
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'global_banner_enabled', value: globalBannerEnabled.toString() }) }),
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'global_banner_text', value: globalBannerText }) }),
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'global_banner_color', value: globalBannerColor }) }),
      ])
      toast.success('تم حفظ البنر العالمي')
    } catch { toast.error('خطأ في حفظ البنر') }
    finally { setIsSavingBanner(false) }
  }

  // ── Clone place ──
  const handleClonePlace = async () => {
    if (!cloneSourceId || !cloneNewName.trim() || !cloneNewCode.trim()) {
      toast.error('اختر مكان المصدر وأدخل الاسم والكود')
      return
    }
    setIsCloningPlace(true)
    try {
      const res = await fetch('/api/places/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_place_id: cloneSourceId, new_name: cloneNewName, new_code: cloneNewCode })
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل نسخ المكان'); return }
      toast.success(`تم نسخ المكان بنجاح — ${data.drinks_copied} مشروب تم نسخه`)
      setCloneNewName('')
      setCloneNewCode('')
      setCloneSourceId('')
      fetchPlaces()
    } catch { toast.error('خطأ في نسخ المكان') }
    finally { setIsCloningPlace(false) }
  }

  // ── Broadcast message to all places ──
  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) { toast.error('أدخل العنوان والرسالة'); return }
    if (places.length === 0) { toast.error('لا توجد أماكن'); return }
    setIsBroadcasting(true)
    try {
      await Promise.all(
        places.map(p =>
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: broadcastTitle.trim(), message: broadcastMsg.trim(), place_id: p.id, is_from_admin: true })
          })
        )
      )
      toast.success(`تم إرسال الرسالة لـ ${places.length} مكان`)
      setBroadcastTitle('')
      setBroadcastMsg('')
    } catch { toast.error('خطأ في إرسال الرسائل') }
    finally { setIsBroadcasting(false) }
  }

  // ── Delete old sessions (dev admin) ──
  const handleDeleteOldData = async () => {
    setIsDeletingOldData(true)
    setBulkDeleteResult(null)
    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' },
        body: JSON.stringify({ action: 'delete_old', months: parseInt(bulkDeleteMonths, 10) })
      })
      const data = await res.json()
      if (!res.ok) { toast.error('خطأ في الحذف'); return }
      setBulkDeleteResult(`تم حذف ${data.deleted_sessions} جلسة قديمة`)
      toast.success(`تم حذف ${data.deleted_sessions} جلسة قديمة وطلباتها`)
    } catch { toast.error('خطأ في حذف البيانات') }
    finally { setIsDeletingOldData(false) }
  }

  // Fetch place closed status
  const fetchClosedStatus = async () => {
    if (!placeId) return
    try {
      const [closedRes, msgRes] = await Promise.all([
        fetch(`/api/settings?key=place_closed_${placeId}`),
        fetch(`/api/settings?key=place_closed_message_${placeId}`)
      ])
      if (closedRes.ok) { const d = await closedRes.json(); setIsPlaceClosed(d.value === 'true') }
      if (msgRes.ok) { const d = await msgRes.json(); if (d.value) setPlaceClosedMsg(d.value) }
    } catch {}
  }

  // Fetch table count for table map
  const fetchPlaceTableCount = async () => {
    if (!placeId) return
    try {
      const res = await fetch(`/api/places/${placeId}`)
      if (res.ok) {
        const data = await res.json()
        setPlaceTableCount(data.table_count || 0)
      }
    } catch (err) {
      console.error('Error fetching place details:', err)
    }
  }

  // Message state
  const [messageTitle, setMessageTitle] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [msgDevPlaceId, setMsgDevPlaceId] = useState<string>('')
  const [msgDevPlaceIds, setMsgDevPlaceIds] = useState<string[]>([])

  // Clients state (dev admin only)
  const [clients, setClients] = useState<{ id: string; name: string; phone: string | null; place_name: string | null; subscription: string; notes: string | null; created_at: string }[]>([])
  const [isFetchingClients, setIsFetchingClients] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientPlace, setNewClientPlace] = useState('')
  const [newClientSub, setNewClientSub] = useState<'monthly' | 'owned'>('monthly')
  const [newClientNotes, setNewClientNotes] = useState('')
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [clientsError, setClientsError] = useState('')
  const [resetPlaceId, setResetPlaceId] = useState<string>('')
  const [showFullResetConfirm, setShowFullResetConfirm] = useState(false)
  const [isFullResetting, setIsFullResetting] = useState(false)
  const [statsPlaceId, setStatsPlaceId] = useState<string>('')
  const [inventoryDevPlaceId, setInventoryDevPlaceId] = useState<string>('')
  const [statsOrders, setStatsOrders] = useState<typeof orders>([])
  // Count tab state (dev admin)
  const [countPlaceId, setCountPlaceId] = useState<string>('')
  const [countOrders, setCountOrders] = useState<typeof orders>([])
  const [isFetchingCount, setIsFetchingCount] = useState(false)
  const [isFetchingStats, setIsFetchingStats] = useState(false)
  const [cashierPlaceId, setCashierPlaceId] = useState<string>('')
  const [cashierOrders, setCashierOrders] = useState<typeof orders>([])
  const [isFetchingCashier, setIsFetchingCashier] = useState(false)
  const [paidTables, setPaidTables] = useState<Set<string>>(new Set())
  const [cashierNewName, setCashierNewName] = useState('')
  const [cashierNewPwd, setCashierNewPwd] = useState('')
  const [cashierUserPlaceId, setCashierUserPlaceId] = useState<string>('')
  const [isCreatingCashierUser, setIsCreatingCashierUser] = useState(false)
  const [cashierUserError, setCashierUserError] = useState('')
  const [cashierUserSuccess, setCashierUserSuccess] = useState('')
  const [cashierUsers, setCashierUsers] = useState<User[]>([])
  const [isFetchingCashierUsers, setIsFetchingCashierUsers] = useState(false)
  const [tableNewNumber, setTableNewNumber] = useState('')
  const [tableNewPlaceId, setTableNewPlaceId] = useState('')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableError, setTableError] = useState('')
  const [tableSuccess, setTableSuccess] = useState('')
  const [feeSettingsPlaceId, setFeeSettingsPlaceId] = useState('')
  const [feeServiceCharge, setFeeServiceCharge] = useState('')
  const [feeTaxRate, setFeeTaxRate] = useState('')
  const [isSavingFees, setIsSavingFees] = useState(false)
  const [feeSaveSuccess, setFeeSaveSuccess] = useState('')
  const [feeSaveError, setFeeSaveError] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [isDeletingMessages, setIsDeletingMessages] = useState(false)
  const [messagesDeleted, setMessagesDeleted] = useState(false)

  // QR code state
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrTableInfo, setQrTableInfo] = useState<{ tableNumber: string; placeCode: string; placeName: string } | null>(null)
  // Tables management (QR manager)
  const [tablesPlaceId, setTablesPlaceId] = useState('')
  const [tableUsers, setTableUsers] = useState<User[]>([])
  const [isFetchingTableUsers, setIsFetchingTableUsers] = useState(false)
  // Reservations state
  const [reservationsPlaceId, setReservationsPlaceId] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isFetchingReservations, setIsFetchingReservations] = useState(false)
  const [reservationsEnabledMap, setReservationsEnabledMap] = useState<Record<string, boolean>>({})
  const [isSavingResEnabled, setIsSavingResEnabled] = useState(false)
  const [confirmingReservId, setConfirmingReservId] = useState<string | null>(null)
  const [reservTableInputId, setReservTableInputId] = useState<string | null>(null)
  const [reservTableNumbers, setReservTableNumbers] = useState<Record<string, string>>({})
  const [orderTrackingMap, setOrderTrackingMap] = useState<Record<string, boolean>>({})
  const [isSavingTracking, setIsSavingTracking] = useState(false)

  // Analytics state
  type AnalyticsData = {
    global: boolean
    period: string
    totalRevenue: number
    totalOrders: number
    totalSessions?: number
    avgOrderValue?: number
    topDrinks: { name: string; qty: number; revenue: number }[]
    peakHours: { hour: number; count: number }[]
    dailyRevenue?: { day: string; revenue: number; orders: number }[]
    placeComparison?: { id: string; name: string; totalOrders: number; totalRevenue: number; totalSessions: number }[]
  }
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [analyticsPlaceId, setAnalyticsPlaceId] = useState<string>('')
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false)

  // Dev notifications state (for dev admin)
  interface DevNotif {
    id: string
    place_id: string
    place_name: string
    action: string
    details: string | null
    is_read: boolean
    created_at: string
  }
  const [devNotifs, setDevNotifs] = useState<DevNotif[]>([])
  const [devNotifsUnread, setDevNotifsUnread] = useState(0)
  const [isClearingNotifs, setIsClearingNotifs] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setCurrentDate(now.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Settings state
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Archive password state (dev admin only)
  const [archivePassword, setArchivePassword] = useState('')
  const [archivePasswordConfirm, setArchivePasswordConfirm] = useState('')
  const [isSavingArchivePassword, setIsSavingArchivePassword] = useState(false)
  const [archivePasswordError, setArchivePasswordError] = useState('')
  const [archivePasswordSuccess, setArchivePasswordSuccess] = useState('')
  const [showArchivePassword, setShowArchivePassword] = useState(false)

  // Place closed mode state
  const [isPlaceClosed, setIsPlaceClosed] = useState(false)
  const [placeClosedMsg, setPlaceClosedMsg] = useState('المكان مغلق حالياً، نعتذر عن الإزعاج')
  const [isSavingClosedStatus, setIsSavingClosedStatus] = useState(false)

  // ── Dev admin exclusive states ──
  // Clone place
  const [cloneSourceId, setCloneSourceId] = useState('')
  const [cloneNewName, setCloneNewName] = useState('')
  const [cloneNewCode, setCloneNewCode] = useState('')
  const [isCloningPlace, setIsCloningPlace] = useState(false)

  // Bulk delete old data
  const [bulkDeleteMonths, setBulkDeleteMonths] = useState('3')
  const [isDeletingOldData, setIsDeletingOldData] = useState(false)
  const [bulkDeleteResult, setBulkDeleteResult] = useState<string | null>(null)

  // Global banner
  const [globalBannerEnabled, setGlobalBannerEnabled] = useState(false)
  const [globalBannerText, setGlobalBannerText] = useState('')
  const [globalBannerColor, setGlobalBannerColor] = useState('amber')
  const [isSavingBanner, setIsSavingBanner] = useState(false)

  // Broadcast message
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)

  // Staff users state
  interface StaffUser {
    id: string
    username: string
    password: string
    name: string
    is_active: boolean
    created_at: string
    place_id?: string | null
    role?: string
  }
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])

  // Cashier form
  const [newStaffUsername, setNewStaffUsername] = useState('')
  const [newStaffPassword, setNewStaffPassword] = useState('')
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffPlaceId, setNewStaffPlaceId] = useState('')
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [staffAdded, setStaffAdded] = useState(false)

  // Waiter form
  const [newWaiterUsername, setNewWaiterUsername] = useState('')
  const [newWaiterPassword, setNewWaiterPassword] = useState('')
  const [newWaiterName, setNewWaiterName] = useState('')
  const [newWaiterPlaceId, setNewWaiterPlaceId] = useState('')
  const [isAddingWaiter, setIsAddingWaiter] = useState(false)
  const [waiterAdded, setWaiterAdded] = useState(false)
  const [waiterError, setWaiterError] = useState('')
  const [waiterUrlCopied, setWaiterUrlCopied] = useState(false)

  // Fetch staff users
  const fetchStaffUsers = async () => {
    const res = await fetch('/api/staff')
    const data = await res.json()
    setStaffUsers(data || [])
  }

  const handleAddStaffUser = async () => {
    if (!newStaffUsername.trim() || !newStaffPassword.trim() || !newStaffName.trim()) return
    setIsAddingStaff(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newStaffUsername.trim(),
          password: newStaffPassword.trim(),
          name: newStaffName.trim(),
          place_id: isDevAdmin ? (newStaffPlaceId || null) : (placeId || null),
          role: 'cashier'
        })
      })
      if (res.ok) {
        notifyDev('إضافة موظف جديد (كاشير)', `الاسم: ${newStaffName.trim()} — المستخدم: ${newStaffUsername.trim()}`)
        setNewStaffUsername('')
        setNewStaffPassword('')
        setNewStaffName('')
        setStaffAdded(true)
        setTimeout(() => setStaffAdded(false), 3000)
        fetchStaffUsers()
      }
    } catch (err) {
      console.error('Error adding staff user:', err)
    } finally {
      setIsAddingStaff(false)
    }
  }

  const handleAddWaiter = async () => {
    if (!newWaiterUsername.trim() || !newWaiterPassword.trim() || !newWaiterName.trim()) return
    setIsAddingWaiter(true)
    setWaiterError('')
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newWaiterUsername.trim(),
          password: newWaiterPassword.trim(),
          name: newWaiterName.trim(),
          place_id: isDevAdmin ? (newWaiterPlaceId || null) : (placeId || null),
          role: 'waiter'
        })
      })
      if (res.ok) {
        notifyDev('إضافة ويتر جديد', `الاسم: ${newWaiterName.trim()} — المستخدم: ${newWaiterUsername.trim()}`)
        setNewWaiterUsername('')
        setNewWaiterPassword('')
        setNewWaiterName('')
        setWaiterAdded(true)
        setTimeout(() => setWaiterAdded(false), 3000)
        fetchStaffUsers()
      } else {
        const errData = await res.json().catch(() => ({}))
        setWaiterError(errData?.error || 'فشل إضافة الويتر — اسم المستخدم موجود بالفعل أو حدث خطأ')
      }
    } catch (err) {
      console.error('Error adding waiter:', err)
      setWaiterError('حدث خطأ في الاتصال — حاول تاني')
    } finally {
      setIsAddingWaiter(false)
    }
  }

  const handleDeleteStaffUser = async (staffId: string) => {
    await fetch(`/api/staff/${staffId}`, { method: 'DELETE' })
    fetchStaffUsers()
  }

  const handleToggleStaffActive = async (staffId: string, isActive: boolean) => {
    await fetch(`/api/staff/${staffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive })
    })
    fetchStaffUsers()
  }

  const handleFileUpload = async (file: File, isEdit: boolean = false) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) throw new Error('Upload failed')
      
      const { url } = await response.json()
      if (isEdit) {
        setEditImage(url)
      } else {
        setNewDrinkImage(url)
      }
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddDrink = async () => {
    if (!newDrinkName.trim()) return
    if (isDevAdmin && !devDrinkPlaceId) return
    
    const effectivePlaceId = isDevAdmin ? devDrinkPlaceId : (placeId || null)
    const initialStock = parseInt(newDrinkInitialStock) || 0

    const res = await fetch('/api/drinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDrinkName.trim(),
        price: parseFloat(newDrinkPrice) || 0,
        image_url: newDrinkImage,
        category: newDrinkCategory,
        sort_order: drinks.length + 1,
        place_id: effectivePlaceId
      })
    })
    
    if (res.ok) {
      const newDrink = await res.json()
      // Initialize inventory for the new drink
      await fetch(`/api/inventory/${newDrink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: initialStock })
      })
      setNewDrinkName('')
      setNewDrinkPrice('')
      setNewDrinkImage(null)
      setNewDrinkCategory('hot')
      setNewDrinkInitialStock('100')
      onDrinkAdded()
      notifyDev('إضافة صنف جديد', `"${newDrinkName.trim()}" — السعر: ${newDrinkPrice || '0'}`)
    }
  }

  const handleEditDrink = async () => {
    if (!editingDrink || !editName.trim()) return
    
    const res = await fetch(`/api/drinks/${editingDrink.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        price: parseFloat(editPrice) || 0,
        image_url: editImage
      })
    })
    
    if (res.ok) {
      notifyDev('تعديل صنف', `"${editName.trim()}" — السعر الجديد: ${editPrice || '0'}`)
      setEditingDrink(null)
      setEditDialogOpen(false)
      onDrinkUpdated()
    }
  }

  const handleDeleteDrink = async (drinkId: string) => {
    const drink = drinks.find(d => d.id === drinkId)
    const res = await fetch(`/api/drinks/${drinkId}`, { method: 'DELETE' })
    if (res.ok) {
      notifyDev('حذف صنف', drink ? `"${drink.name}"` : undefined)
      onDrinkDeleted()
    }
  }

  const fetchStatsForPlace = async (pid: string) => {
    if (!pid) { setStatsOrders([]); return }
    setIsFetchingStats(true)
    try {
      const sessRes = await fetch(`/api/sessions?readonly=true&place_id=${pid}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setStatsOrders([]); return }
      const ordRes = await fetch(`/api/orders?session_id=${sess.id}`)
      const data = await ordRes.json()
      setStatsOrders(Array.isArray(data) ? data : [])
    } catch { setStatsOrders([]) }
    finally { setIsFetchingStats(false) }
  }

  const fetchCountForPlace = async (pid: string) => {
    if (!pid) { setCountOrders([]); return }
    setIsFetchingCount(true)
    try {
      const sessRes = await fetch(`/api/sessions?readonly=true&place_id=${pid}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setCountOrders([]); return }
      const ordRes = await fetch(`/api/orders?session_id=${sess.id}`)
      const data = await ordRes.json()
      setCountOrders(Array.isArray(data) ? data : [])
    } catch { setCountOrders([]) }
    finally { setIsFetchingCount(false) }
  }

  const fetchCashierOrders = async (pid: string) => {
    if (!pid) { setCashierOrders([]); return }
    setIsFetchingCashier(true)
    try {
      const sessRes = await fetch(`/api/sessions?readonly=true&place_id=${pid}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setCashierOrders([]); return }
      const ordRes = await fetch(`/api/orders?session_id=${sess.id}`)
      const data = await ordRes.json()
      setCashierOrders(Array.isArray(data) ? data : [])
      setPaidTables(new Set())
    } catch { setCashierOrders([]) }
    finally { setIsFetchingCashier(false) }
  }

  const fetchCashierUsers = async (pid?: string) => {
    setIsFetchingCashierUsers(true)
    try {
      const url = pid ? `/api/users?place_id=${pid}&role=cashier` : `/api/users?role=cashier`
      const res = await fetch(url)
      const data = await res.json()
      setCashierUsers(Array.isArray(data) ? data.filter((u: User) => u.role === 'cashier') : [])
    } catch { setCashierUsers([]) }
    finally { setIsFetchingCashierUsers(false) }
  }

  const handleCreateCashierUser = async () => {
    if (!cashierNewName.trim()) { setCashierUserError('أدخل اسم الكاشير'); return }
    if (!cashierNewPwd.trim() || cashierNewPwd.length < 5) { setCashierUserError('كلمة المرور لازم تكون 5 أحرف على الأقل'); return }
    if (!cashierUserPlaceId) { setCashierUserError('اختر المكان'); return }
    setIsCreatingCashierUser(true)
    setCashierUserError('')
    setCashierUserSuccess('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cashierNewName.trim(), password: cashierNewPwd, role: 'cashier', place_id: cashierUserPlaceId })
      })
      const data = await res.json()
      if (data.error) { setCashierUserError(data.error); return }
      setCashierNewName('')
      setCashierNewPwd('')
      setCashierUserSuccess(`✓ تم إنشاء حساب كاشير "${data.name}" بنجاح`)
      fetchCashierUsers()
      setTimeout(() => setCashierUserSuccess(''), 4000)
    } catch { setCashierUserError('حدث خطأ. حاول تاني') }
    finally { setIsCreatingCashierUser(false) }
  }

  const handleSaveFees = async () => {
    if (!feeSettingsPlaceId) { setFeeSaveError('اختر المكان'); return }
    setIsSavingFees(true); setFeeSaveError(''); setFeeSaveSuccess('')
    try {
      const res = await fetch(`/api/places/${feeSettingsPlaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_charge: parseFloat(feeServiceCharge) || 0,
          tax_rate: parseFloat(feeTaxRate) || 0
        })
      })
      const data = await res.json()
      if (data.error) { setFeeSaveError(data.error); return }
      await fetchPlaces()
      notifyDev('تحديث إعدادات الرسوم', `رسوم الخدمة: ${feeServiceCharge || '0'}% — الضريبة: ${feeTaxRate || '0'}%`)
      setFeeSaveSuccess('✓ تم حفظ الإعدادات بنجاح')
      setTimeout(() => setFeeSaveSuccess(''), 4000)
    } catch { setFeeSaveError('حدث خطأ. حاول تاني') }
    finally { setIsSavingFees(false) }
  }

  const handleCreateTable = async () => {
    if (!tableNewNumber.trim()) { setTableError('أدخل رقم الطاولة'); return }
    if (!tableNewPlaceId) { setTableError('اختر المكان'); return }
    setIsCreatingTable(true)
    setTableError('')
    setTableSuccess('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Guest-${tableNewNumber.trim()}-0000`,
          password: '',
          role: 'customer',
          place_id: tableNewPlaceId,
          table_number: tableNewNumber.trim()
        })
      })
      const data = await res.json()
      if (data.error) { setTableError(data.error); return }
      setTableNewNumber('')
      setTableSuccess(`✓ تم إنشاء طاولة ${tableNewNumber.trim()} بنجاح`)
      setTimeout(() => setTableSuccess(''), 4000)
    } catch { setTableError('حدث خطأ. حاول تاني') }
    finally { setIsCreatingTable(false) }
  }

  const handleDeleteCashierUser = async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      setCashierUsers(prev => prev.filter(u => u.id !== userId))
    } catch { /* silent */ }
  }

  const fetchTableUsers = async (pid: string) => {
    if (!pid) return
    setIsFetchingTableUsers(true)
    try {
      const res = await fetch(`/api/users?place_id=${pid}&role=customer`)
      const data = await res.json()
      setTableUsers(Array.isArray(data) ? data.filter((u: User) => u.name?.startsWith('Guest-') && u.table_number) : [])
    } catch { setTableUsers([]) }
    finally { setIsFetchingTableUsers(false) }
  }

  const fetchReservations = async (pid: string) => {
    if (!pid) return
    setIsFetchingReservations(true)
    try {
      const res = await fetch(`/api/reservations?place_id=${pid}`)
      const data = await res.json()
      setReservations(Array.isArray(data) ? data : [])
    } catch { setReservations([]) }
    finally { setIsFetchingReservations(false) }
  }

  const fetchAnalytics = async (opts: { placeId?: string; global?: boolean; period?: string } = {}) => {
    setIsFetchingAnalytics(true)
    try {
      const params = new URLSearchParams()
      const period = opts.period ?? analyticsPeriod
      params.set('period', period)
      if (opts.global) {
        params.set('global', 'true')
      } else {
        const pid = opts.placeId ?? analyticsPlaceId
        if (!pid) { setIsFetchingAnalytics(false); return }
        params.set('place_id', pid)
      }
      const res  = await fetch(`/api/analytics?${params.toString()}`)
      const data = await res.json()
      if (!data.error) setAnalyticsData(data)
    } catch { /* silent */ }
    finally { setIsFetchingAnalytics(false) }
  }

  const handleUpdateReservationStatus = async (id: string, status: string, tableNumber?: string) => {
    setConfirmingReservId(id)
    try {
      const body: Record<string, string> = { status }
      if (tableNumber !== undefined) body.table_number = tableNumber
      await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: status as Reservation['status'], table_number: tableNumber ?? r.table_number } : r))
      setReservTableInputId(null)
      setReservTableNumbers(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch { /* silent */ }
    finally { setConfirmingReservId(null) }
  }

  const handleDeleteReservation = async (id: string) => {
    try {
      await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
      setReservations(prev => prev.filter(r => r.id !== id))
    } catch { /* silent */ }
  }

  const handleToggleReservationsEnabled = async (pid: string, enabled: boolean) => {
    setIsSavingResEnabled(true)
    try {
      await fetch(`/api/places/${pid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations_enabled: enabled })
      })
      setReservationsEnabledMap(prev => ({ ...prev, [pid]: enabled }))
      fetchPlaces()
    } catch { /* silent */ }
    finally { setIsSavingResEnabled(false) }
  }

  const handleToggleOrderTracking = async (pid: string, enabled: boolean) => {
    setIsSavingTracking(true)
    try {
      await fetch(`/api/places/${pid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_tracking_enabled: enabled })
      })
      setOrderTrackingMap(prev => ({ ...prev, [pid]: enabled }))
      fetchPlaces()
    } catch { /* silent */ }
    finally { setIsSavingTracking(false) }
  }

  const handleResetSession = async () => {
    const effectivePlaceId = isDevAdmin ? (resetPlaceId || null) : (placeId || null)
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', place_id: effectivePlaceId })
    })
    if (isDevAdmin) setResetPlaceId('')
    onSessionReset()
  }

  const handleFullReset = async () => {
    const effectivePlaceId = isDevAdmin ? (analyticsPlaceId || placeId || null) : (placeId || null)
    setIsFullResetting(true)
    try {
      await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' },
        body: JSON.stringify({ place_id: effectivePlaceId })
      })
      setShowFullResetConfirm(false)
      onSessionReset()
      if (isDevAdmin) fetchAnalytics({ global: true })
      else fetchAnalytics({ placeId: effectivePlaceId || '' })
    } catch { /* silent */ }
    finally { setIsFullResetting(false) }
  }

  const startEdit = (drink: Drink) => {
    setEditingDrink(drink)
    setEditName(drink.name)
    setEditPrice(drink.price?.toString() || '0')
    setEditStock((inventoryMap[drink.id] ?? 0).toString())
    setEditImage(drink.image_url)
    setEditDialogOpen(true)
  }

  const handleSetPassword = () => {
    setPasswordError('')
    if (!newUserPassword.trim()) {
      setPasswordError('أدخل الباسورد')
      return
    }
    if (newUserPassword.trim().length < 5) {
      setPasswordError('الباسورد لازم يكون 5 أحرف أو أكتر')
      return
    }
    if (newUserPassword !== confirmUserPassword) {
      setPasswordError('الباسورد مش متطابق')
      return
    }
    if (settingPasswordForUser) {
      onUserPasswordSet(settingPasswordForUser.id, newUserPassword)
      setSettingPasswordForUser(null)
      setNewUserPassword('')
      setConfirmUserPassword('')
      setActiveAdminTab('stats')
    }
  }

  const handleCreateUser = async () => {
    setCreateUserError('')
    if (!createUserName.trim()) { setCreateUserError('الاسم مطلوب'); return }
    if (isDevAdmin && !createUserPlaceId) { setCreateUserError('اختر المكان'); return }
    if (createUserPassword.trim() && createUserPassword.trim().length < 5) { setCreateUserError('الباسورد لازم يكون 5 أحرف أو أكتر'); return }
    if (createUserPassword && createUserPassword !== createUserConfirmPass) { setCreateUserError('الباسورد مش متطابق'); return }
    setIsCreatingUser(true)
    try {
      const body: Record<string, string> = {
        name: createUserName.trim(),
        place_id: isDevAdmin ? createUserPlaceId : (placeId || ''),
        role: 'customer',
      }
      if (createUserTableNum.trim()) body.table_number = createUserTableNum.trim()
      if (createUserPassword.trim()) body.password = createUserPassword.trim()
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { setCreateUserError('حدث خطأ أثناء الإنشاء'); return }
      setShowCreateUser(false)
      setCreateUserName(''); setCreateUserPassword(''); setCreateUserConfirmPass('')
      setCreateUserPlaceId(''); setCreateUserTableNum(''); setShowCreatePass(false)
      onRefreshUsers?.()
    } catch { setCreateUserError('حدث خطأ في الاتصال') }
    finally { setIsCreatingUser(false) }
  }

  const openSetPassword = (user: User) => {
    setSettingPasswordForUser(user)
    setNewUserPassword('')
    setConfirmUserPassword('')
    setPasswordError('')
  }

  const handleSendMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) return
    if (isDevAdmin && msgDevPlaceIds.length === 0) return

    setIsSendingMessage(true)
    try {
      if (isDevAdmin) {
        // Send to each selected place
        await Promise.all(msgDevPlaceIds.map(pid =>
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: messageTitle.trim(), message: messageContent.trim(), place_id: pid })
          })
        ))
      } else {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: messageTitle.trim(), message: messageContent.trim(), place_id: placeId || null })
        })
      }
      setMessageTitle('')
      setMessageContent('')
      setMessageSent(true)
      setTimeout(() => setMessageSent(false), 3000)
      setActiveAdminTab('stats')
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleDeleteMessages = async () => {
    if (isDevAdmin && msgDevPlaceIds.length === 0) return
    const effectiveMsgPlaceId = isDevAdmin ? (msgDevPlaceIds[0] || null) : (placeId || null)
    setIsDeletingMessages(true)
    try {
      if (isDevAdmin) {
        await Promise.all(msgDevPlaceIds.map(pid =>
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_all', place_id: pid })
          })
        ))
      } else {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_all', place_id: effectiveMsgPlaceId })
        })
      }
      setMessagesDeleted(true)
      setTimeout(() => setMessagesDeleted(false), 3000)
    } catch (err) {
      console.error('Error deleting messages:', err)
    } finally {
      setIsDeletingMessages(false)
    }
  }

const handleSaveSettings = async () => {
  setIsSavingSettings(true)

  try {
    // Placeholder for future settings
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 3000)
    setActiveAdminTab('stats');
  } catch (err) {
    console.error('Error saving settings:', err)
  } finally {
    setIsSavingSettings(false)
  }
}
  if (!isInline) {
    return null
  }

  // ─── Places state (dev admin only) ──────────────────
  const [places, setPlaces] = useState<Place[]>([])
  const [newPlaceName, setNewPlaceName] = useState('')
  const [newPlaceCode, setNewPlaceCode] = useState('')
  const [newPlaceDesc, setNewPlaceDesc] = useState('')
  const [placesError, setPlacesError] = useState('')
  const [isAddingPlace, setIsAddingPlace] = useState(false)

  const fetchClients = async () => {
    setIsFetchingClients(true)
    try {
      const res = await fetch('/api/clients')
      if (res.ok) setClients(await res.json())
    } finally {
      setIsFetchingClients(false)
    }
  }

  const handleAddClient = async () => {
    if (!newClientName.trim()) { setClientsError('الاسم مطلوب'); return }
    setIsAddingClient(true)
    setClientsError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
          place_name: newClientPlace.trim() || null,
          subscription: newClientSub,
          notes: newClientNotes.trim() || null
        })
      })
      if (res.ok) {
        const created = await res.json()
        setClients(prev => [created, ...prev])
        setNewClientName('')
        setNewClientPhone('')
        setNewClientPlace('')
        setNewClientSub('monthly')
        setNewClientNotes('')
      } else {
        setClientsError('فشلت الإضافة')
      }
    } catch { setClientsError('حدث خطأ') }
    finally { setIsAddingClient(false) }
  }

  const handleDeleteClient = async (id: string) => {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
  }

  const fetchPlaces = async () => {
    const res = await fetch('/api/places')
    if (res.ok) {
      const list = await res.json()
      setPlaces(list)
      fetchAllPlaceAdmins(list)
      return list
    }
    return []
  }

  // ── Fetch all drinks stats (global, all places) for dev admin ──
  const fetchAllDrinksStats = async () => {
    try {
      const res = await fetch('/api/drinks')
      if (!res.ok) return
      const allDrinks: Drink[] = await res.json()
      const byCategory: Record<string, number> = {}
      allDrinks.forEach(d => {
        const cat = d.category || 'other'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })
      setAllDrinksStats({ total: allDrinks.length, byCategory })
    } catch {}
  }

  // Auto-fetch places on mount for dev admin; auto-select first place in all selector tabs
  useEffect(() => {
    if (isDevAdmin) {
      fetchPlaces().then(list => {
        if (list.length > 0) {
          const fid = list[0].id
          setStatsPlaceId(prev => { const chosen = prev || fid; fetchStatsForPlace(chosen); return chosen })
          setDevDrinkPlaceId(prev => prev || fid)
          setResetPlaceId(prev => prev || fid)
          setInventoryDevPlaceId(prev => prev || fid)
          setMsgDevPlaceIds(prev => prev.length > 0 ? prev : list.map((p: Place) => p.id))
        }
      })
      fetchAllDrinksStats()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll dev notifications for dev admin
  const fetchDevNotifs = async () => {
    try {
      const res = await fetch('/api/dev-notifications')
      if (res.ok) {
        const data = await res.json()
        setDevNotifs(data.notifications || [])
        setDevNotifsUnread(data.unreadCount || 0)
      }
    } catch {}
  }

  useEffect(() => {
    if (!isDevAdmin) return
    fetchDevNotifs()
    const interval = setInterval(fetchDevNotifs, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevAdmin])

  // Send notification to dev admin (called only when !isDevAdmin i.e. place admin)
  const notifyDev = async (action: string, details?: string) => {
    if (isDevAdmin || !placeId || !currentPlace) return
    try {
      await fetch('/api/dev-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: placeId,
          place_name: currentPlace.name,
          action,
          details: details || null
        })
      })
    } catch {}
  }

  const handleAddPlace = async () => {
    if (!newPlaceName.trim()) { setPlacesError('اسم المكان مطلوب'); return }
    setIsAddingPlace(true); setPlacesError('')
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaceName.trim(), code: newPlaceName.trim(), description: newPlaceDesc.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) { setPlacesError(data.error || 'حدث خطأ'); return }
      setNewPlaceName(''); setNewPlaceDesc('')
      fetchPlaces()
    } catch { setPlacesError('حدث خطأ') } finally { setIsAddingPlace(false) }
  }

  const handleDeletePlace = async (id: string) => {
    await fetch(`/api/places/${id}`, { method: 'DELETE' })
    fetchPlaces()
  }

  const handleTogglePlace = async (id: string, is_active: boolean) => {
    await fetch(`/api/places/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active })
    })
    fetchPlaces()
  }

  // ─── Assign Admin state ───────────────────────────────
  const [placeAdmins, setPlaceAdmins] = useState<Record<string, { id: string; name: string } | null>>({})
  const [assigningForPlace, setAssigningForPlace] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [isSavingAdmin, setIsSavingAdmin] = useState(false)
  const [logoEditingPlace, setLogoEditingPlace] = useState<string | null>(null)
  const [logoUrlInput, setLogoUrlInput] = useState('')
  const [isSavingLogo, setIsSavingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [tableCountEditing, setTableCountEditing] = useState<Record<string, string>>({})
  const [savingTableCount, setSavingTableCount] = useState<string | null>(null)
  const [tableCountForSettings, setTableCountForSettings] = useState('')
  const [isSavingTableCount, setIsSavingTableCount] = useState(false)
  const [tableCountSaved, setTableCountSaved] = useState(false)

  const fetchPlaceAdmin = async (placeId: string) => {
    const res = await fetch(`/api/users?place_id=${placeId}`)
    if (!res.ok) return
    const users: Array<{ id: string; name: string; role: string }> = await res.json()
    const admin = users.find(u => u.role === 'admin') || null
    setPlaceAdmins(prev => ({ ...prev, [placeId]: admin }))
  }

  const fetchAllPlaceAdmins = async (placeList: Place[]) => {
    for (const p of placeList) fetchPlaceAdmin(p.id)
  }

  const handleDeleteAdmin = async (placeId: string) => {
    const existing = placeAdmins[placeId]
    if (!existing) return
    try {
      await fetch(`/api/users/${existing.id}`, { method: 'DELETE' })
      fetchPlaceAdmin(placeId)
    } catch { /* ignore */ }
  }

  const handleSaveLogo = async (placeId: string) => {
    setIsSavingLogo(true)
    setLogoError('')
    try {
      const url = logoUrlInput.trim() || null
      const res = await fetch(`/api/places/${placeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: url }),
      })
      if (!res.ok) { setLogoError('فشل الحفظ، حاول مرة أخرى'); return }
      fetchPlaces()
      setLogoEditingPlace(null)
      setLogoUrlInput('')
    } catch { setLogoError('حدث خطأ، حاول مرة أخرى') }
    finally { setIsSavingLogo(false) }
  }

  const handleLogoFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { setLogoError('الملف يجب أن يكون صورة'); return }
    if (file.size > 10 * 1024 * 1024) { setLogoError('حجم الصورة أكبر من 10MB'); return }
    setLogoError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = document.createElement('img')
      img.onload = () => {
        const MAX = 400
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setLogoUrlInput(dataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleAssignAdmin = async (placeId: string) => {
    const existing = placeAdmins[placeId]
    const isEditing = !!existing

    if (!adminName.trim()) { setAdminError('اسم الأدمن مطلوب'); return }
    if (!isEditing && !adminPassword.trim()) { setAdminError('الباسورد مطلوب عند الإضافة'); return }
    if (adminPassword.trim() && adminPassword.trim().length < 5) { setAdminError('الباسورد لازم يكون 5 أحرف أو أكتر'); return }

    setIsSavingAdmin(true); setAdminError('')
    try {
      if (isEditing) {
        // Update existing admin (name and/or password)
        const updateBody: Record<string, string> = { name: adminName.trim() }
        if (adminPassword.trim()) updateBody.password = adminPassword.trim()
        const res = await fetch(`/api/users/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody)
        })
        if (!res.ok) { setAdminError('حدث خطأ في التحديث'); return }
      } else {
        // Create new admin
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: adminName.trim(), password: adminPassword.trim(), role: 'admin', place_id: placeId })
        })
        const data = await res.json()
        if (!res.ok || data.error) { setAdminError(data.error || 'حدث خطأ'); return }
      }
      setAdminName(''); setAdminPassword('')
      setAssigningForPlace(null)
      fetchPlaceAdmin(placeId)
    } catch { setAdminError('حدث خطأ') } finally { setIsSavingAdmin(false) }
  }

  return (
    <div className="space-y-4">

      {/* ── Dev Admin Premium Header ── */}
      {isDevAdmin ? (
        <div className="relative rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(135deg, #06000e 0%, #0e001a 40%, #180030 75%, #1c003a 100%)',
          boxShadow: '0 0 0 1px rgba(147,51,234,0.3), 0 0 40px rgba(147,51,234,0.07), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          {/* Animated top-border sweep */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <div className="h-full w-[200%]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(147,51,234,0.8) 15%, rgba(99,102,241,1) 25%, rgba(147,51,234,0.8) 35%, transparent 50%, transparent 100%)', animation: 'sweep 3s linear infinite' }} />
          </div>
          <style>{`@keyframes sweep { 0% { transform: translateX(-50%); } 100% { transform: translateX(0%); } }`}</style>

          {/* Glow orbs */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)', filter: 'blur(24px)' }} />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-44 w-44 rounded-full"
            style={{ background: 'radial-gradient(circle, #4f46e5, transparent 70%)', filter: 'blur(20px)', opacity: 0.12 }} />
          {/* Grid pattern overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative p-5 space-y-4">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.25), rgba(99,102,241,0.15))', border: '1px solid rgba(147,51,234,0.4)', boxShadow: '0 0 16px rgba(147,51,234,0.2)' }}>
                  ⚡
                  <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-wide text-white" style={{ textShadow: '0 0 20px rgba(147,51,234,0.5)' }}>Dev Control Center</h1>
                  <p className="mt-0.5 text-[11px]" style={{ color: '#a78bfa' }}>SîpFlõw · الوصول الكامل للنظام</p>
                </div>
              </div>
              {/* Live clock */}
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest"
                  style={{ background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.5)', color: '#c4b5fd' }}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                  MASTER
                </span>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold tabular-nums" style={{ color: '#e2d9f3', letterSpacing: '0.05em', textShadow: '0 0 10px rgba(167,139,250,0.4)' }}>{currentTime}</p>
                  <p className="text-[10px]" style={{ color: '#6b5e8a' }}>{currentDate}</p>
                </div>
              </div>
            </div>

            {/* Stats row — 4 cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'الأماكن',   value: places.length,                           icon: '🏠', color: '#c4b5fd', bg: 'rgba(147,51,234,0.12)', border: 'rgba(147,51,234,0.28)' },
                { label: 'الموظفون', value: staffUsers.length,                        icon: '👥', color: '#6ee7b7', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.22)' },
                { label: 'العملاء',  value: clients.length,                           icon: '⭐', color: '#fcd34d', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)' },
                { label: 'الأصناف',  value: allDrinksStats?.total ?? '—',             icon: '☕', color: '#f9a8d4', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.22)' },
              ].map(s => (
                <div key={s.label} className="rounded-xl px-1.5 py-2.5 text-center transition-transform hover:scale-105"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-base">{s.icon}</p>
                  <p className="text-sm font-bold text-white tabular-nums">{s.value}</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: s.color }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6b5e8a' }}>وصول سريع:</span>
              {[
                { label: '📊 إحصائيات', tab: 'stats' },
                { label: '🏠 الأماكن',  tab: 'places' },
                { label: '📣 رسائل',    tab: 'messages' },
                { label: '⚙️ إعدادات',  tab: 'settings' },
                { label: '☕ أصناف',    tab: 'drinks' },
                { label: '🗑️ الخطرة',  tab: 'danger' },
              ].map(q => (
                <button key={q.tab}
                  onClick={() => setActiveAdminTab(q.tab)}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-105"
                  style={{
                    background: activeAdminTab === q.tab ? 'rgba(147,51,234,0.35)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${activeAdminTab === q.tab ? 'rgba(147,51,234,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    color: activeAdminTab === q.tab ? '#e2d9f3' : '#7c6e99',
                    boxShadow: activeAdminTab === q.tab ? '0 0 8px rgba(147,51,234,0.3)' : 'none'
                  }}>
                  {q.label}
                </button>
              ))}
            </div>

            {/* System status bar */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-emerald-400">النظام يعمل</span>
              </div>
              <div className="flex items-center gap-2">
                {['PostgreSQL', 'API', 'Auth'].map(s => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />{s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── Place Admin header ── */
        <div className="relative rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(135deg, #0a0600 0%, #1a0f00 40%, #241600 75%, #1c1000 100%)',
          boxShadow: '0 0 0 1px rgba(212,160,23,0.25), 0 0 30px rgba(212,160,23,0.05), inset 0 1px 0 rgba(255,255,255,0.04)'
        }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.6), rgba(245,158,11,0.8), rgba(212,160,23,0.6), transparent)' }} />
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,160,23,0.15), transparent 70%)', filter: 'blur(16px)' }} />

          <div className="relative p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)' }}>
                  ☕
                </div>
                <div>
                  <h1 className="text-base font-bold text-white">لوحة الإدارة</h1>
                  <p className="text-[11px]" style={{ color: '#d4a017' }}>
                    {currentPlace ? `📍 ${currentPlace.name}` : 'إدارة الأصناف والمستخدمين'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold tracking-wider"
                style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#fcd34d' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                ADMIN
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'الأصناف', value: drinks.length, icon: '🍹', color: '#fcd34d', bg: 'rgba(212,160,23,0.08)', border: 'rgba(212,160,23,0.2)' },
                { label: 'المستخدمين', value: users.length, icon: '👥', color: '#6ee7b7', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)' },
                { label: 'الطلبات', value: orders.length, icon: '📋', color: '#93c5fd', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)' },
              ].map(s => (
                <div key={s.label} className="rounded-lg px-2 py-2 text-center"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-sm">{s.icon}</p>
                  <p className="text-sm font-bold text-white tabular-nums">{s.value}</p>
                  <p className="text-[10px]" style={{ color: s.color }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-1.5"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400">متصل</span>
              </div>
              <span className="text-[10px]" style={{ color: 'rgba(212,160,23,0.4)' }}>SîpFlõw</span>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeAdminTab} onValueChange={(v) => {
        setActiveAdminTab(v)
        if (v === 'stats' && isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setStatsPlaceId(prev => { const chosen = prev || list[0].id; fetchStatsForPlace(chosen); return chosen }) })
        if (v === 'staff') fetchStaffUsers()
        if (v === 'inventory') { fetchInventory(); if (isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setInventoryDevPlaceId(prev => prev || list[0].id) }) }
        if (v === 'places') fetchPlaces().then(list => { const m: Record<string, boolean> = {}; list.forEach((p: Place) => { m[p.id] = p.order_tracking_enabled !== false }); setOrderTrackingMap(m) })
        if (v === 'drinks' && isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setDevDrinkPlaceId(prev => prev || list[0].id) })
        if (v === 'messages' && isDevAdmin) {
          fetchPlaces().then(list => { if (list.length > 0) setMsgDevPlaceIds(prev => prev.length > 0 ? prev : list.map((p: Place) => p.id)) })
          if (devNotifsUnread > 0) {
            fetch('/api/dev-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) }).then(() => fetchDevNotifs())
          }
        }
        if (v === 'users' && isDevAdmin) fetchPlaces()
        if (v === 'staff' && isDevAdmin) fetchPlaces()
        if (v === 'danger' && isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setResetPlaceId(prev => prev || list[0].id) })
        if (v === 'clients' && isDevAdmin) fetchClients()
        if (v === 'tables' && !isDevAdmin) { fetchPlaceTableCount(); fetchInventory() }
        if (v === 'settings' && !isDevAdmin && placeId) { fetchClosedStatus() }
        if (v === 'settings' && !isDevAdmin && placeId) { fetchPlaces().then(list => { const p = list.find((pl: Place) => pl.id === placeId); if (p) { setReservationsEnabledMap(prev => ({ ...prev, [placeId]: !!p.reservations_enabled })); setOrderTrackingMap(prev => ({ ...prev, [placeId]: p.order_tracking_enabled !== false })) } }) }
        if (v === 'settings' && isDevAdmin) { fetchGlobalBanner(); fetchPlaces().then(list => { const m: Record<string, boolean> = {}; list.forEach((p: Place) => { m[p.id] = p.order_tracking_enabled !== false }); setOrderTrackingMap(m) }) }
        if (v === 'cashier') { if (isDevAdmin) { fetchPlaces().then(list => { if (list.length > 0) setCashierPlaceId(prev => { const chosen = prev || list[0].id; fetchCashierOrders(chosen); return chosen }) }); fetchCashierUsers() } else if (placeId) { setCashierPlaceId(placeId); setCashierUserPlaceId(placeId); setTableNewPlaceId(placeId); setTablesPlaceId(placeId); setFeeSettingsPlaceId(placeId); fetchCashierOrders(placeId); fetchCashierUsers(placeId); fetchTableUsers(placeId); fetchPlaces().then(list => { const p = list.find((pl: Place) => pl.id === placeId); if (p) { setFeeServiceCharge(p.service_charge != null ? String(p.service_charge) : '0'); setFeeTaxRate(p.tax_rate != null ? String(p.tax_rate) : '0') } }) } }
        if (v === 'reservations') { if (!isDevAdmin && placeId) { setReservationsPlaceId(placeId); fetchReservations(placeId) } fetchPlaces().then(list => { if (list.length > 0) { const pid = isDevAdmin ? (reservationsPlaceId || list[0].id) : (placeId || list[0].id); if (isDevAdmin) { setReservationsPlaceId(pid); fetchReservations(pid) } const p = list.find((pl: Place) => pl.id === pid); if (p) setReservationsEnabledMap(prev => ({ ...prev, [pid]: !!p.reservations_enabled })) } }) }
        if (v === 'analytics') {
          if (isDevAdmin) {
            fetchAnalytics({ global: true })
          } else if (placeId) {
            setAnalyticsPlaceId(placeId)
            fetchAnalytics({ placeId })
          }
        }
        if (v === 'count' && isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setCountPlaceId(prev => { const chosen = prev || list[0].id; fetchCountForPlace(chosen); return chosen }) })
      }} className="w-full">
        {/* ── Dev Admin: horizontal scroll tab bar ── */}
        {isDevAdmin ? (
          <TabsList className="mb-3 flex w-full overflow-x-auto gap-0.5 rounded-xl p-1.5 h-auto [&>*]:shrink-0 [&>*]:whitespace-nowrap" style={{ scrollbarWidth: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* ── Command Center ── */}
            <TabsTrigger value="command-center"
              className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:text-white data-[state=active]:shadow-lg"
              style={{ background: activeAdminTab === 'command-center' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : undefined }}>
              <Activity className="h-3.5 w-3.5" /><span>مركز التحكم</span>
              <span className="absolute -top-0.5 -left-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </TabsTrigger>
            <div className="mx-1.5 h-6 w-px self-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            {/* ── Group 1: Analytics (violet) ── */}
            <span className="shrink-0 self-center px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: '#7c3aed' }}>تحليلات</span>
            <TabsTrigger value="stats"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
              <BarChart3 className="h-3.5 w-3.5" /><span>الإحصائيات</span>
            </TabsTrigger>
            <TabsTrigger value="analytics"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
              <TrendingUp className="h-3.5 w-3.5" /><span>التقارير</span>
            </TabsTrigger>
            <TabsTrigger value="count"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
              <CheckCircle2 className="h-3.5 w-3.5" /><span>حصر المسلّم</span>
            </TabsTrigger>
            {/* styled separators will be applied via group class — simple divider */}
            <div className="mx-1.5 h-6 w-px self-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />

            {/* ── Group 2: Content (amber) ── */}
            <span className="shrink-0 self-center px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: '#d97706' }}>المحتوى</span>
            <TabsTrigger value="drinks"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Coffee className="h-3.5 w-3.5" /><span>الأصناف</span>
            </TabsTrigger>
            <TabsTrigger value="inventory"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Package className="h-3.5 w-3.5" /><span>المخزون</span>
            </TabsTrigger>
            <TabsTrigger value="cashier"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Banknote className="h-3.5 w-3.5" /><span>الكاشير</span>
            </TabsTrigger>
            <TabsTrigger value="reservations"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <CalendarDays className="h-3.5 w-3.5" /><span>الحجوزات</span>
            </TabsTrigger>
            <div className="mx-1.5 h-6 w-px self-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />

            {/* ── Group 3: People (emerald) ── */}
            <span className="shrink-0 self-center px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: '#059669' }}>الأشخاص</span>
            <TabsTrigger value="place-admins"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <UserCog className="h-3.5 w-3.5" /><span>أدمنز الأماكن</span>
            </TabsTrigger>
            <TabsTrigger value="staff"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <UserCog className="h-3.5 w-3.5" /><span>Staff</span>
            </TabsTrigger>
            <TabsTrigger value="places"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Link2 className="h-3.5 w-3.5" /><span>الأماكن</span>
            </TabsTrigger>
            <TabsTrigger value="clients"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <UserPlus className="h-3.5 w-3.5" /><span>العملاء</span>
            </TabsTrigger>
            <div className="mx-1.5 h-6 w-px self-center rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />

            {/* ── Group 4: System (sky + rose) ── */}
            <span className="shrink-0 self-center px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: '#0284c7' }}>النظام</span>
            <TabsTrigger value="messages" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-sky-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>الرسائل</span>
              {devNotifsUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black animate-bounce">{devNotifsUnread > 9 ? '9+' : devNotifsUnread}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-sky-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Settings2 className="h-3.5 w-3.5" /><span>الإعدادات</span>
            </TabsTrigger>
            <TabsTrigger value="danger"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-rose-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Trash2 className="h-3.5 w-3.5" /><span>الخطرة</span>
            </TabsTrigger>
          </TabsList>
        ) : (
          /* ── Place Admin: scrollable tab bar ── */
          <TabsList className="mb-3 flex w-full overflow-x-auto gap-0.5 rounded-xl p-1.5 h-auto [&>*]:shrink-0 [&>*]:whitespace-nowrap" style={{ scrollbarWidth: 'none', background: 'rgba(212,160,23,0.04)', border: '1px solid rgba(212,160,23,0.1)' }}>
            {/* Analytics */}
            <TabsTrigger value="stats"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <BarChart3 className="h-3.5 w-3.5" /><span>الإحصائيات</span>
            </TabsTrigger>
            <TabsTrigger value="analytics"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <TrendingUp className="h-3.5 w-3.5" /><span>التقارير</span>
            </TabsTrigger>
            <div className="mx-1 h-5 w-px self-center rounded-full" style={{ background: 'rgba(212,160,23,0.15)' }} />
            {/* Content */}
            <TabsTrigger value="tables" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-800 data-[state=active]:text-white data-[state=active]:shadow-md">
              <TableProperties className="h-3.5 w-3.5" /><span>الطاولات</span>
              {(() => {
                const occupied = new Set(orders.filter(o => o.table_number && o.status !== 'completed').map(o => o.table_number)).size
                return occupied > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-black">{occupied}</span>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="drinks"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-800 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Coffee className="h-3.5 w-3.5" /><span>الأصناف</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-800 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Package className="h-3.5 w-3.5" /><span>المخزون</span>
              {(() => {
                const lowCount = drinks.filter(d => (inventoryMap[d.id] ?? 0) < lowStockThreshold && (inventoryMap[d.id] ?? 0) >= 0).length
                return lowCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-black">{lowCount}</span>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="cashier"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-800 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Banknote className="h-3.5 w-3.5" /><span>الكاشير</span>
            </TabsTrigger>
            <TabsTrigger value="reservations"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-amber-800 data-[state=active]:text-white data-[state=active]:shadow-md">
              <CalendarDays className="h-3.5 w-3.5" /><span>الحجوزات</span>
            </TabsTrigger>
            <div className="mx-1 h-5 w-px self-center rounded-full" style={{ background: 'rgba(212,160,23,0.15)' }} />
            {/* People */}
            <TabsTrigger value="users"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Users className="h-3.5 w-3.5" /><span>المستخدمين</span>
            </TabsTrigger>
            <TabsTrigger value="staff"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <UserCog className="h-3.5 w-3.5" /><span>Staff</span>
            </TabsTrigger>
            <div className="mx-1 h-5 w-px self-center rounded-full" style={{ background: 'rgba(212,160,23,0.15)' }} />
            {/* System */}
            <TabsTrigger value="messages" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-sky-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <MessageSquare className="h-3.5 w-3.5" /><span>الرسائل</span>
            </TabsTrigger>
            <TabsTrigger value="settings"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-sky-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Settings2 className="h-3.5 w-3.5" /><span>الإعدادات</span>
            </TabsTrigger>
            <TabsTrigger value="danger"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-rose-700 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Trash2 className="h-3.5 w-3.5" /><span>الخطرة</span>
            </TabsTrigger>
          </TabsList>
        )}

        {/* ── Command Center Tab ── */}
        <TabsContent value="command-center" className="space-y-4">
          <CommandCenter />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">

          {/* ── Dev Admin: Global drinks count card ── */}
          {isDevAdmin && (
            <div className="relative overflow-hidden rounded-2xl p-4" style={{
              background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 60%, #1a1040 100%)',
              border: '1px solid rgba(147,51,234,0.3)'
            }}>
              <div className="pointer-events-none absolute -top-6 -left-6 h-28 w-28 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(16px)' }} />
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)' }}>
                      <Coffee className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-violet-300">إجمالي الأصناف — كل الأماكن</p>
                      <p className="text-[10px] text-zinc-500">من قاعدة البيانات الكاملة</p>
                    </div>
                  </div>
                  <button onClick={fetchAllDrinksStats}
                    className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-violet-400"
                    style={{ background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.15)' }}
                    title="تحديث">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {allDrinksStats === null ? (
                  <p className="text-center text-sm text-zinc-500 py-2">جاري التحميل...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {/* Total */}
                    <div className="col-span-2 sm:col-span-1 rounded-xl px-3 py-2.5 text-center"
                      style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)' }}>
                      <p className="text-2xl font-black text-white">{allDrinksStats.total}</p>
                      <p className="text-[10px] text-violet-300 mt-0.5">الإجمالي</p>
                    </div>
                    {/* Hot */}
                    <div className="rounded-xl px-3 py-2.5 text-center"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-xl font-bold text-white">{allDrinksStats.byCategory['hot'] ?? 0}</p>
                      <p className="text-[10px] text-red-400 mt-0.5">☕ ساخن</p>
                    </div>
                    {/* Cold */}
                    <div className="rounded-xl px-3 py-2.5 text-center"
                      style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                      <p className="text-xl font-bold text-white">{allDrinksStats.byCategory['cold'] ?? 0}</p>
                      <p className="text-[10px] text-sky-400 mt-0.5">🧊 بارد</p>
                    </div>
                    {/* Shisha */}
                    <div className="rounded-xl px-3 py-2.5 text-center"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <p className="text-xl font-bold text-white">{allDrinksStats.byCategory['shisha'] ?? 0}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">💨 شيشة</p>
                    </div>
                    {/* Other categories dynamically */}
                    {Object.entries(allDrinksStats.byCategory)
                      .filter(([cat]) => !['hot', 'cold', 'shisha'].includes(cat))
                      .map(([cat, count]) => (
                        <div key={cat} className="rounded-xl px-3 py-2.5 text-center"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <p className="text-xl font-bold text-white">{count}</p>
                          <p className="text-[10px] text-amber-400 mt-0.5">📦 {cat}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dev admin: place selector for stats */}
          {isDevAdmin && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <Label className="text-muted-foreground">اختر المكان لعرض إحصائياته</Label>
              <select
                value={statsPlaceId}
                onChange={e => { setStatsPlaceId(e.target.value); fetchStatsForPlace(e.target.value) }}
                className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
              >
                <option value="">— اختر المكان —</option>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Show empty/loading state for dev admin without selection */}
          {isDevAdmin && !statsPlaceId && (
            <p className="text-center text-muted-foreground py-8">اختر مكاناً لعرض الإحصائيات</p>
          )}
          {isDevAdmin && statsPlaceId && isFetchingStats && (
            <p className="text-center text-muted-foreground py-8">جاري تحميل الإحصائيات...</p>
          )}

          {/* Stats content — visible for place admin always, for dev admin after selecting place */}
          {(!isDevAdmin || (statsPlaceId && !isFetchingStats)) && (() => {
            const ao = isDevAdmin ? statsOrders : orders

          return (<>
          {/* === Revenue Card === */}
          {(() => {
            const totalRevenue = ao.reduce((sum, o) => sum + parseFloat(String(o.total_price || 0)), 0)
            return (
              <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #3d1f00, #6b3a00, #a05c00)' }}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-xs tracking-widest uppercase text-amber-200/70 font-medium mb-1">إجمالي الإيرادات اليوم</p>
                    <p className="text-4xl font-black text-white">{totalRevenue.toFixed(0)} <span className="text-xl text-amber-300">ج.م</span></p>
                    <p className="text-xs text-amber-200/60 mt-1">{ao.length} طلب · {new Set(ao.map(o => o.user_id)).size} عميل</p>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <Banknote className="h-8 w-8 text-amber-300" />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === Order Status Split === */}
          {(() => {
            const pending   = ao.filter(o => o.status === 'pending').length
            const completed = ao.filter(o => o.status === 'completed').length
            const total     = ao.length || 1
            const pct       = Math.round((completed / total) * 100)
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-1">
                  <Hourglass className="h-5 w-5 text-amber-500" />
                  <p className="text-2xl font-bold text-foreground">{pending}</p>
                  <p className="text-xs text-muted-foreground text-center">طلبات معلقة</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-2xl font-bold text-foreground">{completed}</p>
                  <p className="text-xs text-muted-foreground text-center">طلبات منجزة</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col items-center gap-1">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  <p className="text-2xl font-bold text-emerald-400">{pct}%</p>
                  <p className="text-xs text-muted-foreground text-center">نسبة الإنجاز</p>
                </div>
              </div>
            )
          })()}

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Coffee className="h-4 w-4" />
                <span className="text-sm">إجمالي الطلبات</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {ao.reduce((acc, o) => acc + o.quantity, 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">المستخدمين النشطين</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {new Set(ao.map(o => o.user_id)).size}
              </p>
            </div>
          </div>

          {/* Top Drinks */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">أكثر المشروبات طلباً</h3>
            </div>
            <div className="space-y-3">
              {(() => {
                const drinkStats = ao.reduce((acc, order) => {
                  const drinkId = order.drink_id
                  if (!acc[drinkId]) {
                    acc[drinkId] = { drink: order.drink, total: 0 }
                  }
                  acc[drinkId].total += order.quantity
                  return acc
                }, {} as Record<string, { drink: typeof ao[0]['drink'], total: number }>)
                
                const sorted = Object.values(drinkStats).sort((a, b) => b.total - a.total).slice(0, 5)
                const maxTotal = sorted[0]?.total || 1
                
                return sorted.length > 0 ? sorted.map((item, index) => (
                  <div key={item.drink?.id || index} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{item.drink?.name || 'غير معروف'}</span>
                        <span className="text-sm text-muted-foreground">{item.total} طلب</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div 
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(item.total / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground">لا توجد طلبات بعد</p>
                )
              })()}
            </div>
          </div>

          {/* Top Users */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-foreground">أكثر المستخدمين طلباً</h3>
            </div>
            <div className="space-y-3">
              {(() => {
                const userStats = ao.reduce((acc, order) => {
                  const userId = order.user_id
                  if (!acc[userId]) {
                    acc[userId] = { user: order.user, total: 0 }
                  }
                  acc[userId].total += order.quantity
                  return acc
                }, {} as Record<string, { user: typeof ao[0]['user'], total: number }>)
                
                const sorted = Object.values(userStats).sort((a, b) => b.total - a.total).slice(0, 5)
                
                return sorted.length > 0 ? sorted.map((item, index) => (
                  <div key={item.user?.id || index} className="flex items-center justify-between rounded-xl bg-muted p-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-amber-500 text-white' : 
                        index === 1 ? 'bg-gray-400 text-white' : 
                        index === 2 ? 'bg-amber-700 text-white' : 
                        'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-foreground">{formatDisplayName(item.user?.name, item.user?.table_number) || 'غير معروف'}</span>
                    </div>
                    <span className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
                      {item.total} طلب
                    </span>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground">لا توجد طلبات بعد</p>
                )
              })()}
            </div>
          </div>

          {/* === Busiest Tables === */}
          {(() => {
            const tableStats = ao.reduce((acc, order) => {
              const table = order.user?.table_number
              if (!table) return acc
              acc[table] = (acc[table] || 0) + order.quantity
              return acc
            }, {} as Record<string, number>)
            const sorted = Object.entries(tableStats).sort((a, b) => b[1] - a[1]).slice(0, 5)
            const maxVal = sorted[0]?.[1] || 1
            return sorted.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <TableProperties className="h-5 w-5 text-violet-400" />
                  <h3 className="font-semibold text-foreground">أنشط الطربيزات</h3>
                </div>
                <div className="space-y-3">
                  {sorted.map(([table, count], i) => (
                    <div key={table} className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {table}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground font-medium">طربيزة {table}</span>
                          <span className="text-muted-foreground">{count} مشروب</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(count / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* Recent Activity */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-foreground">آخر الطلبات</h3>
            </div>
            <div className="space-y-2">
              {ao.slice(-5).reverse().map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{formatDisplayName(order.user?.name, order.user?.table_number)}</span>
                    <span className="text-muted-foreground">طلب</span>
                    <span className="text-primary">{order.quantity}x {order.drink?.name}</span>
                  </div>
                </div>
              ))}
              {ao.length === 0 && (
                <p className="text-center text-muted-foreground">لا توجد طلبات بعد</p>
              )}
            </div>
          </div>

          {/* Quick access: Reservations */}
          <button
            onClick={() => setActiveAdminTab('reservations')}
            className="w-full flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 px-5 py-4 transition-colors"
          >
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="font-bold text-amber-300 text-sm">الحجوزات المسبقة</p>
                <p className="text-xs text-muted-foreground">عرض وإدارة حجوزات ال��ملاء</p>
              </div>
            </div>
            <CalendarDays className="h-6 w-6 text-amber-400 shrink-0" />
          </button>
          </>)
          })()}
        </TabsContent>

        {/* ─── Table Map Tab ─── */}
        <TabsContent value="tables" className="space-y-4">
          {isDevAdmin ? (
            <p className="text-center text-muted-foreground py-8">خريطة الطاولات متاحة لمدير المكان فقط</p>
          ) : (() => {
            // Group active orders by table number
            const activeOrders = orders.filter(o => o.status !== 'completed')
            const tableOrdersMap: Record<string, OrderWithDetails[]> = {}
            activeOrders.forEach(o => {
              const t = o.table_number || 'بلا طاولة'
              if (!tableOrdersMap[t]) tableOrdersMap[t] = []
              tableOrdersMap[t].push(o)
            })
            // Build table list (from 1..placeTableCount, plus any occupied beyond that)
            const knownTables = new Set<string>()
            for (let i = 1; i <= placeTableCount; i++) knownTables.add(String(i))
            Object.keys(tableOrdersMap).forEach(t => { if (t !== 'بلا طاولة') knownTables.add(t) })
            const sortedTables = Array.from(knownTables).sort((a, b) => Number(a) - Number(b))
            const occupiedCount = sortedTables.filter(t => tableOrdersMap[t] && tableOrdersMap[t].length > 0).length
            const freeCount = sortedTables.length - occupiedCount

            return (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <p className="text-2xl font-black text-emerald-400">{freeCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">فاضية</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <p className="text-2xl font-black text-amber-400">{occupiedCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">مشغولة</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <p className="text-2xl font-black text-indigo-400">{sortedTables.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">إجمالي</p>
                  </div>
                </div>

                {placeTableCount === 0 && sortedTables.length === 0 && (
                  <div className="rounded-xl p-6 text-center" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <TableProperties className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لم يتم تحديد عدد الطاولات بعد</p>
                    <p className="text-xs text-muted-foreground mt-1">اضبط عدد الطاولات من إعدادات المكان</p>
                  </div>
                )}

                {/* Table grid */}
                <div className="grid grid-cols-3 gap-3">
                  {sortedTables.map(tableNum => {
                    const tableOrders = tableOrdersMap[tableNum] || []
                    const isOccupied = tableOrders.length > 0
                    const totalBill = tableOrders.reduce((s, o) => s + ((Number(o.drink?.price) || 0) * (o.quantity || 1)), 0)
                    const pendingCount = tableOrders.filter(o => o.status === 'pending').length
                    const readyCount = tableOrders.filter(o => o.status === 'ready').length
                    const uniqueUsers = [...new Set(tableOrders.map(o => o.customer_name || o.user?.name || '').filter(Boolean))]

                    return (
                      <div key={tableNum} className="rounded-2xl p-3 transition-all"
                        style={{
                          background: isOccupied
                            ? readyCount > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.07)'
                            : 'rgba(255,255,255,0.02)',
                          border: isOccupied
                            ? readyCount > 0 ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(251,191,36,0.3)'
                            : '1px solid rgba(255,255,255,0.07)'
                        }}>
                        {/* Table number */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-black" style={{ color: isOccupied ? (readyCount > 0 ? '#4ade80' : '#fbbf24') : '#6b7280' }}>
                            {tableNum}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isOccupied ? (readyCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400') : 'bg-zinc-700/50 text-zinc-500'}`}>
                            {isOccupied ? (readyCount > 0 ? 'جاهز' : 'مشغول') : 'فاضي'}
                          </span>
                        </div>

                        {isOccupied && (
                          <div className="space-y-1">
                            {uniqueUsers.length > 0 && (
                              <p className="text-[10px] text-zinc-400 truncate">{uniqueUsers[0]}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-500">{tableOrders.length} طلب</span>
                              {totalBill > 0 && <span className="text-[10px] font-bold text-primary">{totalBill} ج</span>}
                            </div>
                            {pendingCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Hourglass className="h-2.5 w-2.5 text-amber-400" />
                                <span className="text-[9px] text-amber-400">{pendingCount} ينتظر</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Orders with no table */}
                {tableOrdersMap['بلا طاولة'] && tableOrdersMap['بلا طاولة'].length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-xs font-semibold text-indigo-400 mb-2">طلبات بدون طاولة محددة</p>
                    <div className="space-y-1">
                      {tableOrdersMap['بلا طاولة'].map(o => (
                        <div key={o.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-300">{o.drink?.name}</span>
                          <span className="text-zinc-500">{o.customer_name || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => { fetchPlaceTableCount(); }} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث خريطة الطاولات
                </button>
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="drinks" className="space-y-6">
          {/* Add new drink */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">إضافة صنف جديد</h3>
            <div className="space-y-4">
              {/* Dev admin: place selector */}
              {isDevAdmin && (
                <div>
                  <Label className="text-muted-foreground">المكان</Label>
                  <select
                    value={devDrinkPlaceId}
                    onChange={e => setDevDrinkPlaceId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-foreground text-sm"
                  >
                    <option value="">— اختر المكان —</option>
                    {places.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div 
                className="relative mx-auto h-24 w-24 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                {newDrinkImage ? (
                  <Image src={newDrinkImage} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="mt-1 text-xs">رفع صورة</span>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">اسم الصنف</Label>
                  <Input
                    value={newDrinkName}
                    onChange={(e) => setNewDrinkName(e.target.value)}
                    placeholder="مثال: كابتشينو"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">السعر (اختياري)</Label>
                  <Input
                    type="number"
                    value={newDrinkPrice}
                    onChange={(e) => setNewDrinkPrice(e.target.value)}
                    placeholder="0"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">الكمية الابتدائية في المخزون</Label>
                <Input
                  type="number"
                  value={newDrinkInitialStock}
                  onChange={(e) => setNewDrinkInitialStock(e.target.value)}
                  placeholder="100"
                  min="0"
                  className="mt-1 border-border bg-muted text-foreground"
                />
              </div>
              {/* Category selector */}
              <div>
                <Label className="text-muted-foreground">القسم</Label>
                <div className="mt-1 flex gap-2">
                  {([
                    { key: 'hot', label: '☕ Hot', color: 'bg-red-500' },
                    { key: 'cold', label: '🧊 Cold', color: 'bg-blue-500' },
                    { key: 'shisha', label: '💨 Shisha', color: 'bg-purple-500' },
                  ] as const).map(({ key, label, color }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewDrinkCategory(key)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                        newDrinkCategory === key
                          ? `${color} text-white shadow-sm`
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Button 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
                onClick={handleAddDrink} 
                disabled={!newDrinkName.trim() || (isDevAdmin && !devDrinkPlaceId)}
              >
                <Plus className="ml-2 h-4 w-4" />
                إضافة الصنف
              </Button>
            </div>
          </div>

          {/* Drinks list */}
          {isDevAdmin ? (
            /* Dev admin: filter by selected place */
            !devDrinkPlaceId ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-muted-foreground text-sm">اختر مكاناً من الأعلى لعرض أصنافه</p>
              </div>
            ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              {(() => {
                const placeDrinks = drinks.filter(d => d.place_id === devDrinkPlaceId)
                const placeName = places.find(p => p.id === devDrinkPlaceId)?.name
                return (
                  <>
                    <h3 className="mb-4 font-semibold text-foreground">
                      أصناف {placeName} <span className="text-muted-foreground font-normal text-sm">({placeDrinks.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {placeDrinks.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">لا توجد أصناف في هذا المكان بعد</p>
                      )}
                      {placeDrinks.map(drink => (
                        <div key={drink.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-card">
                              {drink.image_url ? (
                                <Image src={drink.image_url} alt={drink.name} fill className="object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <Coffee className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{drink.name}</p>
                              <div className="flex items-center gap-2">
                                {Number(drink.price) > 0 && <p className="text-xs text-primary">{Number(drink.price)} ج.م</p>}
                                <span className="text-[10px] text-muted-foreground">{drink.category === 'hot' ? '☕' : drink.category === 'cold' ? '🧊' : '💨'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(drink)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="border-border bg-card">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
                                  <AlertDialogDescription>حذف &quot;{drink.name}&quot;؟ لا يمكن التراجع.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteDrink(drink.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
            )
          ) : (
          /* Place admin: flat list */
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">الأصناف الحالية ({drinks.length})</h3>
            <div className="space-y-2">
              {drinks.map((drink) => (
                <div 
                  key={drink.id} 
                  className="flex items-center justify-between rounded-xl bg-muted p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-card">
                      {drink.image_url ? (
                        <Image src={drink.image_url} alt={drink.name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg text-muted-foreground">
                          <Coffee className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{drink.name}</p>
                      {Number(drink.price) > 0 && (
                        <p className="text-xs text-primary">{Number(drink.price)} ج.م</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(drink)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">حذف الصنف</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف &quot;{drink.name}&quot;؟ هذا الإجراء لا يمكن التراجع عنه.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteDrink(drink.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </TabsContent>

        {/* Edit Drink Dialog - Controlled */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">تعديل الصنف</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div 
                className="relative mx-auto h-24 w-24 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-primary"
                onClick={() => editFileInputRef.current?.click()}
              >
                {editImage ? (
                  <Image src={editImage} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="mt-1 text-xs">رفع صورة</span>
                  </div>
                )}
              </div>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)}
              />
              <div>
                <Label className="text-muted-foreground">اسم الصنف</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 border-border bg-muted text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">السعر</Label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="mt-1 border-border bg-muted text-foreground"
                />
              </div>
              <Button 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
                onClick={handleEditDrink}
              >
                حفظ التعديلات
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          {/* Threshold + refresh row */}
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Package className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">حد الإنذار</span>
              <input
                type="number" min="0" value={lowStockThreshold}
                onChange={e => setLowStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 rounded-lg border border-amber-500/30 bg-transparent px-2 py-1 text-center text-sm font-bold text-amber-400 focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">وحدة</span>
            </div>
            <Button variant="outline" size="sm" className="border-border shrink-0" onClick={fetchInventory}>
              <RefreshCw className="ml-2 h-4 w-4" />
              تحديث
            </Button>
          </div>
          {/* Low-stock alert banner */}
          {(() => {
            const lowItems = drinks.filter(d => (inventoryMap[d.id] ?? 0) < lowStockThreshold)
            if (lowItems.length === 0) return null
            return (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                <p className="text-xs font-bold text-amber-400 mb-1">⚠️ {lowItems.length} {lowItems.length === 1 ? 'صنف' : 'أصناف'} وصلت لحد الإنذار</p>
                <p className="text-[10px] text-zinc-500">{lowItems.map(d => d.name).join(' · ')}</p>
              </div>
            )
          })()}

          {isDevAdmin ? (
            /* Dev admin: place selector then filtered inventory */
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <Label className="text-muted-foreground">اختر المكان لعرض مخزونه</Label>
                <select
                  value={inventoryDevPlaceId}
                  onChange={e => setInventoryDevPlaceId(e.target.value)}
                  className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان —</option>
                  {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {!inventoryDevPlaceId && (
                <p className="text-center text-muted-foreground py-8">اختر مكاناً لعرض المخزون</p>
              )}

              {inventoryDevPlaceId && (() => {
                const placeDrinks = drinks.filter(d => d.place_id === inventoryDevPlaceId)
                const placeName = places.find(p => p.id === inventoryDevPlaceId)?.name
                return (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">📍 {placeName}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{placeDrinks.length} صنف</span>
                    </div>
                    {placeDrinks.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">لا توجد أصناف لهذا المكان</p>
                    ) : (
                      <div className="space-y-3">
                        {placeDrinks.map(drink => {
                          const qty = inventoryMap[drink.id] ?? 0
                          return (
                          <div key={drink.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-card">
                                {drink.image_url ? (
                                  <Image src={drink.image_url} alt={drink.name} fill className="object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <Coffee className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{drink.name}</p>
                                <div className="flex items-center gap-2">
                                  {Number(drink.price) > 0 && <p className="text-xs text-primary">{Number(drink.price)} ج.م</p>}
                                  {qty === 0 && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">Out of Stock</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8 border-border"
                                onClick={() => updateInventory(drink.id, Math.max(0, qty - 1))}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input type="number" value={qty}
                                onChange={e => updateInventory(drink.id, parseInt(e.target.value) || 0)}
                                className={`h-8 w-16 border-border bg-card text-center font-bold ${qty === 0 ? 'text-destructive' : 'text-foreground'}`} min="0" />
                              <Button variant="outline" size="icon" className="h-8 w-8 border-border"
                                onClick={() => updateInventory(drink.id, qty + 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
          /* Place admin: flat list */
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">إدارة المخزون ({drinks.length} صنف)</h3>
            <div className="space-y-3">
              {drinks.map((drink) => {
                const qty = inventoryMap[drink.id] ?? 0
                const isLow = qty < lowStockThreshold && qty > 0
                const isOut = qty === 0
                return (
                <div key={drink.id} className="flex items-center justify-between rounded-xl p-4 transition-all"
                  style={{
                    background: isOut ? 'rgba(239,68,68,0.06)' : isLow ? 'rgba(251,191,36,0.06)' : 'hsl(var(--muted))',
                    border: isOut ? '1px solid rgba(239,68,68,0.25)' : isLow ? '1px solid rgba(251,191,36,0.2)' : 'transparent'
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-card">
                      {drink.image_url ? (
                        <Image src={drink.image_url} alt={drink.name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg text-muted-foreground">
                          <Coffee className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{drink.name}</p>
                      <div className="flex items-center gap-2">
                        {Number(drink.price) > 0 && <p className="text-xs text-primary">{Number(drink.price)} ج.م</p>}
                        {isOut && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">نفد</span>}
                        {isLow && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">⚠️ منخفض</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-10 w-10 border-border"
                      onClick={() => updateInventory(drink.id, Math.max(0, qty - 1))}>
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Input type="number" value={qty}
                      onChange={e => updateInventory(drink.id, parseInt(e.target.value) || 0)}
                      className={`h-10 w-20 border-border bg-card text-center text-lg font-bold ${isOut ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-foreground'}`} min="0" />
                    <Button variant="outline" size="icon" className="h-10 w-10 border-border"
                      onClick={() => updateInventory(drink.id, qty + 1)}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
          )}
        </TabsContent>

        {/* ── Place Admins Tab (Dev Admin only) ── */}
        <TabsContent value="place-admins" className="space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                    <UserCog className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">أدمنز الأماكن</h3>
                    <p className="text-xs text-violet-300">
                      {users.filter(u => u.role === 'admin').length} أدمن في {places.length} مكان
                    </p>
                  </div>
                </div>
                <Button size="sm" className="gap-1 text-xs" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }} onClick={() => { setShowCreateUser(v => !v); setCreateUserError(''); setCreateUserName(''); setCreateUserPassword(''); setCreateUserConfirmPass(''); setCreateUserPlaceId(''); setCreateUserTableNum(''); setShowCreatePass(false) }}>
                  <Plus className="h-3 w-3" />أدمن جديد
                </Button>
              </div>
            </div>

            {/* Create admin form */}
            {showCreateUser && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <p className="text-sm font-semibold text-violet-300">إنشاء أدمن مكان جديد</p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">المكان</label>
                  <select value={createUserPlaceId} onChange={e => setCreateUserPlaceId(e.target.value)} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    <option value="">— اختر المكان —</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">اسم الأدمن</label>
                  <Input value={createUserName} onChange={e => setCreateUserName(e.target.value)} placeholder="اسم أدمن المكان..." className="border-border bg-muted text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">الباسورد</label>
                  <div className="relative">
                    <Input type={showCreatePass ? 'text' : 'password'} value={createUserPassword} onChange={e => setCreateUserPassword(e.target.value)} placeholder="باسورد الأدمن..." className="border-border bg-muted text-foreground text-sm pr-9" />
                    <button type="button" onClick={() => setShowCreatePass(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {createUserPassword.trim() && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">تأكيد الباسورد</label>
                    <div className="relative">
                      <Input type={showCreatePass ? 'text' : 'password'} value={createUserConfirmPass} onChange={e => setCreateUserConfirmPass(e.target.value)} placeholder="أعد الباسورد..." className="border-border bg-muted text-foreground text-sm pr-9" />
                      <button type="button" onClick={() => setShowCreatePass(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {createUserError && <p className="text-xs text-destructive text-center">{createUserError}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }} onClick={async () => {
                    if (!createUserPlaceId) { setCreateUserError('اختر المكان أولاً'); return }
                    if (!createUserName.trim()) { setCreateUserError('أدخل اسم الأدمن'); return }
                    if (!createUserPassword.trim()) { setCreateUserError('الباسورد مطلوب للأدمن'); return }
                    if (createUserPassword !== createUserConfirmPass) { setCreateUserError('الباسورد غير متطابق'); return }
                    setIsCreatingUser(true)
                    setCreateUserError('')
                    try {
                      const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: createUserName.trim(), password: createUserPassword, role: 'admin', place_id: createUserPlaceId })
                      })
                      if (!res.ok) throw new Error('Failed')
                      toast.success('تم إنشاء أدمن المكان بنجاح')
                      setShowCreateUser(false)
                      onRefreshUsers?.()
                    } catch { setCreateUserError('فشل إنشاء الأدمن') }
                    setIsCreatingUser(false)
                  }} disabled={isCreatingUser}>
                    {isCreatingUser ? '⏳ جاري...' : '✓ إنشاء أدمن'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-border" onClick={() => setShowCreateUser(false)}>إلغاء</Button>
                </div>
              </div>
            )}

            {/* Places with their admins */}
            {places.length === 0 && (
              <p className="text-center text-muted-foreground py-6">جاري تحميل الأماكن...</p>
            )}
            {places.map(place => {
              const placeAdmins = users.filter(u => u.place_id === place.id && u.role === 'admin')
              const placeNonAdmins = users.filter(u => u.place_id === place.id && u.role !== 'admin')
              return (
                <div key={place.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.15)' }}>
                  {/* Place header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08))' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-violet-300">📍 {place.name}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: placeAdmins.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: placeAdmins.length > 0 ? '#6ee7b7' : '#fca5a5' }}>
                        {placeAdmins.length > 0 ? `${placeAdmins.length} أدمن` : 'بدون أدمن'}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{placeNonAdmins.length} مستخدم عادي</span>
                  </div>

                  <div className="p-4 space-y-2 bg-card">
                    {/* Current admins */}
                    {placeAdmins.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-3">لا يوجد أدمن لهذا المكان</p>
                    )}
                    {placeAdmins.map(admin => (
                      <div key={admin.id} className="flex items-center justify-between rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-violet-300">{admin.name}</span>
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}>👑 أدمن</span>
                          </div>
                          {admin.password ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-xs text-muted-foreground font-mono">
                                {revealedPassUserId === admin.id ? admin.password : '●●●●●'}
                              </p>
                              <button type="button" onClick={() => setRevealedPassUserId(v => v === admin.id ? null : admin.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                                {revealedPassUserId === admin.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground mt-0.5">بدون باسورد</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] border-violet-500/30 hover:bg-violet-500/10" onClick={() => openSetPassword(admin)}>
                                <Key className="ml-1 h-3 w-3" />باسورد
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="border-border bg-card">
                              <DialogHeader>
                                <DialogTitle className="text-foreground">تعيين باسورد لـ {admin.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="relative">
                                  <Input type={showNewPass ? 'text' : 'password'} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="الباسورد الجديد..." className="border-border bg-muted text-foreground pr-10" />
                                  <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                <div className="relative">
                                  <Input type={showNewPass ? 'text' : 'password'} value={confirmUserPassword} onChange={e => setConfirmUserPassword(e.target.value)} placeholder="تأكيد الباسورد..." className="border-border bg-muted text-foreground pr-10" />
                                  <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                {passwordError && <p className="text-center text-sm text-destructive">{passwordError}</p>}
                                <Button className="w-full" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }} onClick={handleSetPassword}>حفظ الباسورد</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] border-amber-500/30 hover:bg-amber-500/10" onClick={() => {}}>
                                <Minus className="ml-1 h-3 w-3" />سحب الأدمن
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-border bg-card">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">سحب صلاحية الأدمن</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من سحب صلاحية الأدمن من &quot;{admin.name}&quot;؟ سيصبح مستخدم عادي.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction className="bg-amber-600 text-white hover:bg-amber-700" onClick={async () => {
                                  try {
                                    await fetch(`/api/users/${admin.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'customer' }) })
                                    toast.success(`تم سحب صلاحية الأدمن من ${admin.name}`)
                                    onRefreshUsers?.()
                                  } catch { toast.error('فشل سحب الصلاحية') }
                                }}>سحب الأدمن</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-border bg-card">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الأدمن</AlertDialogTitle>
                                <AlertDialogDescription>حذف &quot;{admin.name}&quot; نهائياً؟ لا يمكن التراجع.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onUserDelete(admin.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}

                    {/* Promote existing user to admin */}
                    {placeNonAdmins.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">ترقية مستخدم لأدمن:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {placeNonAdmins.slice(0, 10).map(u => (
                            <AlertDialog key={u.id}>
                              <AlertDialogTrigger asChild>
                                <button className="rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-violet-500/15" style={{ background: 'rgba(255,255,255,0.05)', color: '#a5b4fc', border: '1px solid rgba(124,58,237,0.15)' }}>
                                  <UserPlus className="inline h-3 w-3 ml-1" />{u.name}
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="border-border bg-card">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-foreground">ترقية لأدمن</AlertDialogTitle>
                                  <AlertDialogDescription>ترقية &quot;{u.name}&quot; ليصبح أدمن في {place.name}؟</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }} onClick={async () => {
                                    try {
                                      await fetch(`/api/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin' }) })
                                      toast.success(`تم ترقية ${u.name} لأدمن`)
                                      onRefreshUsers?.()
                                    } catch { toast.error('فشل الترقية') }
                                  }}>ترقية</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ))}
                          {placeNonAdmins.length > 10 && (
                            <span className="text-[10px] text-muted-foreground self-center">+{placeNonAdmins.length - 10} آخرين</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {isDevAdmin ? null : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">المستخدمين ({users.filter(u => !placeId || u.place_id === placeId).length})</h3>
              <Button size="sm" className="gap-1 text-xs" style={{ background: 'linear-gradient(135deg, #92400e, #D4A017)', color: '#fff' }} onClick={() => { setShowCreateUser(true); setCreateUserError(''); setCreateUserName(''); setCreateUserPassword(''); setCreateUserConfirmPass(''); setCreateUserPlaceId(''); setCreateUserTableNum(''); setShowCreatePass(false) }}>
                <Plus className="h-3 w-3" />مستخدم جديد
              </Button>
            </div>

            {/* Create user dialog */}
            {showCreateUser && (
              <div className="mb-4 rounded-xl border border-border bg-muted p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">إنشاء مستخدم جديد</p>
                {isDevAdmin && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">المكان</label>
                    <select value={createUserPlaceId} onChange={e => setCreateUserPlaceId(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                      <option value="">— اختر المكان —</option>
                      {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">الاسم</label>
                  <Input value={createUserName} onChange={e => setCreateUserName(e.target.value)} placeholder="اسم المستخدم..." className="border-border bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">رقم الطاولة (اختياري)</label>
                  <Input value={createUserTableNum} onChange={e => setCreateUserTableNum(e.target.value)} placeholder="مثال: 5" className="border-border bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">الباسورد (اختياري)</label>
                  <div className="relative">
                    <Input type={showCreatePass ? 'text' : 'password'} value={createUserPassword} onChange={e => setCreateUserPassword(e.target.value)} placeholder="الباسورد..." className="border-border bg-card text-foreground text-sm pr-9" />
                    <button type="button" onClick={() => setShowCreatePass(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {createUserPassword.trim() && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">تأكيد الباسورد</label>
                    <div className="relative">
                      <Input type={showCreatePass ? 'text' : 'password'} value={createUserConfirmPass} onChange={e => setCreateUserConfirmPass(e.target.value)} placeholder="أعد الباسورد..." className="border-border bg-card text-foreground text-sm pr-9" />
                      <button type="button" onClick={() => setShowCreatePass(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {createUserError && <p className="text-xs text-destructive text-center">{createUserError}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" style={{ background: 'linear-gradient(135deg, #92400e, #D4A017)', color: '#fff' }} onClick={handleCreateUser} disabled={isCreatingUser}>
                    {isCreatingUser ? '⏳ جاري...' : '✓ إنشاء'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-border" onClick={() => setShowCreateUser(false)}>إلغاء</Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {users.filter(u => !placeId || u.place_id === placeId).map((user) => (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between rounded-xl p-3 ${
                    user.role === 'admin'
                      ? 'bg-amber-500/15 border border-amber-500/30'
                      : 'bg-muted'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${user.role === 'admin' ? 'text-amber-400' : 'text-foreground'}`}>{user.name}</p>
                      {user.role === 'admin' && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">👑 أدمن</span>
                      )}
                    </div>
                    {user.password ? (
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground font-mono">
                          {revealedPassUserId === user.id ? user.password : '●●●●●'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRevealedPassUserId(v => v === user.id ? null : user.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={revealedPassUserId === user.id ? 'إخفاء الباسورد' : 'إظهار الباسورد'}
                        >
                          {revealedPassUserId === user.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">بدون باسورد</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* Set new password button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-border" onClick={() => openSetPassword(user)}>
                          <Key className="ml-2 h-3 w-3" />
                          باسورد
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="border-border bg-card">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">تعيين باسورد جديد لـ {user.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-muted-foreground">الباسورد الجديد</Label>
                            <div className="relative mt-1">
                              <Input
                                type={showNewPass ? 'text' : 'password'}
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                placeholder="أدخل الباسورد الجديد..."
                                className="border-border bg-muted text-foreground pr-10"
                              />
                              <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">تأكيد الباسورد</Label>
                            <div className="relative mt-1">
                              <Input
                                type={showNewPass ? 'text' : 'password'}
                                value={confirmUserPassword}
                                onChange={(e) => setConfirmUserPassword(e.target.value)}
                                placeholder="أعد كتابة الباسورد..."
                                className="border-border bg-muted text-foreground pr-10"
                              />
                              <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          {passwordError && (
                            <p className="text-center text-sm text-destructive">{passwordError}</p>
                          )}
                          <Button 
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
                            onClick={handleSetPassword}
                          >
                            حفظ الباسورد
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Reset password button (if has password) */}
                    {user.password && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="border-border">
                            <RefreshCw className="ml-2 h-3 w-3" />
                            ريسيت
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">ريسيت الباسورد</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من إزالة باسورد &quot;{user.name}&quot;؟
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => onUserPasswordReset(user.id)}
                              className="bg-primary text-primary-foreground"
                            >
                              ريسيت
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Delete user button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">حذف المستخدم</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف &quot;{user.name}&quot;؟ هذا الإجراء لا يمكن التراجع عنه.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onUserDelete(user.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {users.filter(u => !placeId || u.place_id === placeId).length === 0 && (
                <p className="text-center text-muted-foreground">لا يوجد مستخدمين حتى الآن</p>
              )}
            </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">

          {/* ── Broadcast Message (dev admin only) ── */}
          {isDevAdmin && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📣</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">رسالة جماعية</h3>
                  <p className="text-xs text-muted-foreground">ترسل لكل الأماكن دفعة واحدة ({places.length} مكان)</p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="عنوان الرسالة — مثال: تنبيه هام"
                  className="border-border bg-muted text-foreground text-sm"
                />
                <textarea
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="نص الرسالة التي ستصل لكل الأماكن..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button
                className="w-full"
                style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }}
                onClick={handleBroadcast}
                disabled={isBroadcasting || places.length === 0}
              >
                {isBroadcasting ? 'جاري الإرسال...' : `📣 إرسال لكل الأماكن (${places.length})`}
              </Button>
            </div>
          )}

          {/* Dev admin only: place admin activity notifications */}
          {isDevAdmin && (
            <div className="rounded-2xl border border-amber-500/40 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔔</span>
                  <h3 className="font-semibold text-foreground">إشعارات نشاط أدمن المكان</h3>
                  {devNotifsUnread > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">{devNotifsUnread}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {devNotifsUnread > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/dev-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) })
                        fetchDevNotifs()
                      }}
                      className="text-xs text-primary hover:underline"
                    >تحديد كمقروء</button>
                  )}
                  {devNotifs.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsClearingNotifs(true)
                        await fetch('/api/dev-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) })
                        await fetchDevNotifs()
                        setIsClearingNotifs(false)
                      }}
                      disabled={isClearingNotifs}
                      className="text-xs text-red-400 hover:underline"
                    >مسح الكل</button>
                  )}
                </div>
              </div>
              {devNotifs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">لا توجد إشعارات بعد</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {devNotifs.map(n => (
                    <div
                      key={n.id}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm transition-colors ${n.is_read ? 'border-border bg-muted/30' : 'border-amber-500/50 bg-amber-500/5'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />}
                          <span className="font-medium text-foreground">{n.action}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{n.place_name}</span>
                        </div>
                        {n.details && <p className="text-muted-foreground text-xs truncate">{n.details}</p>}
                        <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.created_at).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/dev-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: n.id }) })
                          fetchDevNotifs()
                        }}
                        className="text-muted-foreground hover:text-red-400 flex-shrink-0 text-xs"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">إرسال رسالة للمستخدمين</h3>
            </div>
            <div className="space-y-4">
              {/* Dev admin: multi-place selector for message */}
              {isDevAdmin && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-muted-foreground">الأماكن المستهدفة</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMsgDevPlaceIds(places.map(p => p.id))}
                        className="text-xs text-primary hover:underline"
                      >
                        اختر الكل
                      </button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button
                        type="button"
                        onClick={() => setMsgDevPlaceIds([])}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted p-3 space-y-2 max-h-44 overflow-y-auto">
                    {places.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">لا توجد أماكن</p>
                    )}
                    {places.map(p => (
                      <label key={p.id} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-card transition-colors">
                        <input
                          type="checkbox"
                          checked={msgDevPlaceIds.includes(p.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setMsgDevPlaceIds(prev => [...prev, p.id])
                            } else {
                              setMsgDevPlaceIds(prev => prev.filter(id => id !== p.id))
                            }
                          }}
                          className="h-4 w-4 accent-primary rounded"
                        />
                        <span className="text-sm text-foreground">{p.name}</span>
                      </label>
                    ))}
                  </div>
                  {msgDevPlaceIds.length > 0 && (
                    <p className="mt-1.5 text-xs text-green-400">
                      ✓ ستُرسل لـ {msgDevPlaceIds.length} {msgDevPlaceIds.length === 1 ? 'مكان' : 'أماكن'}
                      {msgDevPlaceIds.length === places.length ? ' (كل الأماكن)' : ''}
                    </p>
                  )}
                  {msgDevPlaceIds.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-400">اختر مكاناً واحداً على الأقل</p>
                  )}
                </div>
              )}
              {!isDevAdmin && placeId && (
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                  📍 الرسالة ستُرسل لمستخدمي مكانك فقط
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">عنوان الرسالة</Label>
                <Input
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="مثال: إعلان مهم..."
                  className="mt-1 border-border bg-muted text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">نص الرسالة</Label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={4}
                  className="mt-1 w-full resize-none rounded-md border border-border bg-muted p-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {messageSent && (
                <div className="rounded-lg bg-green-500/20 p-3 text-center text-green-600">
                  تم إرسال الرسالة بنجاح!
                </div>
              )}
              {messagesDeleted && (
                <div className="rounded-lg bg-red-500/20 p-3 text-center text-red-600">
                  تم حذف جميع ��لرسائل!
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" 
                  onClick={handleSendMessage}
                  disabled={!messageTitle.trim() || !messageContent.trim() || isSendingMessage || (isDevAdmin && msgDevPlaceIds.length === 0)}
                >
                  {isSendingMessage ? (
                    <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="ml-2 h-4 w-4" />
                  )}
                  {isSendingMessage ? 'جاري الإرسال...' : 'إرسال الرسالة'}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                  onClick={handleDeleteMessages}
                  disabled={isDeletingMessages}
                  title="حذف جميع الرسائل"
                >
                  {isDeletingMessages ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">

          {/* Staff Page Link Card */}
          <div className="rounded-2xl overflow-hidden border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/5">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold text-foreground">رابط صفحة الستاف</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">ابعت الرابط ده للموظفين عشان يدخلوا على صفحتهم مباشرةً</p>
              <div className="flex items-center gap-2 rounded-xl bg-muted/80 border border-border px-4 py-3 mb-3">
                <span className="flex-1 text-sm font-mono text-violet-300 truncate" dir="ltr">
                  {staffOrigin ? `${staffOrigin}/staff` : '.../staff'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={handleCopyStaffUrl}
                >
                  {staffUrlCopied ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-500" /> تم النسخ!</>
                  ) : (
                    <><Copy className="h-4 w-4" /> نسخ الرابط</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 px-4"
                  onClick={() => window.open('/staff', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح
                </Button>
              </div>
            </div>
          </div>

          {/* Add Cashier */}
          <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: 'rgba(16,185,129,0.25)' }}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <UserCog className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">إضافة بار مان جديد</p>
                <p className="text-[11px] text-muted-foreground">وصول لصفحة الكاشير وإدارة الطلبات</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الاسم الكامل</Label>
                <Input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="مثال: أحمد محمد" className="border-border bg-muted text-foreground h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">اسم المستخدم</Label>
                  <Input value={newStaffUsername} onChange={(e) => setNewStaffUsername(e.target.value)} placeholder="ahmed" dir="ltr" className="border-border bg-muted text-foreground h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">كلمة المرور</Label>
                  <Input type="password" value={newStaffPassword} onChange={(e) => setNewStaffPassword(e.target.value)} placeholder="••••••" dir="ltr" className="border-border bg-muted text-foreground h-9 text-sm" />
                </div>
              </div>
              {isDevAdmin && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">المكان</Label>
                  <select value={newStaffPlaceId} onChange={(e) => setNewStaffPlaceId(e.target.value)} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground h-9">
                    <option value="">-- اختر المكان --</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {staffAdded && <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/25 p-2.5 text-center text-xs text-emerald-500 font-medium">✓ تم إضافة البار مان بنجاح</div>}
              <Button onClick={handleAddStaffUser} disabled={isAddingStaff || !newStaffUsername.trim() || !newStaffPassword.trim() || !newStaffName.trim() || (isDevAdmin && !newStaffPlaceId)}
                className="w-full h-9 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {isAddingStaff ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isAddingStaff ? 'جاري الإضافة...' : 'إضافة بار مان'}
              </Button>
            </div>
          </div>

          {/* Staff Users List — Cashiers */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={fetchStaffUsers}>
                <RefreshCw className="ml-2 h-4 w-4" />
                تحديث
              </Button>
              <h3 className="font-semibold text-foreground">الكاشيرين الحاليين</h3>
            </div>
            <div className="space-y-3">
              {(() => {
                const scope = placeId ? staffUsers.filter(s => s.place_id === placeId) : staffUsers
                const cashiers = scope.filter(s => !s.role || s.role === 'cashier')
                return cashiers.length > 0 ? cashiers.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">حذف الموظف</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف {staff.name}؟</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteStaffUser(staff.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStaffActive(staff.id, staff.is_active)} className={staff.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                        {staff.is_active ? 'نشط' : 'معطل'}
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{staff.name}</p>
                      <p className="text-sm text-muted-foreground">@{staff.username}</p>
                      {staff.place_id && isDevAdmin && (
                        <span className="inline-block mt-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          📍 {places.find(p => p.id === staff.place_id)?.name || 'مكان'}
                        </span>
                      )}
                    </div>
                  </div>
                )) : <p className="text-center text-muted-foreground">لا يوجد كاشيرين بعد</p>
              })()}
            </div>
          </div>

          {/* ══════════ WAITER SECTION ══════════ */}
          {/* Waiter URL Card */}
          <div className="rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 mt-2">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🛎️</span>
                <h3 className="font-semibold text-foreground">إدارة الويتر</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">ابعت الرابط ده للويتر عشان يدخل على صفحته مباشرةً</p>
              <div className="flex items-center gap-2 rounded-xl bg-muted/80 border border-border px-4 py-3 mb-3">
                <span className="flex-1 text-sm font-mono text-amber-300 truncate" dir="ltr">
                  {staffOrigin ? `${staffOrigin}/waiter` : '.../waiter'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(`${staffOrigin}/waiter`)
                  setWaiterUrlCopied(true)
                  setTimeout(() => setWaiterUrlCopied(false), 2500)
                }}>
                  {waiterUrlCopied ? <><CheckCircle2 className="h-4 w-4 text-green-500" /> تم النسخ!</> : <><Copy className="h-4 w-4" /> نسخ الرابط</>}
                </Button>
                <Button variant="outline" className="gap-2 px-4" onClick={() => window.open('/waiter', '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                  فتح
                </Button>
              </div>
            </div>
          </div>

          {/* Add Waiter Form */}
          <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: 'rgba(212,160,23,0.25)' }}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ background: 'rgba(212,160,23,0.06)', borderColor: 'rgba(212,160,23,0.15)' }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: 'rgba(212,160,23,0.15)' }}>
                🛎️
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">إضافة ويتر جديد</p>
                <p className="text-[11px] text-muted-foreground">وصول لصفحة الويتر وتتبع الطلبات</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الاسم الكامل</Label>
                <Input value={newWaiterName} onChange={(e) => setNewWaiterName(e.target.value)} placeholder="مثال: محمد علي" className="border-border bg-muted text-foreground h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">اسم المستخدم</Label>
                  <Input value={newWaiterUsername} onChange={(e) => setNewWaiterUsername(e.target.value)} placeholder="mohamed" dir="ltr" className="border-border bg-muted text-foreground h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">كلمة المرور</Label>
                  <Input type="password" value={newWaiterPassword} onChange={(e) => setNewWaiterPassword(e.target.value)} placeholder="••••••" dir="ltr" className="border-border bg-muted text-foreground h-9 text-sm" />
                </div>
              </div>
              {isDevAdmin && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">المكان</Label>
                  <select value={newWaiterPlaceId} onChange={(e) => setNewWaiterPlaceId(e.target.value)} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground h-9">
                    <option value="">-- اختر المكان --</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {waiterAdded && <div className="rounded-lg p-2.5 text-center text-xs font-medium" style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.25)', color: '#D4A017' }}>✓ تم إضافة الويتر بنجاح</div>}
              {waiterError && <div className="rounded-lg p-2.5 text-center text-xs font-medium" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}>⚠ {waiterError}</div>}
              <button onClick={handleAddWaiter} disabled={isAddingWaiter || !newWaiterUsername.trim() || !newWaiterPassword.trim() || !newWaiterName.trim() || (isDevAdmin && !newWaiterPlaceId)}
                className="w-full h-9 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800' }}>
                {isAddingWaiter ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isAddingWaiter ? 'جاري الإضافة...' : 'إضافة ويتر'}
              </button>
            </div>
          </div>

          {/* Waiters List */}
          <div className="rounded-2xl border border-amber-500/20 bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={fetchStaffUsers}>
                <RefreshCw className="ml-2 h-4 w-4" />
                تحديث
              </Button>
              <h3 className="font-semibold text-foreground">الويتر الحاليين</h3>
            </div>
            <div className="space-y-3">
              {(() => {
                const scope = placeId ? staffUsers.filter(s => s.place_id === placeId) : staffUsers
                const waiters = scope.filter(s => s.role === 'waiter')
                return waiters.length > 0 ? waiters.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">حذف الويتر</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف {staff.name}؟</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteStaffUser(staff.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStaffActive(staff.id, staff.is_active)} className={staff.is_active ? 'text-amber-500' : 'text-muted-foreground'}>
                        {staff.is_active ? 'نشط' : 'معطل'}
                      </Button>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: 'rgba(212,160,23,0.15)', color: '#D4A017' }}>🛎️ ويتر</span>
                        <p className="font-medium text-foreground">{staff.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">@{staff.username}</p>
                      {staff.place_id && isDevAdmin && (
                        <span className="inline-block mt-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          📍 {places.find(p => p.id === staff.place_id)?.name || 'مكان'}
                        </span>
                      )}
                    </div>
                  </div>
                )) : <p className="text-center text-muted-foreground">لا يوجد ويتر بعد</p>
              })()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">

          {/* ── Place Closed Mode (place admin only) ── */}
          {!isDevAdmin && placeId && (
            <div className="rounded-2xl p-4 space-y-3" style={{
              background: isPlaceClosed ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.04)',
              border: `1px solid ${isPlaceClosed ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.2)'}`
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isPlaceClosed ? '🔴 المكان مغلق' : '🟢 المكان مفتوح'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isPlaceClosed ? 'الزبائن لا يستطيعون الطلب حالياً' : 'الطلبات تعمل بشكل طبيعي'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setIsSavingClosedStatus(true)
                    const next = !isPlaceClosed
                    try {
                      await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `place_closed_${placeId}`, value: next.toString() })
                      })
                      setIsPlaceClosed(next)
                      toast.success(next ? '🔴 تم إغلاق المكان' : '🟢 تم فتح المكان')
                    } catch { toast.error('خطأ في تغيير حالة المكان') }
                    finally { setIsSavingClosedStatus(false) }
                  }}
                  disabled={isSavingClosedStatus}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${isPlaceClosed ? 'bg-destructive' : 'bg-emerald-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${isPlaceClosed ? 'translate-x-1' : 'translate-x-6'}`} />
                </button>
              </div>

              {isPlaceClosed && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-muted-foreground">رسالة الإغلاق (تظهر للزبون)</Label>
                  <Input
                    value={placeClosedMsg}
                    onChange={e => setPlaceClosedMsg(e.target.value)}
                    className="border-border bg-muted text-foreground text-sm"
                    placeholder="مثال: المكان مغلق حالياً للصيانة"
                  />
                  <Button size="sm" variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `place_closed_message_${placeId}`, value: placeClosedMsg })
                      })
                      toast.success('تم حفظ رسالة الإغلاق')
                    }}
                  >
                    حفظ الرسالة
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Archive Password Setting — dev admin only */}
          {isDevAdmin && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" /> كلمة سر الأرشيف
              </h3>
              <p className="text-xs text-muted-foreground">
                حدد كلمة سر للوصول للـ SîpFlõw القديمة المؤرشفة. المستخدمين العاديين سيحتاجون هذه الكلمة لرؤية الأرشيف.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <Label className="text-xs text-muted-foreground">كلمة السر الجديدة</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showArchivePassword ? 'text' : 'password'}
                      value={archivePassword}
                      onChange={e => { setArchivePassword(e.target.value); setArchivePasswordError(''); setArchivePasswordSuccess('') }}
                      placeholder="أدخل كلمة سر الأرشيف"
                      className="border-border bg-muted text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowArchivePassword(!showArchivePassword)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showArchivePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">تأكيد كلمة السر</Label>
                  <Input
                    type={showArchivePassword ? 'text' : 'password'}
                    value={archivePasswordConfirm}
                    onChange={e => { setArchivePasswordConfirm(e.target.value); setArchivePasswordError(''); setArchivePasswordSuccess('') }}
                    placeholder="أعد كتابة كلمة السر"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
                {archivePasswordError && (
                  <p className="text-sm text-destructive">{archivePasswordError}</p>
                )}
                {archivePasswordSuccess && (
                  <p className="text-sm text-green-500">{archivePasswordSuccess}</p>
                )}
                <Button
                  className="w-full"
                  style={{ background: 'linear-gradient(135deg, #D4A017, #f97316)', color: '#0f0800' }}
                  disabled={isSavingArchivePassword}
                  onClick={async () => {
                    if (!archivePassword.trim()) {
                      setArchivePasswordError('أدخل كلمة السر')
                      return
                    }
                    if (archivePassword !== archivePasswordConfirm) {
                      setArchivePasswordError('كلمة السر غير متطابقة')
                      return
                    }
                    if (archivePassword.length < 4) {
                      setArchivePasswordError('كلمة السر يجب أن تكون 4 أحرف على الأقل')
                      return
                    }
                    setIsSavingArchivePassword(true)
                    try {
                      const res = await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'archive_password', value: archivePassword })
                      })
                      if (!res.ok) throw new Error('Failed to save')
                      setArchivePasswordSuccess('تم حفظ كلمة سر الأرشيف بنجاح')
                      setArchivePassword('')
                      setArchivePasswordConfirm('')
                    } catch {
                      setArchivePasswordError('حدث خطأ أثناء الحفظ')
                    } finally {
                      setIsSavingArchivePassword(false)
                    }
                  }}
                >
                  <Key className="ml-2 h-4 w-4" />
                  {isSavingArchivePassword ? 'جاري الحفظ...' : 'حفظ كلمة السر'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Global Banner (dev admin only) ── */}
          {isDevAdmin && (
            <div className="rounded-2xl p-4 space-y-4" style={{
              background: globalBannerEnabled ? 'rgba(212,160,23,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${globalBannerEnabled ? 'rgba(212,160,23,0.4)' : 'rgba(255,255,255,0.08)'}`
            }}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📢</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">البنر العالمي</h3>
                    <p className="text-xs text-muted-foreground">يظهر لكل الزبائن في كل الأماكن</p>
                  </div>
                </div>
                <button
                  onClick={() => setGlobalBannerEnabled(v => !v)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${globalBannerEnabled ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${globalBannerEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Banner text */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">نص البنر</Label>
                <Input
                  value={globalBannerText}
                  onChange={e => setGlobalBannerText(e.target.value)}
                  placeholder="مثال: سيتم صيانة النظام الساعة 2 صباحاً"
                  className="border-border bg-muted text-foreground text-sm"
                />
              </div>

              {/* Color selector */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">لون البنر</Label>
                <div className="flex gap-2">
                  {[
                    { key: 'amber', label: '🟡 ذهبي' },
                    { key: 'red', label: '🔴 أحمر' },
                    { key: 'blue', label: '🔵 أزرق' },
                    { key: 'green', label: '🟢 أخضر' },
                  ].map(c => (
                    <button
                      key={c.key}
                      onClick={() => setGlobalBannerColor(c.key)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: globalBannerColor === c.key ? 'rgba(212,160,23,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${globalBannerColor === c.key ? 'rgba(212,160,23,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: globalBannerColor === c.key ? '#D4A017' : '#9ca3af'
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {globalBannerText && (
                <div className="rounded-lg px-3 py-2 text-xs font-medium text-center" style={{
                  background: globalBannerColor === 'amber' ? 'rgba(212,160,23,0.15)' :
                    globalBannerColor === 'red' ? 'rgba(239,68,68,0.15)' :
                    globalBannerColor === 'blue' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                  color: globalBannerColor === 'amber' ? '#D4A017' :
                    globalBannerColor === 'red' ? '#f87171' :
                    globalBannerColor === 'blue' ? '#60a5fa' : '#4ade80',
                  border: `1px solid ${globalBannerColor === 'amber' ? 'rgba(212,160,23,0.3)' :
                    globalBannerColor === 'red' ? 'rgba(239,68,68,0.3)' :
                    globalBannerColor === 'blue' ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)'}`
                }}>
                  📢 {globalBannerText}
                </div>
              )}

              <Button
                className="w-full"
                style={{ background: 'rgba(212,160,23,0.15)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.3)' }}
                onClick={handleSaveBanner}
                disabled={isSavingBanner}
              >
                {isSavingBanner ? 'جاري الحفظ...' : '💾 حفظ البنر'}
              </Button>
            </div>
          )}

          {/* Working Hours */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">ساعات العمل</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              حدد أوقات فتح وإغلاق المكان لإظهارها للعملاء
            </p>

            {/* Dev admin: place selector */}
            {isDevAdmin && (
              <div className="mb-4">
                <Label className="text-muted-foreground mb-1 block">اختر المكان</Label>
                <select
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  value={workingHoursPlaceId}
                  onChange={e => {
                    setWorkingHoursPlaceId(e.target.value)
                    loadWorkingHours(e.target.value)
                  }}
                >
                  <option value="">— اختر المكان —</option>
                  {places.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isLoadingHours ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day} className={`flex items-center justify-between rounded-xl p-3 gap-3 transition-opacity ${enabledDays[day] ? 'bg-muted' : 'bg-muted/40 opacity-60'}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        id={`day-${day}`}
                        checked={enabledDays[day] === true}
                        onCheckedChange={(val) => {
                          const next = val === true
                          setEnabledDays(prev => {
                            const updated = { ...prev, [day]: next }
                            enabledDaysRef.current = updated
                            return updated
                          })
                        }}
                        className="border-primary data-[state=checked]:bg-primary"
                      />
                      <Label htmlFor={`day-${day}`} className="font-medium text-foreground min-w-[70px] cursor-pointer">
                        {day}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[day]?.from || '10:00'}
                        disabled={!enabledDays[day]}
                        onChange={(e) => {
                          const val = e.target.value
                          setHours(prev => {
                            const updated = { ...prev, [day]: { ...prev[day], from: val } }
                            hoursRef.current = updated
                            return updated
                          })
                        }}
                        className="w-[100px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <input
                        type="time"
                        value={hours[day]?.to || '23:00'}
                        disabled={!enabledDays[day]}
                        onChange={(e) => {
                          const val = e.target.value
                          setHours(prev => {
                            const updated = { ...prev, [day]: { ...prev[day], to: val } }
                            hoursRef.current = updated
                            return updated
                          })
                        }}
                        className="w-[100px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isDevAdmin && !workingHoursPlaceId && (
              <p className="mt-3 text-center text-xs text-amber-400">⚠️ اختر المكان من القائمة أعلاه أولاً</p>
            )}
            <Button
              type="button"
              className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleSaveWorkingHours}
              disabled={isSavingHours || isLoadingHours}
            >
              {isSavingHours
                ? <><div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري الحفظ...</>
                : <><Clock className="ml-2 h-4 w-4" /> حفظ ساعات العمل</>
              }
            </Button>
          </div>

          {/* QR Code Manager — for place admin */}
          {!isDevAdmin && placeId && currentPlace && (
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-purple-400" /> مدير QR الطاولات
              </h3>
              <p className="text-xs text-muted-foreground">QR code لكل طاولة — اطبعه وضعه على الطاولة</p>
              {(() => {
                const placeTableUsers = users.filter(u => u.name?.startsWith('Guest-') && u.table_number)
                if (placeTableUsers.length === 0) {
                  return <p className="text-center text-muted-foreground text-sm py-2">لا توجد طاولات مسجلة بعد</p>
                }
                return (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[...placeTableUsers].sort((a, b) => (parseInt(a.table_number || '0') || 9999) - (parseInt(b.table_number || '0') || 9999)).map(u => (
                        <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-2 gap-2">
                          <span className="text-sm font-medium text-foreground">طاولة {u.table_number}</span>
                          <button
                            onClick={() => {
                              setQrTableInfo({ tableNumber: u.table_number!, placeCode: currentPlace.code, placeName: currentPlace.name })
                              setQrDialogOpen(true)
                            }}
                            className="flex items-center gap-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-2 py-1 text-xs transition-colors"
                          >
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const sorted = [...placeTableUsers].sort((a, b) => (parseInt(a.table_number || '0') || 9999) - (parseInt(b.table_number || '0') || 9999))
                        const win = window.open('', '_blank')
                        if (!win) return
                        const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR طاولات ${currentPlace.name}</title><style>body{font-family:Arial,sans-serif;background:#fff;padding:20px}h1{text-align:center;margin-bottom:30px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px}.card{border:2px solid #ddd;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}.card h2{font-size:18px;margin:0 0 12px}.card img{width:150px;height:150px}@media print{.no-print{display:none}}</style></head><body><h1>${currentPlace.name} — QR الطاولات</h1><div class="no-print" style="text-align:center;margin-bottom:20px"><button onclick="window.print()" style="padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">🖨️ طباعة الكل</button></div><div class="grid">${sorted.map(u => `<div class="card"><h2>طاولة ${u.table_number}</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?place=' + currentPlace.code + '&table=' + u.table_number)}" /></div>`).join('')}</div></body></html>`
                        win.document.write(html)
                        win.document.close()
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 py-2 text-sm transition-colors"
                    >
                      <Download className="h-4 w-4" /> طباعة كل QR للمكان
                    </button>
                  </>
                )
              })()}
            </div>
          )}

          {/* Feature toggles — for place admin */}
          {!isDevAdmin && placeId && currentPlace && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-amber-400" /> إعدادات الميزات
              </h3>

              {/* Order tracking toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <span>📍</span> تتبع حالة الطلب
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">يعرض للزبون شريط تتبع مباشر لحالة طلبه</p>
                </div>
                <button
                  onClick={() => handleToggleOrderTracking(placeId, !orderTrackingMap[placeId])}
                  disabled={isSavingTracking}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${orderTrackingMap[placeId] !== false ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${orderTrackingMap[placeId] !== false ? '-translate-x-1' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Reservations toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-400" /> الحجوزات المسبقة
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">يسمح للعملاء بحجز طاولة عبر رابط عام</p>
                </div>
                <button
                  onClick={() => handleToggleReservationsEnabled(placeId, !reservationsEnabledMap[placeId])}
                  disabled={isSavingResEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${reservationsEnabledMap[placeId] ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reservationsEnabledMap[placeId] ? '-translate-x-1' : 'translate-x-1'}`} />
                </button>
              </div>
              {(() => {
                const bookingUrl = `${window.location.origin}/reserve/${encodeURIComponent(currentPlace.code)}`
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold">رابط الحجز العام:</p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={bookingUrl} className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground" />
                      <button onClick={() => navigator.clipboard.writeText(bookingUrl)} className="rounded-lg border border-border bg-muted px-2 py-2 hover:bg-card transition-colors">
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border bg-muted px-2 py-2 hover:bg-card transition-colors">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">اذهب لتاب <span className="text-amber-400 font-medium">الحجوزات</span> لعرض وإدارة الحجوزات</p>
                  </div>
                )
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="danger" className="space-y-4">

          {/* ── Shift Summary Card ── */}
          {!isDevAdmin && (() => {
            const totalOrders = orders.length
            const totalRevenue = orders.reduce((s, o) => s + ((Number(o.drink?.price) || 0) * (o.quantity || 1)), 0)
            const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'ready').length
            const pendingOrders = orders.filter(o => o.status === 'pending').length
            const preparingOrders = orders.filter(o => o.status === 'preparing').length

            // Top drinks
            const drinkCounts: Record<string, { name: string; count: number }> = {}
            orders.forEach(o => {
              const n = o.drink?.name || '—'
              if (!drinkCounts[n]) drinkCounts[n] = { name: n, count: 0 }
              drinkCounts[n].count += (o.quantity || 1)
            })
            const topDrinks = Object.values(drinkCounts).sort((a, b) => b.count - a.count).slice(0, 3)

            // Category breakdown
            const catCounts: Record<string, number> = {}
            orders.forEach(o => { const c = o.drink?.category || 'other'; catCounts[c] = (catCounts[c] || 0) + (o.quantity || 1) })

            if (totalOrders === 0) return (
              <div className="rounded-2xl p-4 text-center" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p className="text-sm text-muted-foreground">لا توجد طلبات في هذه الجلسة</p>
              </div>
            )

            return (
              <div className="rounded-2xl p-4 space-y-4" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-foreground">ملخص الوردية الحالية</h3>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xl font-black text-foreground">{totalOrders}</p>
                    <p className="text-[10px] text-muted-foreground">إجمالي الطلبات</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(212,160,23,0.06)' }}>
                    <p className="text-xl font-black text-yellow-400">{totalRevenue.toFixed(0)} ج</p>
                    <p className="text-[10px] text-muted-foreground">الإيراد المتوقع</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.06)' }}>
                    <p className="text-xl font-black text-emerald-400">{completedOrders}</p>
                    <p className="text-[10px] text-muted-foreground">منجزة / جاهزة</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.06)' }}>
                    <p className="text-xl font-black text-amber-400">{pendingOrders + preparingOrders}</p>
                    <p className="text-[10px] text-muted-foreground">معلقة / تحضير</p>
                  </div>
                </div>

                {/* Top drinks */}
                {topDrinks.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2">الأكثر طلباً</p>
                    <div className="space-y-1.5">
                      {topDrinks.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <span className="text-foreground">{d.name}</span>
                          </div>
                          <span className="font-bold text-primary">{d.count} وحدة</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category breakdown */}
                {Object.keys(catCounts).length > 0 && (
                  <div className="flex gap-2">
                    {Object.entries(catCounts).map(([cat, count]) => {
                      const label = cat === 'hot' ? '☕' : cat === 'cold' ? '🧊' : cat === 'shisha' ? '💨' : '🍹'
                      return (
                        <div key={cat} className="flex-1 rounded-lg py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <p className="text-sm">{label}</p>
                          <p className="text-xs font-bold text-foreground">{count}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Bulk Delete Old Data (dev admin only) ── */}
          {isDevAdmin && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🗑️</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">ضغط البيانات القديمة</h3>
                  <p className="text-xs text-muted-foreground">احذف الجلسات والطلبات الأقدم من X شهر من كل الأماكن</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">أقدم من</Label>
                <select
                  value={bulkDeleteMonths}
                  onChange={e => setBulkDeleteMonths(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="1">1 شهر</option>
                  <option value="3">3 أشهر</option>
                  <option value="6">6 أشهر</option>
                  <option value="12">سنة</option>
                </select>
              </div>
              {bulkDeleteResult && (
                <p className="text-xs text-green-400 font-medium">✓ {bulkDeleteResult}</p>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }} disabled={isDeletingOldData}>
                    {isDeletingOldData ? 'جاري الحذف...' : `🗑️ احذف البيانات الأقدم من ${bulkDeleteMonths} شهر`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">تأكيد حذف البيانات القديمة</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف كل الجلسات والطلبات الأقدم من {bulkDeleteMonths} شهر من جميع الأماكن. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteOldData} className="bg-destructive text-destructive-foreground">
                      حذف البيانات
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4">
            <h3 className="mb-4 font-semibold text-destructive">بدء SîpFlõw جديدة</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              سيتم إنهاء SîpFlõw الحالية وفتح SîpFlõw جديدة فارغة. طلبات اليوم والأيام السابقة محفوظة في الأرشيف.
            </p>

            {/* Dev admin: must pick a place first */}
            {isDevAdmin && (
              <div className="mb-4">
                <Label className="text-muted-foreground">اختر المكان أولاً</Label>
                <select
                  value={resetPlaceId}
                  onChange={e => setResetPlaceId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان —</option>
                  {places.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {resetPlaceId && (
                  <p className="mt-2 text-xs text-amber-500">
                    ⚠️ سيتم بدء SîpFlõw جديدة لـ: {places.find(p => p.id === resetPlaceId)?.name}
                  </p>
                )}
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={isDevAdmin && !resetPlaceId}
                >
                  <RefreshCw className="ml-2 h-4 w-4" />
                  بدء SîpFlõw جديدة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">بدء SîpFlõw جديدة</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isDevAdmin && resetPlaceId
                      ? `سيتم إنهاء SîpFlõw الحالية لـ "${places.find(p => p.id === resetPlaceId)?.name}" وفتح SîpFlõw جديدة. الطلبات السابقة محفوظة في الأرشيف.`
                      : 'سيتم إنهاء SîpFlõw الحالية وفتح SîpFlõw جديدة. الطلبات السابقة محفوظة في الأرشيف.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetSession}
                    className="bg-destructive text-destructive-foreground"
                  >
                    بدء SîpFlõw جديدة
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* ─── Count (Delivered Items) Tab ─── */}
        <TabsContent value="count" className="space-y-4">
          {/* Dev admin: place selector for count */}
          {isDevAdmin && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <Label className="text-muted-foreground">اختر المكان لعرض حصر الأصناف المسلّمة</Label>
              <select
                value={countPlaceId}
                onChange={e => { setCountPlaceId(e.target.value); fetchCountForPlace(e.target.value) }}
                className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
              >
                <option value="">— اختر مكان —</option>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {isDevAdmin && !countPlaceId && (
            <p className="text-center text-muted-foreground py-8">اختر مكاناً لعرض الحصر</p>
          )}
          {isDevAdmin && countPlaceId && isFetchingCount && (
            <p className="text-center text-muted-foreground py-8">جاري تحميل الحصر...</p>
          )}
          
          {(!isDevAdmin || (countPlaceId && !isFetchingCount)) && (() => {
            // Get orders to use (dev admin uses countOrders, place admin uses orders prop)
            const ordersToUse = isDevAdmin ? countOrders : orders
            // Get completed/ready orders
            const completedOrders = ordersToUse.filter(o => o.status === 'ready' || o.status === 'completed')
            
            // Count delivered items by drink name
            const deliveredDrinks: Record<string, { drinkName: string; count: number }> = {}
            completedOrders.forEach(order => {
              const name = order.drink?.name || 'غير معروف'
              if (!deliveredDrinks[name]) deliveredDrinks[name] = { drinkName: name, count: 0 }
              deliveredDrinks[name].count += order.quantity || 1
            })
            const deliveredList = Object.values(deliveredDrinks).sort((a, b) => b.count - a.count)
            const totalDelivered = deliveredList.reduce((sum, d) => sum + d.count, 0)
            const todayDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

            const handlePrintCount = () => {
              const lines = [
                `حصر الأصناف المسلّمة - ${todayDate}`,
                '─'.repeat(40),
                '',
                'الصنف                  | الكمية المسلّمة',
                '─'.repeat(40),
                ...deliveredList.map(d => `${d.drinkName.padEnd(22)} | ${String(d.count).padStart(4)}`),
                '',
                '─'.repeat(40),
                `إجمالي الأصناف المسلّمة: ${totalDelivered}`,
              ].join('\n')
              const win = window.open('', '_blank')
              if (win) {
                win.document.write(`<pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre>`)
                win.document.close()
                win.print()
              }
            }

            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <Button onClick={handlePrintCount} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" size="sm">
                    <Download className="h-4 w-4" />
                    طباعة الحصر
                  </Button>
                  <p className="text-sm text-muted-foreground font-medium">{todayDate}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-card border border-amber-500/30 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-amber-500">{totalDelivered}</p>
                    <p className="text-xs text-muted-foreground mt-1">إجمالي الأصناف المسلّمة</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-primary">{deliveredList.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">أنواع مختلفة</p>
                  </div>
                </div>

                {deliveredList.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle2 className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
                    <p className="text-lg font-bold text-foreground mb-1">لا توجد أصناف مسلّمة بعد</p>
                    <p className="text-muted-foreground text-sm">الحصر هيظهر هنا بعد تسليم أول طلب</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground text-right mb-3 flex items-center justify-end gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      حصر الأصناف المسلّمة
                    </h3>
                    {deliveredList.map((item, idx) => {
                      const maxCount = deliveredList[0].count
                      const pct = Math.round((item.count / maxCount) * 100)
                      return (
                        <div key={item.drinkName} className="bg-card border border-border rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-left">
                              <span className="bg-amber-500/10 text-amber-500 text-xs font-bold rounded-full px-2 py-0.5">× {item.count}</span>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <span className="font-semibold text-foreground">{item.drinkName}</span>
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </TabsContent>

        {/* ─── Places Tab (Dev Admin only) ─── */}
        {isDevAdmin && (
          <TabsContent value="places" className="space-y-4">
            {/* Add new place */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> إضافة مكان جديد
              </h3>
              <div>
                <Label className="text-xs text-muted-foreground">اسم المكان <span className="text-primary">(هيكون نفس الكود اللي يكتبه العميل)</span></Label>
                <Input value={newPlaceName} onChange={e => setNewPlaceName(e.target.value)}
                  placeholder="مثال: كافيه النيل" className="mt-1 border-border bg-muted text-foreground" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">وصف (اختياري)</Label>
                <Input value={newPlaceDesc} onChange={e => setNewPlaceDesc(e.target.value)}
                  placeholder="وصف المكان..." className="mt-1 border-border bg-muted text-foreground" />
              </div>
              {placesError && <p className="text-sm text-destructive">{placesError}</p>}
              <Button className="w-full" onClick={handleAddPlace} disabled={isAddingPlace}>
                <Plus className="ml-2 h-4 w-4" />
                {isAddingPlace ? 'جاري الإضافة...' : 'إضافة المكان'}
              </Button>
            </div>

            {/* ── Clone Place ── */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🪄</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">نسخ مكان</h3>
                  <p className="text-xs text-muted-foreground">ينسخ المنيو والإعدادات لمكان جديد</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">المكان المصدر</Label>
                <select
                  value={cloneSourceId}
                  onChange={e => {
                    setCloneSourceId(e.target.value)
                    const src = places.find(p => p.id === e.target.value)
                    if (src && !cloneNewName) setCloneNewName(`${src.name} (نسخة)`)
                    if (src && !cloneNewCode) setCloneNewCode(`${src.code}-copy`)
                  }}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان المصدر —</option>
                  {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input
                  value={cloneNewName}
                  onChange={e => setCloneNewName(e.target.value)}
                  placeholder="اسم المكان الجديد"
                  className="border-border bg-muted text-foreground text-sm"
                />
                <Input
                  value={cloneNewCode}
                  onChange={e => setCloneNewCode(e.target.value)}
                  placeholder="كود المكان الجديد (يكتبه الزبون)"
                  className="border-border bg-muted text-foreground text-sm"
                />
              </div>
              <Button
                className="w-full"
                style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.35)' }}
                onClick={handleClonePlace}
                disabled={isCloningPlace}
              >
                {isCloningPlace ? 'جاري النسخ...' : '🪄 نسخ المكان'}
              </Button>
            </div>

            {/* Places list */}
            <div className="space-y-3">
              {places.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-3xl mb-2">🏪</p>
                  <p>لا توجد أماكن بعد</p>
                </div>
              ) : places.map(place => (
                <div key={place.id} className="rounded-xl border border-border bg-card p-4 space-y-3">

                  {/* ── Info row ── */}
                  <div className="flex items-center gap-3">
                    {/* Logo / placeholder */}
                    <div className="shrink-0 h-12 w-12 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center text-xl">
                      {place.logo_url
                        ? <img src={place.logo_url} alt="شعار" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <span className="text-muted-foreground/40">🏪</span>
                      }
                    </div>
                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground leading-tight">{place.name}</span>
                        {place.code !== place.name && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold bg-primary/10 text-primary">{place.code}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${place.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {place.is_active ? 'مفعّل' : 'موقوف'}
                        </span>
                      </div>
                      {place.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{place.description}</p>}
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCog className="h-3 w-3 text-muted-foreground" />
                        {placeAdmins[place.id]
                          ? <span className="text-xs text-amber-400 font-medium">{placeAdmins[place.id]!.name}</span>
                          : <span className="text-xs text-muted-foreground">لا يوجد أدمن</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── Action buttons row ── */}
                  <div className="flex items-center gap-2 flex-wrap border-t border-border/40 pt-3">
                    {/* Logo */}
                    <Button size="sm" variant="outline"
                      className={`text-xs ${logoEditingPlace === place.id ? 'border-amber-500/60 text-amber-400 bg-amber-500/10' : ''}`}
                      onClick={() => {
                        if (logoEditingPlace === place.id) { setLogoEditingPlace(null); setLogoUrlInput(''); setLogoError(''); return }
                        setLogoEditingPlace(place.id)
                        setLogoUrlInput(place.logo_url || '')
                        setLogoError('')
                        setAssigningForPlace(null)
                      }}>
                      🖼️ شعار
                    </Button>
                    {/* Assign admin */}
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => {
                        if (assigningForPlace === place.id) { setAssigningForPlace(null); return }
                        setAssigningForPlace(place.id)
                        setAdminError('')
                        setAdminPassword('')
                        setAdminName(placeAdmins[place.id]?.name || '')
                        setLogoEditingPlace(null)
                      }}>
                      <UserCog className="h-3 w-3 ml-1" />
                      {placeAdmins[place.id] ? 'تعديل الأدمن' : 'تعيين أدمن'}
                    </Button>
                    {/* Delete admin */}
                    {placeAdmins[place.id] && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3 ml-1" /> حذف الأدمن
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">حذف أدمن "{placeAdmins[place.id]!.name}"؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم حذف حساب الأدمن من المكان "{place.name}" ولن يتمكن من الدخول مجدداً.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAdmin(place.id)} className="bg-destructive text-destructive-foreground">
                              حذف الأدمن
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Spacer */}
                    <div className="flex-1" />
                    {/* Tracking toggle */}
                    <button
                      title="تتبع الطلبات"
                      onClick={() => handleToggleOrderTracking(place.id, !orderTrackingMap[place.id])}
                      disabled={isSavingTracking}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${orderTrackingMap[place.id] !== false ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-border text-muted-foreground bg-muted'}`}
                    >
                      📍 {orderTrackingMap[place.id] !== false ? 'تتبع' : 'موقوف'}
                    </button>
                    {/* Toggle active */}
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => handleTogglePlace(place.id, place.is_active)}>
                      {place.is_active ? 'إيقاف' : 'تفعيل'}
                    </Button>
                    {/* Delete place */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="text-xs">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف {place.name}؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف المكان وكل بياناته (مشروبات، عملاء، طلبات). لا يمكن التراجع.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeletePlace(place.id)} className="bg-destructive text-destructive-foreground">
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Logo inline form */}
                  {logoEditingPlace === place.id && (
                    <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'rgba(212,160,23,0.3)', background: 'rgba(212,160,23,0.05)' }}>
                      <p className="text-xs font-semibold" style={{ color: '#D4A017' }}>🖼️ شعار (لوجو) — {place.name}</p>

                      {/* Preview + upload area */}
                      <div className="flex gap-3 items-center">
                        {/* Preview circle */}
                        <div className="shrink-0 h-20 w-20 rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center text-2xl" style={{ borderColor: logoUrlInput ? 'rgba(212,160,23,0.5)' : 'rgba(212,160,23,0.2)', background: 'rgba(212,160,23,0.04)' }}>
                          {logoUrlInput
                            ? <img src={logoUrlInput} alt="معاينة" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <span style={{ color: 'rgba(212,160,23,0.3)' }}>🏪</span>
                          }
                        </div>

                        {/* Actions */}
                        <div className="flex-1 space-y-2">
                          {/* File upload button */}
                          <label className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-bold cursor-pointer transition-all hover:opacity-90 active:scale-95" style={{ background: 'linear-gradient(135deg,#D4A017,#f97316)', color: '#0f0800' }}>
                            📷 اختر صورة من الجهاز
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFileSelect(f) }}
                            />
                          </label>

                          {/* Divider */}
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1" style={{ background: 'rgba(212,160,23,0.2)' }} />
                            <span className="text-[11px]" style={{ color: 'rgba(212,160,23,0.4)' }}>أو رابط</span>
                            <div className="h-px flex-1" style={{ background: 'rgba(212,160,23,0.2)' }} />
                          </div>

                          {/* URL input */}
                          <Input
                            value={logoUrlInput.startsWith('data:') ? '' : logoUrlInput}
                            onChange={e => setLogoUrlInput(e.target.value)}
                            placeholder="https://..."
                            className="h-8 border-border bg-muted text-foreground text-xs"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {logoError && <p className="text-xs text-destructive">{logoError}</p>}

                      {/* Clear + Save */}
                      <div className="flex gap-2">
                        {logoUrlInput && (
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => setLogoUrlInput('')}>
                            إزالة
                          </Button>
                        )}
                        <Button size="sm" className="flex-1" style={{ background: 'linear-gradient(135deg,#D4A017,#f97316)', color: '#0f0800' }} onClick={() => handleSaveLogo(place.id)} disabled={isSavingLogo}>
                          {isSavingLogo ? 'جاري الحفظ...' : 'حفظ الشعار'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setLogoEditingPlace(null); setLogoUrlInput(''); setLogoError('') }}>
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Assign / Edit admin inline form */}
                  {assigningForPlace === place.id && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary">
                        {placeAdmins[place.id] ? `✏️ تعديل أدمن "${place.name}"` : `👤 تعيين أدمن لـ "${place.name}"`}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">اسم الأدمن</Label>
                          <Input value={adminName} onChange={e => setAdminName(e.target.value)}
                            placeholder="اسم المستخدم"
                            className="mt-1 h-9 border-border bg-muted text-foreground text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            الباسورد {placeAdmins[place.id] && <span className="text-muted-foreground/60">(اتركه فاضي للإبقاء)</span>}
                          </Label>
                          <div className="relative mt-1">
                            <Input type={showAdminPass ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                              placeholder={placeAdmins[place.id] ? 'باسورد جديد (اختياري)' : 'كلمة المرور'}
                              className="h-9 border-border bg-muted text-foreground text-sm pr-8" />
                            <button type="button" onClick={() => setShowAdminPass(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showAdminPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {adminError && <p className="text-xs text-destructive">{adminError}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => handleAssignAdmin(place.id)} disabled={isSavingAdmin}>
                          {isSavingAdmin ? 'جاري الحفظ...' : placeAdmins[place.id] ? 'حفظ التعديلات' : 'تعيين الأدمن'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAssigningForPlace(null); setAdminError('') }}>
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── Clients Tab (Dev Admin only) ─────── */}
        {isDevAdmin && (
          <>
          <TabsContent value="clients" className="space-y-4">

            {/* Add new client */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" /> إضافة عميل / مالك
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">الاسم <span className="text-destructive">*</span></Label>
                  <Input value={newClientName} onChange={e => setNewClientName(e.target.value)}
                    placeholder="مثال: أحمد محمد" className="mt-1 border-border bg-muted text-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">رقم التليفون</Label>
                  <Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="مثال: 01012345678" className="mt-1 border-border bg-muted text-foreground" dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">اسم المكان / الكافيه</Label>
                  <Input value={newClientPlace} onChange={e => setNewClientPlace(e.target.value)}
                    placeholder="مثال: كافيه النيل" className="mt-1 border-border bg-muted text-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">نوع الاشتراك</Label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => setNewClientSub('monthly')}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${newClientSub === 'monthly' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}
                    >
                      شهري
                    </button>
                    <button
                      onClick={() => setNewClientSub('owned')}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${newClientSub === 'owned' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}
                    >
                      اشترى البرنامج
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">ملاحظات (اختياري)</Label>
                <Input value={newClientNotes} onChange={e => setNewClientNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..." className="mt-1 border-border bg-muted text-foreground" />
              </div>

              {clientsError && <p className="text-sm text-destructive">{clientsError}</p>}

              <Button className="w-full" onClick={handleAddClient} disabled={isAddingClient}>
                <Plus className="ml-2 h-4 w-4" />
                {isAddingClient ? 'جاري الإضافة...' : 'إضافة عميل'}
              </Button>
            </div>

            {/* Clients list */}
            <div className="space-y-3">
              {isFetchingClients ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>جاري التحميل...</p>
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-3xl mb-2">👥</p>
                  <p>لا يوجد عملاء مسجّلين بعد</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">إجمالي العملاء: <span className="font-bold text-foreground">{clients.length}</span></p>
                  {clients.map(c => (
                    <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{c.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.subscription === 'owned' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
                            {c.subscription === 'owned' ? '🏆 مالك' : '🔄 شهري'}
                          </span>
                        </div>
                        {c.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            📞 <span dir="ltr">{c.phone}</span>
                          </p>
                        )}
                        {c.place_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            🏪 {c.place_name}
                          </p>
                        )}
                        {c.notes && (
                          <p className="text-xs text-muted-foreground italic">{c.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60">
                          {new Date(c.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف العميل</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف <span className="font-bold text-foreground">{c.name}</span>؟ لا يمكن التراجع عن هذا الإجراء.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteClient(c.id)} className="bg-destructive hover:bg-destructive/90">
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </>
              )}
            </div>
          </TabsContent>
          </>
        )}

        {/* ─── Cashier Tab (all admins) ─────── */}
        <TabsContent value="cashier" className="space-y-4">
            {/* Create Cashier Account */}
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" /> إنشاء حساب كاشير جديد
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">اسم الكاشير</Label>
                  <Input
                    value={cashierNewName}
                    onChange={e => { setCashierNewName(e.target.value); setCashierUserError(''); setCashierUserSuccess('') }}
                    placeholder="مثال: Mohamed Cashier"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">كلمة المرور (5 أحرف على الأقل)</Label>
                  <Input
                    type="password"
                    value={cashierNewPwd}
                    onChange={e => { setCashierNewPwd(e.target.value); setCashierUserError(''); setCashierUserSuccess('') }}
                    placeholder="••••••••"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
              </div>
              {isDevAdmin ? (
                <div>
                  <Label className="text-xs text-muted-foreground">المكان</Label>
                  <select
                    value={cashierUserPlaceId}
                    onChange={e => setCashierUserPlaceId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">— اختر المكان —</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">المكان:</span>
                  <span className="font-medium">{currentPlace?.name ?? '—'}</span>
                </div>
              )}
              {cashierUserError && <p className="text-sm text-destructive">{cashierUserError}</p>}
              {cashierUserSuccess && <p className="text-sm text-green-500">{cashierUserSuccess}</p>}
              <Button
                onClick={handleCreateCashierUser}
                disabled={isCreatingCashierUser}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCreatingCashierUser ? '⏳ جاري الإنشاء...' : <><Plus className="ml-1 h-4 w-4" /> إنشاء حساب كاشير</>}
              </Button>
            </div>

            {/* Create Table */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-400" /> إضافة طاولة جديدة
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">رقم الطاولة</Label>
                  <Input
                    value={tableNewNumber}
                    onChange={e => { setTableNewNumber(e.target.value); setTableError(''); setTableSuccess('') }}
                    placeholder="مثال: 5"
                    type="number"
                    min="1"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">المكان</Label>
                  <select
                    value={tableNewPlaceId}
                    onChange={e => setTableNewPlaceId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">— اختر المكان —</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              {tableError && <p className="text-sm text-destructive">{tableError}</p>}
              {tableSuccess && <p className="text-sm text-blue-400">{tableSuccess}</p>}
              <Button
                onClick={handleCreateTable}
                disabled={isCreatingTable}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreatingTable ? '⏳ جاري الإنشاء...' : <><Plus className="ml-1 h-4 w-4" /> إضافة الطاولة</>}
              </Button>
            </div>

            {/* QR Code Manager */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-purple-400" /> مدير QR الطاولات
              </h3>
              <p className="text-xs text-muted-foreground">اعرض QR code لكل طاولة — اطبعه وضعه على الطاولة</p>
              <div>
                <Label className="text-xs text-muted-foreground">اختر المكان</Label>
                <select
                  value={tablesPlaceId}
                  onChange={e => { setTablesPlaceId(e.target.value); if (e.target.value) fetchTableUsers(e.target.value) }}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان —</option>
                  {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {isFetchingTableUsers && <p className="text-center text-muted-foreground text-sm py-2">جاري التحميل...</p>}
              {!isFetchingTableUsers && tablesPlaceId && tableUsers.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-2">لا توجد طاولات مسجلة لهذا المكان</p>
              )}
              {!isFetchingTableUsers && tableUsers.length > 0 && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[...tableUsers].sort((a, b) => (parseInt(a.table_number || '0') || 9999) - (parseInt(b.table_number || '0') || 9999)).map(u => {
                      const placeObj = places.find(p => p.id === u.place_id)
                      return (
                        <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-2 gap-2">
                          <span className="text-sm font-medium text-foreground">طاولة {u.table_number}</span>
                          <button
                            onClick={() => {
                              if (placeObj) setQrTableInfo({ tableNumber: u.table_number!, placeCode: placeObj.code, placeName: placeObj.name })
                              setQrDialogOpen(true)
                            }}
                            className="flex items-center gap-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-2 py-1 text-xs transition-colors"
                            title="عرض QR"
                          >
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const placeObj = places.find(p => p.id === tablesPlaceId)
                      if (!placeObj) return
                      const win = window.open('', '_blank')
                      if (!win) return
                      const sorted = [...tableUsers].sort((a, b) => (parseInt(a.table_number || '0') || 9999) - (parseInt(b.table_number || '0') || 9999))
                      const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR طاولات ${placeObj.name}</title><style>body{font-family:Arial,sans-serif;background:#fff;padding:20px}h1{text-align:center;margin-bottom:30px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px}.card{border:2px solid #ddd;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}.card h2{font-size:18px;margin:0 0 12px}.card img{width:150px;height:150px}@media print{.no-print{display:none}}</style></head><body><h1>${placeObj.name} — QR الطاولات</h1><div class="no-print" style="text-align:center;margin-bottom:20px"><button onclick="window.print()" style="padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">🖨️ طباعة الكل</button></div><div class="grid">${sorted.map(u => `<div class="card"><h2>طاولة ${u.table_number}</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?place=' + placeObj.code + '&table=' + u.table_number)}" alt="QR طاولة ${u.table_number}" /></div>`).join('')}</div></body></html>`
                      win.document.write(html)
                      win.document.close()
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 py-2 text-sm transition-colors"
                  >
                    <Download className="h-4 w-4" /> طباعة كل QR للمكان
                  </button>
                </>
              )}
            </div>

            {/* Service Charge & Tax Settings */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <span className="text-amber-400">%</span> إعدادات الخدمة والضريبة
              </h3>
              <p className="text-xs text-muted-foreground">تضاف تلقائياً على الرسيت عند التسوية</p>
              <div>
                <Label className="text-xs text-muted-foreground">المكان</Label>
                <select
                  value={feeSettingsPlaceId}
                  onChange={e => {
                    const pid = e.target.value
                    setFeeSettingsPlaceId(pid)
                    const p = places.find(pl => pl.id === pid)
                    if (p) {
                      setFeeServiceCharge(p.service_charge != null ? String(p.service_charge) : '0')
                      setFeeTaxRate(p.tax_rate != null ? String(p.tax_rate) : '0')
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— اختر المكان —</option>
                  {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">رسوم الخدمة %</Label>
                  <Input
                    value={feeServiceCharge}
                    onChange={e => setFeeServiceCharge(e.target.value)}
                    placeholder="مثال: 10"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">الضريبة %</Label>
                  <Input
                    value={feeTaxRate}
                    onChange={e => setFeeTaxRate(e.target.value)}
                    placeholder="مثال: 14"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="mt-1 border-border bg-muted text-foreground"
                  />
                </div>
              </div>
              {feeSaveError && <p className="text-sm text-destructive">{feeSaveError}</p>}
              {feeSaveSuccess && <p className="text-sm text-green-500">{feeSaveSuccess}</p>}
              <Button
                onClick={handleSaveFees}
                disabled={isSavingFees || !feeSettingsPlaceId}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSavingFees ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </Button>
            </div>

            {/* Existing Cashier Users */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" /> حسابات الكاشير ({cashierUsers.length})
                </h3>
                <button onClick={() => fetchCashierUsers(isDevAdmin ? undefined : placeId ?? undefined)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> تحديث
                </button>
              </div>
              {isFetchingCashierUsers ? (
                <p className="text-center text-muted-foreground text-sm py-3">جاري التحميل...</p>
              ) : cashierUsers.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-3">لا توجد حسابات كاشير بعد</p>
              ) : (
                <div className="space-y-2">
                  {cashierUsers.map(u => {
                    const uPlace = places.find(p => p.id === u.place_id)
                    return (
                      <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-2">
                        <div>
                          <p className="font-medium text-foreground text-sm">🧾 {u.name}</p>
                          <p className="text-xs text-muted-foreground">{uPlace?.name ?? 'بدون مكان'}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف حساب الكاشير</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف كاشير <span className="font-bold text-foreground">{u.name}</span>؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCashierUser(u.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-2">
              <p className="text-xs text-muted-foreground font-semibold mb-3">📋 عرض حسابات الطاولات الحالية</p>
            </div>

            {/* Place selector */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <Label className="text-muted-foreground">اختر المكان لعرض حسابات الطاولات</Label>
                  <select
                    value={cashierPlaceId}
                    onChange={e => { setCashierPlaceId(e.target.value); fetchCashierOrders(e.target.value) }}
                    className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">— اختر المكان —</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {cashierPlaceId && (
                  <button
                    onClick={() => fetchCashierOrders(cashierPlaceId)}
                    className="mt-6 flex items-center gap-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground hover:bg-card transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث
                  </button>
                )}
              </div>
            </div>

            {!cashierPlaceId && (
              <p className="text-center text-muted-foreground py-8">اختر مكاناً لعرض حسابات الطاولات</p>
            )}
            {cashierPlaceId && isFetchingCashier && (
              <p className="text-center text-muted-foreground py-8">جاري تحميل الطلبات...</p>
            )}

            {cashierPlaceId && !isFetchingCashier && (() => {
              if (cashierOrders.length === 0) {
                return <p className="text-center text-muted-foreground py-8">لا توجد طلبات حالياً</p>
              }

              const tableMap = new Map<string, typeof cashierOrders>()
              cashierOrders.forEach(o => {
                const tbl = o.user?.table_number ?? 'بدون طاولة'
                if (!tableMap.has(tbl)) tableMap.set(tbl, [])
                tableMap.get(tbl)!.push(o)
              })

              const sortedTables = [...tableMap.entries()].sort((a, b) => {
                const na = parseInt(a[0]) || 9999
                const nb = parseInt(b[0]) || 9999
                return na - nb
              })

              return (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedTables.map(([tableNum, tOrders]) => {
                    const total = tOrders.reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)
                    const isPaid = paidTables.has(tableNum)
                    return (
                      <div
                        key={tableNum}
                        className={`rounded-2xl border p-4 space-y-3 transition-all ${isPaid ? 'border-green-500/40 bg-green-500/5 opacity-60' : 'border-border bg-card'}`}
                      >
                        {/* Table header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TableProperties className="h-4 w-4 text-primary" />
                            <span className="font-bold text-foreground">طاولة {tableNum}</span>
                          </div>
                          {isPaid ? (
                            <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">تم الدفع ✓</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{tOrders.length} طلب</span>
                          )}
                        </div>

                        {/* Order items */}
                        <div className="space-y-1.5 border-t border-border pt-2">
                          {tOrders.map(o => (
                            <div key={o.id} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">
                                {o.drink?.name ?? '—'}
                                {o.quantity > 1 && <span className="text-muted-foreground ml-1">× {o.quantity}</span>}
                              </span>
                              <span className="text-muted-foreground tabular-nums">
                                {((Number(o.drink?.price) || 0) * o.quantity).toFixed(0)} ج.م
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between border-t border-border pt-2">
                          <span className="font-semibold text-foreground">الإجمالي</span>
                          <span className="text-lg font-black text-primary tabular-nums">{total.toFixed(0)} ج.م</span>
                        </div>

                        {/* Settle button */}
                        {!isPaid && (
                          <button
                            onClick={() => setPaidTables(prev => new Set([...prev, tableNum]))}
                            className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            تسوية الحساب
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations" className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-400" /> إدارة الحجوزات
              </h3>

              {/* Place selector for dev admin */}
              {isDevAdmin && (
                <div>
                  <Label className="text-xs text-muted-foreground">المكان</Label>
                  <select
                    value={reservationsPlaceId}
                    onChange={e => {
                      const pid = e.target.value
                      setReservationsPlaceId(pid)
                      if (pid) {
                        fetchReservations(pid)
                        const p = places.find(pl => pl.id === pid)
                        if (p) setReservationsEnabledMap(prev => ({ ...prev, [pid]: !!p.reservations_enabled }))
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">— اختر المكان —</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Enable/Disable reservations toggle */}
              {reservationsPlaceId && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">تفعيل الحجوزات المسبقة</p>
                    <p className="text-xs text-muted-foreground mt-0.5">يسمح للعملاء بحجز طاولات عبر الرابط العام</p>
                  </div>
                  <button
                    onClick={() => handleToggleReservationsEnabled(reservationsPlaceId, !reservationsEnabledMap[reservationsPlaceId])}
                    disabled={isSavingResEnabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${reservationsEnabledMap[reservationsPlaceId] ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reservationsEnabledMap[reservationsPlaceId] ? '-translate-x-1' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}

              {/* Public booking URL */}
              {reservationsPlaceId && (() => {
                const p = places.find(pl => pl.id === reservationsPlaceId)
                if (!p) return null
                const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/reserve/${encodeURIComponent(p.code)}`
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(bookingUrl)}`
                return (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">رابط الحجز العام</p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={bookingUrl} className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground" />
                      <button
                        onClick={() => navigator.clipboard.writeText(bookingUrl)}
                        className="rounded-lg border border-border bg-muted px-2 py-2 hover:bg-card transition-colors"
                        title="نسخ الرابط"
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border bg-muted px-2 py-2 hover:bg-card transition-colors">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </div>
                    <div className="flex justify-center pt-2">
                      <img src={qrUrl} alt="QR الحجز" className="rounded-xl border border-border" width={160} height={160} />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">اطبع هذا الـ QR وضعه عند مدخل المكان</p>
                  </div>
                )
              })()}
            </div>

            {/* Reservations list */}
            {reservationsPlaceId && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> الحجوزات ({reservations.length})
                  </h3>
                  <button onClick={() => fetchReservations(reservationsPlaceId)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> تحديث
                  </button>
                </div>
                {isFetchingReservations ? (
                  <p className="text-center text-muted-foreground text-sm py-4">جاري التحميل...</p>
                ) : reservations.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">لا توجد حجوزات بعد</p>
                ) : (
                  <div className="space-y-2">
                    {reservations.map(r => {
                      const dt = new Date(r.reserved_at)
                      const statusColor = r.status === 'confirmed' ? 'text-green-500 bg-green-500/10' : r.status === 'cancelled' ? 'text-destructive bg-destructive/10' : 'text-amber-400 bg-amber-500/10'
                      const statusLabel = r.status === 'confirmed' ? 'مؤكد' : r.status === 'cancelled' ? 'ملغي' : 'معلّق'
                      return (
                        <div key={r.id} className="rounded-xl border border-border bg-muted p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{r.customer_name}</p>
                              {r.customer_phone && <p className="text-xs text-muted-foreground">{r.customer_phone}</p>}
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.party_size} أشخاص</span>
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {dt.toLocaleDateString('ar-EG')}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {r.notes && <p className="text-xs text-muted-foreground bg-background/50 rounded-lg px-2 py-1">📝 {r.notes}</p>}
                          {r.table_number && r.status === 'confirmed' && (
                            <p className="text-xs font-bold text-green-400 bg-green-500/10 rounded-lg px-2 py-1">🪑 طاولة {r.table_number}</p>
                          )}
                          {r.status === 'pending' && (
                            <div className="space-y-2 pt-1">
                              {reservTableInputId === r.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="رقم الطاولة (اختياري)"
                                    value={reservTableNumbers[r.id] || ''}
                                    onChange={e => setReservTableNumbers(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground text-center"
                                    dir="rtl"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateReservationStatus(r.id, 'confirmed', reservTableNumbers[r.id] || undefined)}
                                      disabled={confirmingReservId === r.id}
                                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-600/30 hover:bg-green-600/50 text-green-400 py-1.5 text-xs transition-colors disabled:opacity-60"
                                    >
                                      {confirmingReservId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />} تأكيد
                                    </button>
                                    <button
                                      onClick={() => { setReservTableInputId(null); setReservTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n }) }}
                                      className="px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground py-1.5 text-xs transition-colors"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setReservTableInputId(r.id)}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 py-1.5 text-xs transition-colors"
                                  >
                                    <CalendarCheck className="h-3.5 w-3.5" /> تأكيد + طاولة
                                  </button>
                                  <button
                                    onClick={() => handleUpdateReservationStatus(r.id, 'cancelled')}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive py-1.5 text-xs transition-colors"
                                  >
                                    <CalendarX className="h-3.5 w-3.5" /> إلغاء
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {r.status !== 'pending' && (
                            <button
                              onClick={() => handleDeleteReservation(r.id)}
                              className="w-full flex items-center justify-center gap-1 rounded-lg bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive py-1.5 text-xs transition-colors mt-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> حذف
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

        {/* ─── Analytics / Reports Tab ─────────────────────────── */}
        <TabsContent value="analytics" className="space-y-5">

          {/* Period selector + refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground font-medium">الفترة الزمنية:</span>
            {(['today', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  setAnalyticsPeriod(p)
                  if (isDevAdmin) fetchAnalytics({ global: true, period: p })
                  else fetchAnalytics({ placeId: analyticsPlaceId || placeId || '', period: p })
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${analyticsPeriod === p ? 'text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                style={analyticsPeriod === p ? { background: '#D4A017' } : {}}
              >
                {p === 'today' ? 'اليوم' : p === 'week' ? 'آخر ٧ أيام' : 'آخر ٣٠ يوم'}
              </button>
            ))}
            <div className="mr-auto flex items-center gap-2">
              <button
                onClick={() => {
                  if (isDevAdmin) fetchAnalytics({ global: true })
                  else fetchAnalytics({ placeId: analyticsPlaceId || placeId || '' })
                }}
                className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingAnalytics ? 'animate-spin' : ''}`} />
                تحديث
              </button>
              <button
                onClick={() => setShowFullResetConfirm(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                إعادة تهيئة البيانات
              </button>
            </div>
          </div>

          {/* Dev admin: place selector (optional — defaults to global view) */}
          {isDevAdmin && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">عرض البيانات:</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAnalyticsPlaceId(''); fetchAnalytics({ global: true }) }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${analyticsPlaceId === '' ? 'text-black' : 'bg-muted text-muted-foreground'}`}
                    style={analyticsPlaceId === '' ? { background: '#D4A017' } : {}}
                  >كل الأماكن</button>
                  <button
                    onClick={() => { /* stays in place mode */ }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${analyticsPlaceId !== '' ? 'text-black' : 'bg-muted text-muted-foreground'}`}
                    style={analyticsPlaceId !== '' ? { background: '#D4A017' } : {}}
                  >مكان محدد</button>
                </div>
              </div>
              {analyticsPlaceId !== '' || (
                <p className="text-xs text-muted-foreground">يعرض المقارنة بين كل الأماكن</p>
              )}
              <select
                value={analyticsPlaceId}
                onChange={e => {
                  setAnalyticsPlaceId(e.target.value)
                  if (e.target.value) fetchAnalytics({ placeId: e.target.value })
                  else fetchAnalytics({ global: true })
                }}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
              >
                <option value="">— كل الأماكن (مقارنة) —</option>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Loading state */}
          {isFetchingAnalytics && (
            <div className="flex items-center justify-center py-16 gap-3">
              <RefreshCw className="h-5 w-5 animate-spin" style={{ color: '#D4A017' }} />
              <span className="text-muted-foreground">جاري تحميل التقارير...</span>
            </div>
          )}

          {/* No data */}
          {!isFetchingAnalytics && !analyticsData && (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لا تتوفر بيانات بعد للفترة المحددة</p>
            </div>
          )}

          {/* ── Analytics content ── */}
          {!isFetchingAnalytics && analyticsData && (() => {
            const gold = '#D4A017'
            const maxQty    = Math.max(...analyticsData.topDrinks.map(d => d.qty), 1)
            const maxHour   = Math.max(...analyticsData.peakHours.map(h => h.count), 1)
            const maxRev    = Math.max(...(analyticsData.placeComparison?.map(p => p.totalRevenue) ?? []), 1)
            const maxDaily  = Math.max(...(analyticsData.dailyRevenue?.map(d => d.revenue) ?? []), 1)

            return (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'إجمالي المبيعات', value: `${analyticsData.totalRevenue.toFixed(0)} جنيه`, icon: '💰' },
                    { label: 'عدد الطلبات',     value: String(analyticsData.totalOrders),            icon: '🧾' },
                    ...(analyticsData.avgOrderValue != null
                      ? [{ label: 'متوسط الطلب', value: `${analyticsData.avgOrderValue.toFixed(0)} جنيه`, icon: '📊' }]
                      : []),
                    ...(analyticsData.totalSessions != null
                      ? [{ label: 'جلسات العمل', value: String(analyticsData.totalSessions), icon: '📅' }]
                      : []),
                    ...(analyticsData.placeComparison
                      ? [{ label: 'عدد الأماكن النشطة', value: String(analyticsData.placeComparison.filter(p => p.totalOrders > 0).length), icon: '🏪' }]
                      : []),
                  ].slice(0, 4).map(card => (
                    <div key={card.label} className="rounded-2xl border bg-card p-4 space-y-1" style={{ borderColor: 'rgba(212,160,23,0.2)' }}>
                      <div className="text-2xl">{card.icon}</div>
                      <div className="text-xl font-bold text-foreground">{card.value}</div>
                      <div className="text-xs text-muted-foreground">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Dev admin: Place comparison */}
                {analyticsData.placeComparison && analyticsData.placeComparison.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" style={{ color: gold }} />
                      مقارنة الأماكن — المبيعات
                    </h3>
                    <div className="space-y-3">
                      {analyticsData.placeComparison.map((p, i) => (
                        <div key={p.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-foreground font-medium">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                              {p.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.totalRevenue.toFixed(0)} جنيه • {p.totalOrders} طلب</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${(p.totalRevenue / maxRev) * 100}%`, background: i === 0 ? gold : `rgba(212,160,23,${0.7 - i * 0.1})` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top drinks */}
                {analyticsData.topDrinks.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Award className="h-4 w-4" style={{ color: gold }} />
                      أكتر المشار��ب مبيعاً
                    </h3>
                    <div className="space-y-3">
                      {analyticsData.topDrinks.map((d, i) => (
                        <div key={d.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-foreground">
                              <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                              {d.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{d.qty} طلب • {d.revenue.toFixed(0)} جنيه</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${(d.qty / maxQty) * 100}%`, background: i === 0 ? gold : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : `rgba(212,160,23,0.4)` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two-column: Peak hours + Daily revenue */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  {/* Peak hours */}
                  {analyticsData.peakHours.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: gold }} />
                        ساعات الذروة
                      </h3>
                      <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                        {Array.from({ length: 24 }, (_, h) => {
                          const entry = analyticsData.peakHours.find(p => p.hour === h)
                          const cnt   = entry?.count ?? 0
                          const pct   = (cnt / maxHour) * 100
                          return (
                            <div key={h} className="flex flex-col items-center gap-1 flex-1 min-w-[12px] group relative">
                              <div
                                className="w-full rounded-t-sm transition-all"
                                style={{ height: `${Math.max(pct, 3)}%`, background: pct > 60 ? gold : `rgba(212,160,23,${0.3 + pct / 200})` }}
                                title={`${h}:00 — ${cnt} طلب`}
                              />
                              {(h % 6 === 0) && (
                                <span className="text-[9px] text-muted-foreground">{h}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {analyticsData.peakHours.length > 0 && (() => {
                        const top = analyticsData.peakHours.reduce((a, b) => a.count > b.count ? a : b)
                        return <p className="text-xs text-muted-foreground text-center">أكتر ساعة: {top.hour}:00 بـ {top.count} طلب</p>
                      })()}
                    </div>
                  )}

                  {/* Daily revenue */}
                  {analyticsData.dailyRevenue && analyticsData.dailyRevenue.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" style={{ color: gold }} />
                        المبيعات اليومية
                      </h3>
                      <div className="flex items-end gap-1 h-24">
                        {analyticsData.dailyRevenue.map(d => {
                          const pct = (d.revenue / maxDaily) * 100
                          return (
                            <div key={d.day} className="flex flex-col items-center gap-1 flex-1 group relative" title={`${d.day}: ${d.revenue.toFixed(0)} جنيه`}>
                              <div
                                className="w-full rounded-t-sm"
                                style={{ height: `${Math.max(pct, 3)}%`, background: `rgba(212,160,23,${0.4 + pct / 200})` }}
                              />
                              <span className="text-[9px] text-muted-foreground">{d.day.slice(5)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Zero data note */}
                {analyticsData.topDrinks.length === 0 && analyticsData.peakHours.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد طلبات مسجلة في الفترة المحددة</p>
                )}
              </>
            )
          })()}

        </TabsContent>

      </Tabs>

      {/* QR Code Dialog */}
      {qrDialogOpen && qrTableInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setQrDialogOpen(false)}
        >
          <div
            className="relative rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 w-72 text-center"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setQrDialogOpen(false)}
              className="absolute left-3 top-3 text-muted-foreground hover:text-foreground text-lg leading-none"
            >✕</button>
            <h3 className="font-bold text-foreground text-lg">طاولة {qrTableInfo.tableNumber}</h3>
            <p className="text-xs text-muted-foreground">{qrTableInfo.placeName}</p>
            <div className="flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/?place=${qrTableInfo.placeCode}&table=${qrTableInfo.tableNumber}` : '')}`}
                alt={`QR طاولة ${qrTableInfo.tableNumber}`}
                className="rounded-xl border border-border"
                width={220}
                height={220}
              />
            </div>
            <p className="text-xs text-muted-foreground break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/?place=${qrTableInfo.placeCode}&table=${qrTableInfo.tableNumber}` : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const url = `${window.location.origin}/?place=${qrTableInfo.placeCode}&table=${qrTableInfo.tableNumber}`
                  navigator.clipboard.writeText(url)
                }}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border bg-muted hover:bg-card py-2 text-sm text-foreground transition-colors"
              >
                <Copy className="h-4 w-4" /> نسخ
              </button>
              <button
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const url = `${window.location.origin}/?place=${qrTableInfo.placeCode}&table=${qrTableInfo.tableNumber}`
                  const win = window.open('', '_blank')
                  if (!win) return
                  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR طاولة ${qrTableInfo.tableNumber}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;background:#fff}h1{margin-bottom:8px}p{color:#666;font-size:14px;margin-bottom:24px}img{border:2px solid #ddd;border-radius:12px;padding:8px}</style></head><body><h1>${qrTableInfo.placeName}</h1><p>طاولة ${qrTableInfo.tableNumber}</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}" width="300" height="300" /><br/><br/><small style="color:#999">${url}</small><script>window.onload=function(){window.print()}<\/script></body></html>`)
                  win.document.close()
                }}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-2 text-sm transition-colors"
              >
                <Download className="h-4 w-4" /> طباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Data Reset Confirmation Modal ── */}
      {showFullResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
          <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: '#141414', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="text-center mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">إعادة تهيئة البيانات</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                سيتم حذف <span className="text-red-400 font-semibold">جميع الطلبات والجلسات</span> نهائياً وبدء من الصفر.
                <br />هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleFullReset}
                disabled={isFullResetting}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: isFullResetting ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', boxShadow: '0 2px 14px rgba(239,68,68,0.3)' }}
              >
                {isFullResetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isFullResetting ? 'جاري الحذف...' : 'نعم، احذف كل البيانات'}
              </button>
              <button
                onClick={() => setShowFullResetConfirm(false)}
                disabled={isFullResetting}
                className="w-full h-9 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
