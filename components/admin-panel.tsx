'use client';

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Drink, User, OrderWithDetails, Place, Reservation } from '@/lib/types'
import { printHTML } from '@/lib/print'
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
import { Plus, Trash2, Pencil, Upload, RefreshCw, Users, Coffee, Key, BarChart3, TrendingUp, Award, Clock, Send, MessageSquare, Settings2, Hash, UserPlus, UserCog, Minus, Package, Banknote, CheckCircle2, Hourglass, TableProperties, Copy, ExternalLink, Link2, Eye, EyeOff, QrCode, CalendarDays, CalendarCheck, CalendarX, Download, Loader2, Activity, ShieldCheck, ChevronLeft, Radio, Camera, UserCircle, Bell, AlertTriangle, BrainCircuit, Siren, FileText, GripVertical, Wrench, ArrowUp, ArrowDown, Palette } from 'lucide-react'
import { THEME_VAR_KEYS, emitThemeChange, type ThemeColors, THEME_STORAGE_KEY } from '@/components/theme-applier'
import { Checkbox } from '@/components/ui/checkbox'
import Image from 'next/image'
import { LivePlacesHub } from '@/components/LivePlacesHub'
import { OrderSimulator } from '@/components/order-simulator'
import { PlaceTemplates } from '@/components/place-templates'

type DevAdminRole = 'super_developer' | 'support_admin' | 'sales_admin' | 'finance_admin'

type DevAdminAccount = {
  id: string
  name: string
  role: DevAdminRole
  active: boolean
  createdAt?: string | null
}

type IdeaImplementationScope = 'developer_admin' | 'all_pages'

type ImplementedIdeaRecord = {
  title?: string
  tab?: string
  tabLabel?: string
  scope?: IdeaImplementationScope
  implementedAt?: string
  steps?: string[]
}



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
  devAdminRole?: DevAdminRole
  currentPlace?: { id: string; name: string; code: string } | null
  placeId?: string | null
  systemLogoUrl?: string
  onSystemLogoChange?: (url: string) => void
  buttonIcons?: Record<string, string>
  onButtonIconsChange?: (icons: Record<string, string>) => void
  appName?: string
  onAppNameChange?: (name: string) => void
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
  devAdminRole = 'super_developer',
  currentPlace = null,
  placeId = null,
  systemLogoUrl: externalSystemLogoUrl,
  onSystemLogoChange,
  buttonIcons: externalButtonIcons,
  onButtonIconsChange,
  appName: externalAppName,
  onAppNameChange,
}: AdminPanelProps) {
  const devRoleMeta: Record<DevAdminRole, { label: string; description: string; homeTab: string; tabs: string[] }> = {
    super_developer: {
      label: 'Super Developer',
      description: 'صلاحية كاملة لكل أجزاء النظام',
      homeTab: 'analytics',
      tabs: ['alerts', 'analytics', 'notes', 'drinks', 'inventory', 'cashier', 'reservations', 'place-admins', 'staff', 'places', 'subscriptions', 'messages', 'settings', 'branding', 'danger', 'live', 'permissions', 'simulator', 'templates', 'feature-flags', 'ai-ideas', 'implemented-ideas'],
    },
    support_admin: {
      label: 'Support Admin',
      description: 'متابعة المشاكل والرسائل والبث المباشر بدون أدوات الإدارة الخطرة',
      homeTab: 'live',
      tabs: ['live', 'messages'],
    },
    sales_admin: {
      label: 'Sales Admin',
      description: 'إدارة الأماكن والاشتراكات والحجوزات',
      homeTab: 'subscriptions',
      tabs: ['places', 'subscriptions', 'reservations'],
    },
    finance_admin: {
      label: 'Finance Admin',
      description: 'متابعة الإيرادات والتقارير والفواتير',
      homeTab: 'analytics',
      tabs: ['alerts', 'analytics', 'cashier', 'count'],
    },
  }
  const canAccessDevTab = (tab: string) => !isDevAdmin || devRoleMeta[devAdminRole].tabs.includes(tab)
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

  // Dev admin password reset state
  const [showDevAdminReset, setShowDevAdminReset] = useState(false)
  const [devAdminNewPassword, setDevAdminNewPassword] = useState('')
  const [devAdminConfirmPassword, setDevAdminConfirmPassword] = useState('')
  const [devAdminResetError, setDevAdminResetError] = useState('')
  const [isResettingDevAdmin, setIsResettingDevAdmin] = useState(false)
  const [showDevAdminNewPass, setShowDevAdminNewPass] = useState(false)

  // Admin tabs controlled state
  const [activeAdminTab, setActiveAdminTab] = useState(isDevAdmin ? devRoleMeta[devAdminRole].homeTab : 'stats')
  const [devAdminAccounts, setDevAdminAccounts] = useState<DevAdminAccount[]>([])
  const [devAdminAccountName, setDevAdminAccountName] = useState('')
  const [devAdminAccountPassword, setDevAdminAccountPassword] = useState('')
  const [devAdminAccountRole, setDevAdminAccountRole] = useState<DevAdminRole>('support_admin')
  const [editingDevAdminAccount, setEditingDevAdminAccount] = useState<DevAdminAccount | null>(null)
  const [isSavingDevAdminAccount, setIsSavingDevAdminAccount] = useState(false)
  const [staffUrlCopied, setStaffUrlCopied] = useState(false)

  // Developer Notes state
  const [devNote, setDevNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSavedMsg, setNoteSavedMsg] = useState('')

  // Feature Flags state
  const FLAG_DEFS = [
    { key: 'flag_reservations',      label: 'الحجوزات',            desc: 'تفعيل نظام حجز الطاولات للزبائن',         color: '#34d399' },
    { key: 'flag_order_tracking',    label: 'تتبع الطلب',          desc: 'عرض حالة الطلب للزبون لحظة بلحظة',        color: '#60a5fa' },
    { key: 'flag_inventory_alerts',  label: 'تنبيهات المخزون',     desc: 'إرسال تنبيه عند انخفاض الكمية',           color: '#f59e0b' },
    { key: 'flag_analytics',         label: 'الإحصاءات',           desc: 'لوحة تحليلات المبيعات والأداء',            color: '#a78bfa' },
    { key: 'flag_waiter_calls',      label: 'استدعاء الكابتن',     desc: 'زر طلب المساعدة من الطاولة',              color: '#f472b6' },
    { key: 'flag_global_banner',     label: 'الإعلان العلوي',      desc: 'شريط الإعلانات في رأس الصفحة',            color: '#fb923c' },
    { key: 'flag_simulator',         label: 'محاكي الطلبات',       desc: 'أداة اختبار تدفق الطلبات للمطور',         color: '#6366f1' },
    { key: 'flag_multi_place',       label: 'تعدد الفروع',         desc: 'دعم إدارة أكثر من مكان في آن واحد',       color: '#e879f9' },
  ]
  const getDefaultFeatureFlags = () => {
    const defaults: Record<string, boolean> = {}
    FLAG_DEFS.forEach(f => { defaults[f.key] = true })
    return defaults
  }
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})
  const [implementedIdeas, setImplementedIdeas] = useState<Record<string, ImplementedIdeaRecord>>({})

  // ── UI Customization (theme colors + tab labels + tab order) ──
  const DEFAULT_THEME_COLORS: ThemeColors = {
    primary: '#fbbf24',
    accent: '#fbbf24',
    background: '#0b0b14',
    card: '#15151f',
    foreground: '#f5f5f5',
    border: '#2a2a35',
    muted: '#1a1a24',
    ring: '#fbbf24',
    destructive: '#ef4444',
  }
  const THEME_LABELS_AR: Record<string, string> = {
    primary: 'اللون الأساسي',
    accent: 'لون التمييز',
    background: 'الخلفية',
    card: 'البطاقات',
    foreground: 'النص',
    border: 'الإطار',
    muted: 'الخلفية الهادئة',
    ring: 'حلقة التركيز',
    destructive: 'لون الحذف',
  }
  const DEFAULT_TAB_LABELS: Record<string, string> = {
    stats: 'الإحصاءات', tables: 'الطاولات', cashier: 'الكاشير', reservations: 'الحجوزات',
    drinks: 'المشاريب', inventory: 'المخزون', analytics: 'التقارير',
    staff: 'الموظفين', messages: 'الرسائل', settings: 'الإعدادات', danger: 'الخطر',
  }
  const DEFAULT_TAB_ORDER: Record<string, string[]> = {
    operations: ['stats', 'tables', 'cashier', 'reservations'],
    menu: ['drinks', 'inventory', 'analytics'],
    system: ['staff', 'messages', 'settings', 'danger'],
  }
  const TAB_GROUP_LABELS_AR: Record<string, string> = {
    operations: 'العمليات',
    menu: 'القائمة',
    system: 'النظام',
  }
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS)
  const [draftThemeColors, setDraftThemeColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS)
  const [tabLabels, setTabLabels] = useState<Record<string, string>>(DEFAULT_TAB_LABELS)
  const [draftTabLabels, setDraftTabLabels] = useState<Record<string, string>>(DEFAULT_TAB_LABELS)
  const [tabOrder, setTabOrder] = useState<Record<string, string[]>>(DEFAULT_TAB_ORDER)
  const [draftTabOrder, setDraftTabOrder] = useState<Record<string, string[]>>(DEFAULT_TAB_ORDER)
  const [isSavingTheme, setIsSavingTheme] = useState(false)
  const [isSavingTabConfig, setIsSavingTabConfig] = useState(false)

  const getTabLabel = (key: string) => tabLabels[key] || DEFAULT_TAB_LABELS[key] || key
  const moveTabInGroup = (group: string, index: number, dir: -1 | 1) => {
    setDraftTabOrder(prev => {
      const arr = [...(prev[group] || DEFAULT_TAB_ORDER[group] || [])]
      const j = index + dir
      if (j < 0 || j >= arr.length) return prev
      ;[arr[index], arr[j]] = [arr[j], arr[index]]
      return { ...prev, [group]: arr }
    })
  }

  useEffect(() => {
    if (!isDevAdmin) {
      // Place admins only need read of saved customization
    }
    fetch('/api/settings?key=' + THEME_STORAGE_KEY).then(r => r.json()).then(d => {
      if (d?.value) {
        try {
          const parsed = { ...DEFAULT_THEME_COLORS, ...JSON.parse(d.value) }
          setThemeColors(parsed); setDraftThemeColors(parsed)
        } catch { /* ignore */ }
      }
    }).catch(() => {})
    fetch('/api/settings?key=ui_tab_labels').then(r => r.json()).then(d => {
      if (d?.value) {
        try {
          const parsed = { ...DEFAULT_TAB_LABELS, ...JSON.parse(d.value) }
          setTabLabels(parsed); setDraftTabLabels(parsed)
        } catch { /* ignore */ }
      }
    }).catch(() => {})
    fetch('/api/settings?key=ui_tab_order').then(r => r.json()).then(d => {
      if (d?.value) {
        try {
          const saved = JSON.parse(d.value) as Record<string, string[]>
          const merged: Record<string, string[]> = {}
          Object.keys(DEFAULT_TAB_ORDER).forEach(g => {
            const def = DEFAULT_TAB_ORDER[g]
            const sg = Array.isArray(saved[g]) ? saved[g].filter(t => def.includes(t)) : []
            const missing = def.filter(t => !sg.includes(t))
            merged[g] = [...sg, ...missing]
          })
          setTabOrder(merged); setDraftTabOrder(merged)
        } catch { /* ignore */ }
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveThemeColors = async () => {
    setIsSavingTheme(true)
    try {
      const value = JSON.stringify(draftThemeColors)
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: THEME_STORAGE_KEY, value })
      })
      if (!res.ok) throw new Error()
      setThemeColors(draftThemeColors)
      emitThemeChange(draftThemeColors)
      toast.success('تم حفظ ألوان النظام ✅')
    } catch { toast.error('تعذر حفظ الألوان') }
    setIsSavingTheme(false)
  }

  const resetThemeColors = async () => {
    setIsSavingTheme(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: THEME_STORAGE_KEY, value: JSON.stringify(DEFAULT_THEME_COLORS) })
      })
      setThemeColors(DEFAULT_THEME_COLORS)
      setDraftThemeColors(DEFAULT_THEME_COLORS)
      emitThemeChange(DEFAULT_THEME_COLORS)
      toast.success('تمت العودة للألوان الافتراضية')
    } catch { toast.error('تعذر إعادة الضبط') }
    setIsSavingTheme(false)
  }

  const saveTabConfig = async () => {
    setIsSavingTabConfig(true)
    try {
      await Promise.all([
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ui_tab_labels', value: JSON.stringify(draftTabLabels) }) }),
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ui_tab_order', value: JSON.stringify(draftTabOrder) }) }),
      ])
      setTabLabels(draftTabLabels)
      setTabOrder(draftTabOrder)
      toast.success('تم حفظ الأسماء والترتيب ✅')
    } catch { toast.error('تعذر الحفظ') }
    setIsSavingTabConfig(false)
  }

  const resetTabConfig = async () => {
    setIsSavingTabConfig(true)
    try {
      await Promise.all([
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ui_tab_labels', value: JSON.stringify(DEFAULT_TAB_LABELS) }) }),
        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ui_tab_order', value: JSON.stringify(DEFAULT_TAB_ORDER) }) }),
      ])
      setTabLabels(DEFAULT_TAB_LABELS); setDraftTabLabels(DEFAULT_TAB_LABELS)
      setTabOrder(DEFAULT_TAB_ORDER); setDraftTabOrder(DEFAULT_TAB_ORDER)
      toast.success('تمت العودة للترتيب الافتراضي')
    } catch { toast.error('تعذر إعادة الضبط') }
    setIsSavingTabConfig(false)
  }
  const [isSavingFlags, setIsSavingFlags] = useState(false)
  const [flagsLoaded, setFlagsLoaded] = useState(false)

  // ── Feature idea UI states ──
  const [ideaRatings] = useState([
    { table: 'طاولة 3', stars: 5, comment: 'خدمة ممتازة وسريعة', time: 'منذ 10 دقائق' },
    { table: 'طاولة 7', stars: 4, comment: 'الطلب كان رائع بس تأخر شوية', time: 'منذ 25 دقيقة' },
    { table: 'طاولة 1', stars: 5, comment: '', time: 'منذ ساعة' },
  ])
  const [tableStatuses, setTableStatuses] = useState<Record<number, 'free' | 'active' | 'waiting'>>({
    1: 'active', 2: 'free', 3: 'waiting', 4: 'active', 5: 'free', 6: 'free',
    7: 'active', 8: 'free', 9: 'waiting', 10: 'free',
  })
  const [tableStartTimes] = useState<Record<number, number>>(() => {
    const now = Date.now()
    return { 1: now - 25 * 60000, 4: now - 70 * 60000, 7: now - 40 * 60000 }
  })
  const [waitlistEntries, setWaitlistEntries] = useState([
    { id: 1, name: 'أحمد محمد', phone: '0501234567', people: 2, time: 'منذ 5 دقائق' },
    { id: 2, name: 'سارة علي', phone: '0559876543', people: 4, time: 'منذ 12 دقيقة' },
  ])
  const [newWaitName, setNewWaitName] = useState('')
  const [newWaitPhone, setNewWaitPhone] = useState('')
  const [newWaitPeople, setNewWaitPeople] = useState('2')
  const [loyaltyThreshold, setLoyaltyThreshold] = useState('10')
  const [loyaltyReward, setLoyaltyReward] = useState('مشروب مجاني')
  const [loyaltySaved, setLoyaltySaved] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceText, setVoiceText] = useState('طلبك جاهز — طاولة')
  const [splitCount, setSplitCount] = useState(2)
  const [splitTotal, setSplitTotal] = useState('150')
  const [drinkCustomOptions] = useState({ sugar: ['بدون', 'قليل', 'عادي', 'كتير'], ice: ['بدون', 'قليل', 'كتير'], extras: ['كريمة', 'شوكولاتة', 'قرفة'] })
  const [staffPerfData] = useState([
    { name: 'محمد الكابتن', orders: 48, avgTime: '4.2 دقيقة', peak: '8-10 م', score: 98 },
    { name: 'أحمد السبيسي', orders: 36, avgTime: '5.1 دقيقة', peak: '7-9 م', score: 87 },
    { name: 'سارة الويتر', orders: 29, avgTime: '4.8 دقيقة', peak: '9-11 م', score: 81 },
  ])

  const loadFeatureFlags = async () => {
    try {
      const res = await fetch('/api/settings?key=feature_flags')
      const data = await res.json()
      if (data.value) setFeatureFlags({ ...getDefaultFeatureFlags(), ...JSON.parse(data.value) })
      else setFeatureFlags(getDefaultFeatureFlags())
      const implementedRes = await fetch('/api/settings?key=implemented_ideas')
      const implementedData = await implementedRes.json()
      setImplementedIdeas(implementedData.value ? JSON.parse(implementedData.value) : {})
    } catch { /* silent */ }
    setFlagsLoaded(true)
  }

  useEffect(() => {
    loadFeatureFlags()
  }, [])

  const isIdeaImplemented = (flagKey: string) => Boolean(featureFlags[flagKey])

  const isIdeaVisible = (flagKey: string) => {
    if (!featureFlags[flagKey]) return false
    const scope = implementedIdeas[flagKey]?.scope || 'all_pages'
    return scope !== 'developer_admin' || isDevAdmin
  }

  const saveFeatureFlags = async (flags: Record<string, boolean>) => {
    setIsSavingFlags(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'feature_flags', value: JSON.stringify(flags) })
      })
      toast.success('تم حفظ الإعدادات ✅')
    } catch { toast.error('تعذر الحفظ') }
    setIsSavingFlags(false)
  }

  const toggleFlag = (key: string) => {
    const updated = { ...featureFlags, [key]: !featureFlags[key] }
    setFeatureFlags(updated)
    saveFeatureFlags(updated)
  }

  // AI Ideas state
  const AI_IDEAS = [
    { title: 'نظام تقييم الطلب',       desc: 'بعد تسليم الطلب، تظهر للزبون نافذة صغيرة يقيّم فيها تجربته بالنجوم مع تعليق اختياري. التقييمات تظهر في لوحة الأدمن مع إحصاءات.', icon: '⭐', color: '#fbbf24', tab: 'analytics',   tabLabel: 'التقارير',     flagKey: 'idea_order_rating'      },
    { title: 'خريطة الطاولات التفاعلية', desc: 'مخطط بصري للمكان يعرض حالة كل طاولة بالألوان — فارغة / نشطة / تنتظر الحساب. الكاشير يضغط على الطاولة لإدارتها مباشرة.', icon: '🗺️', color: '#34d399', tab: 'cashier',    tabLabel: 'الكاشير',      flagKey: 'idea_table_map'         },
    { title: 'قائمة انتظار ذكية',       desc: 'لما المكان يمتلئ، الزبون يسجل نفسه بـ QR عند المدخل. بمجرد تحرر طاولة يوصله إشعار فوري.', icon: '⏳', color: '#60a5fa', tab: 'settings',   tabLabel: 'الإعدادات',   flagKey: 'idea_waitlist'          },
    { title: 'تخصيص المشروب',           desc: 'الزبون يختار مستوى السكر والثلج والإضافات لكل منتج. الخيارات تُحدد من الأدمن لكل منتج وتصل للبار واضحة.', icon: '🎛️', color: '#f472b6', tab: 'drinks',     tabLabel: 'المشاريب',    flagKey: 'idea_drink_custom'      },
    { title: 'إخفاء المنتج تلقائياً',   desc: 'لما الكمية توصل الصفر يختفي المنتج من قائمة الزبائن تلقائياً ويرجع لما يرجع المخزون، مع تنبيه مسبق للأدمن.', icon: '📦', color: '#f59e0b', tab: 'inventory',  tabLabel: 'المخزون',     flagKey: 'idea_auto_hide'         },
    { title: 'تقسيم الحساب',            desc: 'الكاشير يقسّم فاتورة الطاولة بالتساوي أو حسب كل شخص وطلبه. كل جزء ينطبع كفاتورة مستقلة.', icon: '💳', color: '#a78bfa', tab: 'cashier',    tabLabel: 'الكاشير',     flagKey: 'idea_split_bill'        },
    { title: 'بطاقة الولاء الرقمية',    desc: 'الزبون يجمع نقاطاً تلقائياً على كل طلب. لما يوصل لعتبة معينة يحصل على مكافأة يحددها الأدمن.', icon: '🏆', color: '#fb923c', tab: 'settings',   tabLabel: 'الإعدادات',  flagKey: 'idea_loyalty'           },
    { title: 'مؤقت الطاولة',            desc: 'كل طاولة تعرض للكاشير كم وقت مضى عليها. لما تتجاوز الحد تتلوّن باللون الأحمر تلقائياً.', icon: '⏱️', color: '#f87171', tab: 'cashier',    tabLabel: 'الكاشير',     flagKey: 'idea_table_timer'       },
    { title: 'إعلان صوتي للطلب',        desc: 'لما البار يضغط جاهز، المتحدث يعلن باسم الطاولة تلقائياً بدون صياح. الأدمن يختار الصوت والنبرة.', icon: '🔊', color: '#6366f1', tab: 'settings',   tabLabel: 'الإعدادات',  flagKey: 'idea_voice_announce'    },
    { title: 'تقارير PDF يومية',         desc: 'الكاشير يصدّر تقرير اليوم بضغطة واحدة — مبيعات، أكثر المنتجات طلباً، وصافي الإيراد.', icon: '📄', color: '#34d399', tab: 'analytics',  tabLabel: 'التقارير',    flagKey: 'idea_pdf_reports'       },
    { title: 'لوحة أداء الموظفين',      desc: 'إحصاءات لكل موظف — كم طلب خدم، متوسط وقت التحضير، أعلى ساعات إنتاجية. مع ترتيب شهري.', icon: '🏅', color: '#fbbf24', tab: 'staff',      tabLabel: 'الموظفين',    flagKey: 'idea_staff_perf'        },
    { title: 'مركز تحكم الفروع',        desc: 'لوحة واحدة تعرض كل الفروع في وقت واحد — مبيعات لحظية، طلبات نشطة، مخزون. مع تنبيهات فورية.', icon: '🌐', color: '#e879f9', tab: 'live',       tabLabel: 'البث المباشر',flagKey: 'idea_branch_ctrl'      },
  ]
  const [currentIdea, setCurrentIdea] = useState<typeof AI_IDEAS[0] | null>(null)
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false)
  const [isImplementingIdea, setIsImplementingIdea] = useState(false)
  const [pendingIdea, setPendingIdea] = useState<typeof AI_IDEAS[0] | null>(null)
  const [shownIdeas, setShownIdeas] = useState<Set<number>>(new Set())

  const generateIdea = () => {
    setIsGeneratingIdea(true)
    setTimeout(() => {
      let available = AI_IDEAS.map((_, i) => i).filter(i => !shownIdeas.has(i))
      if (available.length === 0) { setShownIdeas(new Set()); available = AI_IDEAS.map((_, i) => i) }
      const idx = available[Math.floor(Math.random() * available.length)]
      setShownIdeas(prev => new Set([...prev, idx]))
      setCurrentIdea(AI_IDEAS[idx])
      setIsGeneratingIdea(false)
    }, 800)
  }

  const implementIdea = async (idea: typeof AI_IDEAS[0], scope: IdeaImplementationScope) => {
    setIsImplementingIdea(true)
    try {
      const res = await fetch('/api/ai-ideas/implement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey: idea.flagKey, scope })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to implement idea')
      setFeatureFlags(data.featureFlags || { ...featureFlags, [idea.flagKey]: true })
      setImplementedIdeas(data.implementedIdeas || { ...implementedIdeas, [idea.flagKey]: data.idea })
      setPendingIdea(null)
      toast.success(`${idea.icon} تم تنفيذ "${idea.title}" فعليًا وحفظها — ستجده في ${idea.tabLabel}`)
      await new Promise(r => setTimeout(r, 700))
      handleTabChange(idea.tab)
    } catch { toast.error('تعذر التنفيذ') }
    setIsImplementingIdea(false)
  }

  const [removingIdeaKey, setRemovingIdeaKey] = useState<string | null>(null)
  const [pendingRemoveIdea, setPendingRemoveIdea] = useState<typeof AI_IDEAS[0] | null>(null)

  const renderDeleteFeatureBtn = (flagKey: string) => {
    if (!isDevAdmin) return null
    const idea = AI_IDEAS.find(i => i.flagKey === flagKey)
    if (!idea) return null
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setPendingRemoveIdea(idea) }}
        disabled={removingIdeaKey === flagKey}
        title="حذف هذه الميزة من المشروع (للمطور فقط)"
        className="ms-auto shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all active:scale-95"
        style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#fda4af' }}
      >
        {removingIdeaKey === flagKey ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <><Trash2 className="h-3 w-3" /> حذف</>
        )}
      </button>
    )
  }

  const removeIdea = async (idea: typeof AI_IDEAS[0]) => {
    setRemovingIdeaKey(idea.flagKey)
    try {
      const res = await fetch('/api/ai-ideas/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey: idea.flagKey })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to remove idea')
      setFeatureFlags(data.featureFlags || { ...featureFlags, [idea.flagKey]: false })
      setImplementedIdeas(data.implementedIdeas || {})
      setPendingRemoveIdea(null)
      toast.success(`🗑️ تم حذف "${idea.title}" من المشروع`)
    } catch { toast.error('تعذر الحذف') }
    setRemovingIdeaKey(null)
  }

  // Smart Alerts state
  const [smartAlerts, setSmartAlerts] = useState<{
    id: string; place_id: string; place_name: string; type: string;
    severity: 'critical' | 'warning' | 'info'; message: string;
    details: Record<string, unknown>; created_at: string
  }[]>([])
  const [smartAlertsLoading, setSmartAlertsLoading] = useState(false)
  const [smartAlertsLastRun, setSmartAlertsLastRun] = useState<Date | null>(null)
  const [smartAlertsMeta, setSmartAlertsMeta] = useState<{ critical: number; warning: number; info: number; places: number } | null>(null)
  const [staffOrigin, setStaffOrigin] = useState('')

  useEffect(() => {
    setStaffOrigin(window.location.origin)
    fetchStaffUsers()
  }, [])

  useEffect(() => {
    if (!isDevAdmin) return
    if (!canAccessDevTab(activeAdminTab)) {
      setActiveAdminTab(devRoleMeta[devAdminRole].homeTab)
    }
  }, [isDevAdmin, devAdminRole])

  const loadDevAdminAccounts = async () => {
    if (!isDevAdmin || devAdminRole !== 'super_developer') return
    const res = await fetch('/api/dev-admins')
    if (res.ok) {
      const data = await res.json()
      setDevAdminAccounts(data.accounts || [])
    }
  }

  useEffect(() => {
    loadDevAdminAccounts().catch(() => {})
  }, [isDevAdmin, devAdminRole])

  // Sync localDrinks whenever the parent drinks prop refreshes from server
  useEffect(() => {
    setLocalDrinks(drinks)
  }, [drinks])

  const handleCopyStaffUrl = () => {
    const url = `${window.location.origin}/staff`
    navigator.clipboard.writeText(url).then(() => {
      setStaffUrlCopied(true)
      setTimeout(() => setStaffUrlCopied(false), 2500)
    })
  }

  const handleSaveDevAdminAccount = async () => {
    if (!devAdminAccountName.trim()) { toast.error('أدخل اسم الأدمن'); return }
    if (!editingDevAdminAccount && !devAdminAccountPassword.trim()) { toast.error('أدخل كلمة المرور'); return }
    setIsSavingDevAdminAccount(true)
    try {
      const res = await fetch('/api/dev-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDevAdminAccount?.id,
          name: devAdminAccountName.trim(),
          password: devAdminAccountPassword.trim(),
          role: devAdminAccountRole,
          active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'تعذر حفظ الأدمن')
        return
      }
      setDevAdminAccounts(data.accounts || [])
      setDevAdminAccountName('')
      setDevAdminAccountPassword('')
      setDevAdminAccountRole('support_admin')
      setEditingDevAdminAccount(null)
      toast.success('تم حفظ صلاحيات الأدمن')
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    } finally {
      setIsSavingDevAdminAccount(false)
    }
  }

  const handleDeleteDevAdminAccount = async (id: string) => {
    const res = await fetch('/api/dev-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    const data = await res.json()
    if (res.ok) {
      setDevAdminAccounts(data.accounts || [])
      toast.success('تم حذف أدمن المطور')
    } else {
      toast.error(data.error || 'تعذر الحذف')
    }
  }

  // Edit drink state
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editImage, setEditImage] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Seasonal edit state
  const [editSeasonalEnabled, setEditSeasonalEnabled] = useState(false)
  const [editSeasonalStart, setEditSeasonalStart] = useState('')
  const [editSeasonalEnd, setEditSeasonalEnd] = useState('')

  // Drag-to-reorder state
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragItemId = useRef<string | null>(null)
  const [localDrinks, setLocalDrinks] = useState<Drink[]>(drinks)

  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceMsg, setMaintenanceMsg] = useState('الموقع تحت الصيانة، سنعود قريباً')
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false)

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

  // Bulk fill inventory for a list of drink IDs
  const bulkSetInventory = async (drinkIds: string[], quantity: number) => {
    setIsInvBulkLoading(true)
    try {
      await Promise.all(drinkIds.map(id =>
        fetch(`/api/inventory/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
        })
      ))
      setInventoryMap(prev => {
        const updated = { ...prev }
        drinkIds.forEach(id => { updated[id] = quantity })
        return updated
      })
      toast.success(`تم تحديث ${drinkIds.length} صنف`)
    } catch {
      toast.error('حدث خطأ أثناء التحديث الجماعي')
    } finally {
      setIsInvBulkLoading(false)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_old', months: parseInt(bulkDeleteMonths, 10) })
      })
      const data = await res.json()
      if (!res.ok) { toast.error('خطأ في الحذف'); return }
      setBulkDeleteResult(`تم حذف ${data.deleted_sessions} جلسة قديمة`)
      toast.success(`تم حذف ${data.deleted_sessions} جلسة قديمة وطلباتها`)
    } catch { toast.error('خطأ في حذف البيانات') }
    finally { setIsDeletingOldData(false) }
  }

  // Fetch place closed status and maintenance mode
  const fetchClosedStatus = async () => {
    if (!placeId) return
    try {
      const [closedRes, msgRes, maintRes, maintMsgRes] = await Promise.all([
        fetch(`/api/settings?key=place_closed_${placeId}`),
        fetch(`/api/settings?key=place_closed_message_${placeId}`),
        fetch(`/api/settings?key=maintenance_${placeId}`),
        fetch(`/api/settings?key=maintenance_message_${placeId}`)
      ])
      if (closedRes.ok) { const d = await closedRes.json(); setIsPlaceClosed(d.value === 'true') }
      if (msgRes.ok) { const d = await msgRes.json(); if (d.value) setPlaceClosedMsg(d.value) }
      if (maintRes.ok) { const d = await maintRes.json(); setIsMaintenanceMode(d.value === 'true') }
      if (maintMsgRes.ok) { const d = await maintMsgRes.json(); if (d.value) setMaintenanceMsg(d.value) }
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
  const [invFilterStatus, setInvFilterStatus] = useState<'all' | 'out' | 'low' | 'ok'>('all')
  const [invSearch, setInvSearch] = useState('')
  const [invBulkValue, setInvBulkValue] = useState('10')
  const [isInvBulkLoading, setIsInvBulkLoading] = useState(false)
  const [invExpandedCategories, setInvExpandedCategories] = useState<Record<string, boolean>>({})
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
  const [feeDiscountCode, setFeeDiscountCode] = useState('')
  const [isSavingFees, setIsSavingFees] = useState(false)
  const [feeSaveSuccess, setFeeSaveSuccess] = useState('')
  const [feeSaveError, setFeeSaveError] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [isDeletingMessages, setIsDeletingMessages] = useState(false)
  const [messagesDeleted, setMessagesDeleted] = useState(false)
  const [placeMessages, setPlaceMessages] = useState<{ id: string; title: string | null; message: string; created_at: string; is_from_admin: boolean }[]>([])
  const [isFetchingPlaceMessages, setIsFetchingPlaceMessages] = useState(false)
  const [isDeletingPlaceMsg, setIsDeletingPlaceMsg] = useState<string | null>(null)

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

  // Subscriptions state (dev admin only)
  type SubPlace = {
    id: string; name: string; code: string; is_active: boolean
    subscription_plan: string; subscription_expires_at: string | null
    owner_name: string | null; owner_phone: string | null; subscription_amount: string | number | null
    days_left: number | null; is_expired: boolean; expiring_soon: boolean
    plan_config: { label: string; maxTables: number | null; maxStaff: number | null; maxProducts: number | null; reservationsEnabled: boolean; reportsEnabled: boolean; color: string; emoji: string }
    created_at: string
  }
  const [subPlaces, setSubPlaces] = useState<SubPlace[]>([])
  const [isFetchingSubs, setIsFetchingSubs] = useState(false)
  const [editSubId, setEditSubId] = useState<string | null>(null)
  const [editSubPlan, setEditSubPlan] = useState<string>('free')
  const [editSubExpiry, setEditSubExpiry] = useState<string>('')
  const [editSubOwnerName, setEditSubOwnerName] = useState<string>('')
  const [editSubOwnerPhone, setEditSubOwnerPhone] = useState<string>('')
  const [editSubAmount, setEditSubAmount] = useState<string>('')
  const [isSavingSub, setIsSavingSub] = useState(false)
  const [subFilter, setSubFilter] = useState<'all' | 'expiring' | 'expired'>('all')

  // Plan configs editor state
  type PlanConfigEdit = {
    maxTables: string; maxStaff: string; maxProducts: string
    reservationsEnabled: boolean; reportsEnabled: boolean; durationDays: string
    customPrice: string
  }
  const DEFAULT_PLAN_EDITS: Record<string, PlanConfigEdit> = {
    free:    { maxTables: '10',  maxStaff: '3',  maxProducts: '30',  reservationsEnabled: false, reportsEnabled: false, durationDays: '',    customPrice: '' },
    monthly: { maxTables: '20',  maxStaff: '10', maxProducts: '100', reservationsEnabled: true,  reportsEnabled: true,  durationDays: '30',  customPrice: '' },
    yearly:  { maxTables: '30',  maxStaff: '15', maxProducts: '200', reservationsEnabled: true,  reportsEnabled: true,  durationDays: '365', customPrice: '' },
    premium: { maxTables: '',    maxStaff: '',   maxProducts: '',    reservationsEnabled: true,  reportsEnabled: true,  durationDays: '',    customPrice: '' },
  }
  const [planEdits, setPlanEdits] = useState<Record<string, PlanConfigEdit>>(DEFAULT_PLAN_EDITS)
  const [showPlanEditor, setShowPlanEditor] = useState(false)
  const [isSavingPlans, setIsSavingPlans] = useState(false)
  const [planSaveMsg, setPlanSaveMsg] = useState('')

  const calcSuggestedPrice = (e: PlanConfigEdit): { breakdown: { label: string; amount: number }[]; total: number; monthly: number } => {
    const tableRate = 5
    const staffRate = 10
    const productRate = 0.5
    const reservationsAdd = 70
    const reportsAdd = 50
    const tables = e.maxTables ? Math.min(parseInt(e.maxTables) || 0, 200) : 60
    const staff = e.maxStaff ? Math.min(parseInt(e.maxStaff) || 0, 100) : 25
    const products = e.maxProducts ? Math.min(parseInt(e.maxProducts) || 0, 2000) : 600
    const days = e.durationDays ? parseInt(e.durationDays) || 30 : 30
    const multiplier = days / 30
    const tablesAmt = Math.round(tables * tableRate)
    const staffAmt = Math.round(staff * staffRate)
    const productsAmt = Math.round(products * productRate)
    const resAmt = e.reservationsEnabled ? reservationsAdd : 0
    const repAmt = e.reportsEnabled ? reportsAdd : 0
    const monthly = tablesAmt + staffAmt + productsAmt + resAmt + repAmt
    const total = Math.round(monthly * multiplier)
    return {
      breakdown: [
        { label: `${e.maxTables || '∞'} طاولة`, amount: tablesAmt },
        { label: `${e.maxStaff || '∞'} موظف`, amount: staffAmt },
        { label: `${e.maxProducts || '∞'} منتج`, amount: productsAmt },
        ...(e.reservationsEnabled ? [{ label: 'الحجوزات', amount: resAmt }] : []),
        ...(e.reportsEnabled ? [{ label: 'التقارير', amount: repAmt }] : []),
      ],
      total,
      monthly,
    }
  }

  // Analytics state
  type AnalyticsData = {
    global: boolean
    period: string
    totalRevenue: number
    totalOrders: number
    totalSessions?: number
    avgOrderValue?: number
    avgRating?: number | null
    totalRatings?: number
    ratingDistribution?: { star: number; count: number }[]
    topDrinks: { name: string; qty: number; revenue: number }[]
    peakHours: { hour: number; count: number }[]
    dailyRevenue?: { day: string; revenue: number; orders: number }[]
    placeComparison?: { id: string; name: string; totalOrders: number; totalRevenue: number; totalSessions: number; avgRating?: number | null; totalRatings?: number }[]
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

  // Dev Admin Avatar state
  const [adminPhotoUrl, setAdminPhotoUrl] = useState<string | null>(null)
  const [adminPhotoUploading, setAdminPhotoUploading] = useState(false)
  const [adminPhotoHover, setAdminPhotoHover] = useState(false)
  const adminPhotoInputRef = useRef<HTMLInputElement>(null)

  // ── System logo state (super_developer only) ──
  const [systemLogoInputUrl, setSystemLogoInputUrl] = useState('')
  const [systemLogoUploading, setSystemLogoUploading] = useState(false)
  const systemLogoInputRef = useRef<HTMLInputElement>(null)

  // ── Button icons state (super_developer only) ──
  const defaultButtonIcons = { placeAdmin: '⚙️', cashier: '🧾', captain: '🔔', bar: '☕' }
  const [localButtonIcons, setLocalButtonIcons] = useState<Record<string, string>>(
    externalButtonIcons || defaultButtonIcons
  )
  const [isSavingButtonIcons, setIsSavingButtonIcons] = useState(false)

  const BUTTON_ICON_DEFS = [
    { key: 'placeAdmin', label: 'Place Admin', options: ['⚙️','🔧','🏪','👔','💼','🔑','🎯','🛡️','🏛️','👑','🗝️','🖥️'] },
    { key: 'cashier',   label: 'Cashier',      options: ['🧾','💰','💳','🖨️','📋','📝','🏧','💵','🤑','🛒','📊','🔖'] },
    { key: 'captain',   label: 'Captain',       options: ['🔔','🛎️','📣','👋','📡','✋','🚀','🧭','📢','🎙️','🧑‍✈️','⭐'] },
    { key: 'bar',       label: 'Bar',           options: ['☕','🍵','🥤','🍺','🍹','🧋','🫖','🍶','🧃','🥛','🍷','🎂'] },
  ]

  // ── App name state (super_developer only) ──
  const [localAppName, setLocalAppName] = useState(externalAppName || 'SîpFlõw')
  const [isSavingAppName, setIsSavingAppName] = useState(false)

  useEffect(() => {
    fetch('/api/settings?key=dev_admin_photo_url')
      .then(r => r.json())
      .then(d => { if (d.value) setAdminPhotoUrl(d.value) })
      .catch(() => {})
  }, [])

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAdminPhotoUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.url) {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'dev_admin_photo_url', value: data.url }),
        })
        setAdminPhotoUrl(data.url)
        toast.success('تم رفع الصورة الشخصية بنجاح')
      } else {
        toast.error(data.error || 'فشل رفع الصورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة')
    } finally {
      setAdminPhotoUploading(false)
      if (adminPhotoInputRef.current) adminPhotoInputRef.current.value = ''
    }
  }

  const handleSaveAppName = async () => {
    const name = localAppName.trim()
    if (!name) { toast.error('أدخل اسم التطبيق'); return }
    setIsSavingAppName(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'app_name', value: name }),
      })
      onAppNameChange?.(name)
      toast.success('تم تغيير اسم التطبيق بنجاح ✅')
    } catch {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSavingAppName(false)
    }
  }

  const handleResetAppName = async () => {
    const defaultName = 'SîpFlõw'
    setIsSavingAppName(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'app_name', value: defaultName }),
      })
      setLocalAppName(defaultName)
      onAppNameChange?.(defaultName)
      toast.success('تم إعادة الاسم للافتراضي')
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setIsSavingAppName(false)
    }
  }

  const handleSaveButtonIcons = async () => {
    setIsSavingButtonIcons(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'button_icons', value: JSON.stringify(localButtonIcons) }),
      })
      onButtonIconsChange?.(localButtonIcons)
      toast.success('تم حفظ أيقونات الزراير بنجاح ✅')
    } catch {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSavingButtonIcons(false)
    }
  }

  const handleResetButtonIcons = async () => {
    setIsSavingButtonIcons(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'button_icons', value: JSON.stringify(defaultButtonIcons) }),
      })
      setLocalButtonIcons(defaultButtonIcons)
      onButtonIconsChange?.(defaultButtonIcons)
      toast.success('تم إعادة الأيقونات للافتراضية')
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setIsSavingButtonIcons(false)
    }
  }

  const handleSystemLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSystemLogoUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.url) {
        setSystemLogoInputUrl(data.url)
      } else {
        toast.error(data.error || 'فشل رفع الصورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة')
    } finally {
      setSystemLogoUploading(false)
      if (systemLogoInputRef.current) systemLogoInputRef.current.value = ''
    }
  }

  const handleSystemLogoSave = async () => {
    const url = systemLogoInputUrl.trim()
    if (!url) { toast.error('أدخل رابط اللوجو أو ارفع صورة'); return }
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'system_logo_url', value: url }),
      })
      onSystemLogoChange?.(url)
      toast.success('تم تغيير لوجو النظام بنجاح ✅')
    } catch {
      toast.error('حدث خطأ أثناء حفظ اللوجو')
    }
  }

  const handleSystemLogoReset = async () => {
    const defaultUrl = '/images/sipflow-logo.jpg'
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'system_logo_url', value: defaultUrl }),
      })
      setSystemLogoInputUrl('')
      onSystemLogoChange?.(defaultUrl)
      toast.success('تم إعادة اللوجو للافتراضي')
    } catch {
      toast.error('حدث خطأ')
    }
  }

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
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      // Ensure data is an array before setting state
      setStaffUsers(Array.isArray(data) ? data : [])
    } catch {
      setStaffUsers([])
    }
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
        notifyDev('إضافة كابتن جديد', `الاسم: ${newWaiterName.trim()} — المستخدم: ${newWaiterUsername.trim()}`)
        setNewWaiterUsername('')
        setNewWaiterPassword('')
        setNewWaiterName('')
        setWaiterAdded(true)
        setTimeout(() => setWaiterAdded(false), 3000)
        fetchStaffUsers()
      } else {
        const errData = await res.json().catch(() => ({}))
        setWaiterError(errData?.error || 'فشل إضافة الكابتن — اسم المستخدم موجود بالفعل أو حدث خطأ')
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
        image_url: editImage,
        seasonal_start: editSeasonalEnabled && editSeasonalStart ? editSeasonalStart : null,
        seasonal_end: editSeasonalEnabled && editSeasonalEnd ? editSeasonalEnd : null,
      })
    })
    
    if (res.ok) {
      notifyDev('تعديل صنف', `"${editName.trim()}" — السعر الجديد: ${editPrice || '0'}`)
      setEditingDrink(null)
      setEditDialogOpen(false)
      onDrinkUpdated()
    }
  }

  // Drag-to-reorder helpers
  const handleDragStart = (id: string) => {
    dragItemId.current = id
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = async (targetId: string, drinksList: Drink[]) => {
    const sourceId = dragItemId.current
    setDragOverId(null)
    dragItemId.current = null
    if (!sourceId || sourceId === targetId) return
    const sourceIdx = drinksList.findIndex(d => d.id === sourceId)
    const targetIdx = drinksList.findIndex(d => d.id === targetId)
    if (sourceIdx === -1 || targetIdx === -1) return

    // Build reordered list
    const reordered = [...drinksList]
    const [moved] = reordered.splice(sourceIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    const order = reordered.map((d, i) => ({ id: d.id, sort_order: i + 1 }))

    // Optimistic update — reflect new order immediately in the UI
    const reorderedMap = new Map(reordered.map((d, i) => [d.id, { ...d, sort_order: i + 1 }]))
    setLocalDrinks(prev => {
      const inGroup = prev.filter(d => reorderedMap.has(d.id)).map(d => reorderedMap.get(d.id)!)
      const outGroup = prev.filter(d => !reorderedMap.has(d.id))
      return [...inGroup.sort((a, b) => a.sort_order - b.sort_order), ...outGroup]
    })

    try {
      const res = await fetch('/api/drinks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      })
      if (!res.ok) throw new Error('فشل الحفظ')
      toast.success('تم حفظ الترتيب')
      onDrinkUpdated()
    } catch {
      // Rollback to server state on error
      setLocalDrinks(drinks)
      toast.error('خطأ في حفظ الترتيب')
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

  const fetchSmartAlerts = async () => {
    setSmartAlertsLoading(true)
    try {
      const res = await fetch('/api/smart-alerts')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setSmartAlerts(data.alerts || [])
      setSmartAlertsMeta({ critical: data.critical_count || 0, warning: data.warning_count || 0, info: data.info_count || 0, places: data.analyzed_places || 0 })
      setSmartAlertsLastRun(new Date())
    } catch {
      setSmartAlerts([])
    } finally {
      setSmartAlertsLoading(false)
    }
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
          tax_rate: parseFloat(feeTaxRate) || 0,
          discount_code: feeDiscountCode.trim() || null
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
        headers: { 'Content-Type': 'application/json' },
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
    const hasSeasonal = !!(drink.seasonal_start || drink.seasonal_end)
    setEditSeasonalEnabled(hasSeasonal)
    setEditSeasonalStart(drink.seasonal_start ? drink.seasonal_start.slice(0, 10) : '')
    setEditSeasonalEnd(drink.seasonal_end ? drink.seasonal_end.slice(0, 10) : '')
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
      setActiveAdminTab(isDevAdmin ? 'staff' : 'stats')
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
      setActiveAdminTab(isDevAdmin ? 'messages' : 'stats')
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
    setActiveAdminTab(isDevAdmin ? 'settings' : 'stats');
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
  const [newPlaceType, setNewPlaceType] = useState<'cafe' | 'company'>('cafe')
  const [newPlaceFreeCount, setNewPlaceFreeCount] = useState(0)
  const [placesError, setPlacesError] = useState('')
  const [isAddingPlace, setIsAddingPlace] = useState(false)
  const [freeDrinkEditingPlace, setFreeDrinkEditingPlace] = useState<string | null>(null)
  const [isSavingFreeDrink, setIsSavingFreeDrink] = useState(false)

  // ─── Company Employees state ──────────────────────────
  const [companyEmpPlace, setCompanyEmpPlace] = useState<string | null>(null)
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([])
  const [isFetchingEmployees, setIsFetchingEmployees] = useState(false)
  const [newEmpName, setNewEmpName] = useState('')
  const [newEmpEmail, setNewEmpEmail] = useState('')
  const [newEmpPassword, setNewEmpPassword] = useState('')
  const [newEmpDepartment, setNewEmpDepartment] = useState('')
  const [newEmpTitle, setNewEmpTitle] = useState('')
  const [newEmpAvatarUrl, setNewEmpAvatarUrl] = useState('')
  const [isUploadingEmpAvatar, setIsUploadingEmpAvatar] = useState(false)
  const [empError, setEmpError] = useState('')
  const [isAddingEmp, setIsAddingEmp] = useState(false)
  const [showEmpPass, setShowEmpPass] = useState(false)

  const handleUploadEmpAvatar = async (file: File) => {
    setIsUploadingEmpAvatar(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.url) {
        setNewEmpAvatarUrl(data.url)
      } else {
        toast.error(data.error || 'فشل رفع الصورة')
      }
    } catch { toast.error('فشل رفع الصورة') }
    finally { setIsUploadingEmpAvatar(false) }
  }

  // ─── Employee Reports state ───────────────────────────
  const [reportsPlace, setReportsPlace] = useState<string | null>(null)
  const [reportsMode, setReportsMode] = useState<'month' | 'day'>('month')
  const [reportsMonth, setReportsMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [reportsDate, setReportsDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  })
  const [employeeReports, setEmployeeReports] = useState<any[]>([])
  const [isFetchingReports, setIsFetchingReports] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

  const fetchCompanyEmployees = async (placeId: string) => {
    setIsFetchingEmployees(true)
    try {
      const res = await fetch(`/api/company-employees?place_id=${placeId}`)
      if (res.ok) setCompanyEmployees(await res.json())
    } finally { setIsFetchingEmployees(false) }
  }

  const handleAddEmployee = async () => {
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword.trim()) {
      setEmpError('الاسم والإيميل وكلمة المرور مطلوبة'); return
    }
    if (!companyEmpPlace) return
    setIsAddingEmp(true); setEmpError('')
    try {
      const res = await fetch('/api/company-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: companyEmpPlace,
          name: newEmpName.trim(),
          email: newEmpEmail.trim(),
          password: newEmpPassword,
          avatar_url: newEmpAvatarUrl || null,
          department: newEmpDepartment.trim() || null,
          title: newEmpTitle.trim() || null,
        })
      })
      const data = await res.json()
      if (!res.ok) { setEmpError(data.error || 'حدث خطأ'); return }
      setNewEmpName(''); setNewEmpEmail(''); setNewEmpPassword('')
      setNewEmpDepartment(''); setNewEmpTitle(''); setNewEmpAvatarUrl('')
      fetchCompanyEmployees(companyEmpPlace)
      toast.success('تم إضافة الموظف ✅')
    } catch { setEmpError('حدث خطأ') } finally { setIsAddingEmp(false) }
  }

  const handleDeleteEmployee = async (empId: string) => {
    if (!companyEmpPlace) return
    await fetch(`/api/company-employees/${empId}`, { method: 'DELETE' })
    fetchCompanyEmployees(companyEmpPlace)
    toast.success('تم حذف الموظف')
  }

  const handleToggleEmployee = async (empId: string, isActive: boolean) => {
    if (!companyEmpPlace) return
    await fetch(`/api/company-employees/${empId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive })
    })
    fetchCompanyEmployees(companyEmpPlace)
  }

  const fetchEmployeeReports = async (placeId: string, month: string, date?: string) => {
    setIsFetchingReports(true)
    try {
      const url = date
        ? `/api/employee-reports?place_id=${placeId}&date=${date}`
        : `/api/employee-reports?place_id=${placeId}&month=${month}`
      const res = await fetch(url)
      if (res.ok) setEmployeeReports(await res.json())
    } finally { setIsFetchingReports(false) }
  }

  const fetchClients = async () => {
    setIsFetchingClients(true)
    try {
      const res = await fetch('/api/clients')
      if (res.ok) setClients(await res.json())
    } finally {
      setIsFetchingClients(false)
    }
  }

  const fetchSubscriptions = async () => {
    setIsFetchingSubs(true)
    try {
      const res = await fetch('/api/subscriptions')
      if (res.ok) {
        const data = await res.json()
        setSubPlaces(data.places || [])
        if (data.planConfigs) {
          const edits: Record<string, any> = {}
          for (const [key, cfg] of Object.entries(data.planConfigs as Record<string, any>)) {
            edits[key] = {
              maxTables:           cfg.maxTables == null   ? '' : String(cfg.maxTables),
              maxStaff:            cfg.maxStaff == null    ? '' : String(cfg.maxStaff),
              maxProducts:         cfg.maxProducts == null ? '' : String(cfg.maxProducts),
              reservationsEnabled: Boolean(cfg.reservationsEnabled),
              reportsEnabled:      Boolean(cfg.reportsEnabled),
              durationDays:        cfg.durationDays == null ? '' : String(cfg.durationDays),
            }
          }
          setPlanEdits(edits)
        }
      }
    } finally {
      setIsFetchingSubs(false)
    }
  }

  const handleSavePlans = async () => {
    setIsSavingPlans(true)
    setPlanSaveMsg('')
    try {
      const body: Record<string, any> = {}
      for (const [key, edit] of Object.entries(planEdits)) {
        body[key] = {
          maxTables:           edit.maxTables === '' ? null : Number(edit.maxTables),
          maxStaff:            edit.maxStaff === ''  ? null : Number(edit.maxStaff),
          maxProducts:         edit.maxProducts === '' ? null : Number(edit.maxProducts),
          reservationsEnabled: edit.reservationsEnabled,
          reportsEnabled:      edit.reportsEnabled,
          durationDays:        edit.durationDays === '' ? null : Number(edit.durationDays),
          customPrice:         edit.customPrice === '' ? null : Number(edit.customPrice),
        }
      }
      const res = await fetch('/api/subscription-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setPlanSaveMsg('✅ تم الحفظ بنجاح')
        fetchSubscriptions()
        setTimeout(() => setPlanSaveMsg(''), 3000)
      } else {
        setPlanSaveMsg('❌ فشل الحفظ')
      }
    } catch { setPlanSaveMsg('❌ حدث خطأ') }
    finally { setIsSavingPlans(false) }
  }

  const handleSaveSubscription = async (placeId: string) => {
    setIsSavingSub(true)
    try {
      const body: Record<string, string | null> = {
        place_id: placeId,
        subscription_plan: editSubPlan,
        owner_name: editSubOwnerName.trim() || null,
        owner_phone: editSubOwnerPhone.trim() || null,
        subscription_amount: editSubAmount.trim() || null,
      }
      if (editSubExpiry) body.subscription_expires_at = new Date(editSubExpiry).toISOString()
      const res = await fetch('/api/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        toast.success('تم تحديث الباقة')
        setEditSubId(null)
        fetchSubscriptions()
      } else {
        toast.error('فشل تحديث الباقة')
      }
    } catch { toast.error('حدث خطأ') }
    finally { setIsSavingSub(false) }
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

  const fetchPlaceMessages = async () => {
    if (!placeId) return
    setIsFetchingPlaceMessages(true)
    try {
      const res = await fetch(`/api/messages?place_id=${placeId}&limit=50`)
      if (res.ok) setPlaceMessages(await res.json())
    } catch {} finally { setIsFetchingPlaceMessages(false) }
  }

  useEffect(() => {
    if (!isDevAdmin && placeId) fetchPlaceMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevAdmin, placeId])

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
        body: JSON.stringify({ name: newPlaceName.trim(), code: newPlaceName.trim(), description: newPlaceDesc.trim() || undefined, place_type: newPlaceType, free_drinks_count: newPlaceType === 'company' ? newPlaceFreeCount : 0 })
      })
      const data = await res.json()
      if (!res.ok) { setPlacesError(data.error || 'حدث خطأ'); return }
      setNewPlaceName(''); setNewPlaceDesc(''); setNewPlaceType('cafe'); setNewPlaceFreeCount(0)
      fetchPlaces()
    } catch { setPlacesError('حدث خطأ') } finally { setIsAddingPlace(false) }
  }

  const handleDeletePlace = async (id: string) => {
    await fetch(`/api/places/${id}`, { method: 'DELETE' })
    fetchPlaces()
  }

  const handleSetFreeDrink = async (placeId: string, drinkId: string | null, freeCount: number) => {
    setIsSavingFreeDrink(true)
    try {
      const res = await fetch(`/api/places/${placeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_drink_id: drinkId, free_drinks_count: freeCount })
      })
      if (res.ok) {
        await fetchPlaces()
        toast.success('تم حفظ إعدادات المشروب المجاني ✅')
      }
    } catch { toast.error('حدث خطأ') } finally { setIsSavingFreeDrink(false) }
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

  const handleTabChange = (v: string) => {
    if (isDevAdmin && !canAccessDevTab(v)) return
    setActiveAdminTab(v)
    if (v === 'alerts') fetchSmartAlerts()
    if (v === 'notes' && isDevAdmin) { fetch('/api/settings?key=dev_notes').then(r => r.json()).then(d => { if (d.value) setDevNote(d.value) }).catch(() => {}) }
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
    if (v === 'subscriptions' && isDevAdmin) fetchSubscriptions()
    if (v === 'tables' && !isDevAdmin) { fetchPlaceTableCount(); fetchInventory() }
    if (v === 'settings' && !isDevAdmin && placeId) { fetchClosedStatus() }
    if (v === 'settings' && !isDevAdmin && placeId) { fetchPlaces().then(list => { const p = list.find((pl: Place) => pl.id === placeId); if (p) { setReservationsEnabledMap(prev => ({ ...prev, [placeId]: !!p.reservations_enabled })); setOrderTrackingMap(prev => ({ ...prev, [placeId]: p.order_tracking_enabled !== false })) } }) }
    if (v === 'settings' && isDevAdmin) { fetchGlobalBanner(); fetchPlaces().then(list => { const m: Record<string, boolean> = {}; list.forEach((p: Place) => { m[p.id] = p.order_tracking_enabled !== false }); setOrderTrackingMap(m) }) }
    if (v === 'cashier') { if (isDevAdmin) { fetchPlaces().then(list => { if (list.length > 0) setCashierPlaceId(prev => { const chosen = prev || list[0].id; fetchCashierOrders(chosen); return chosen }) }); fetchCashierUsers() } else if (placeId) { setCashierPlaceId(placeId); setCashierUserPlaceId(placeId); setTableNewPlaceId(placeId); setTablesPlaceId(placeId); setFeeSettingsPlaceId(placeId); fetchCashierOrders(placeId); fetchCashierUsers(placeId); fetchTableUsers(placeId); fetchPlaces().then(list => { const p = list.find((pl: Place) => pl.id === placeId); if (p) { setFeeServiceCharge(p.service_charge != null ? String(p.service_charge) : '0'); setFeeTaxRate(p.tax_rate != null ? String(p.tax_rate) : '0') } }) } }
    if (v === 'reservations') { if (!isDevAdmin && placeId) { setReservationsPlaceId(placeId); fetchReservations(placeId) } fetchPlaces().then(list => { if (list.length > 0) { const pid = isDevAdmin ? (reservationsPlaceId || list[0].id) : (placeId || list[0].id); if (isDevAdmin) { setReservationsPlaceId(pid); fetchReservations(pid) } const p = list.find((pl: Place) => pl.id === pid); if (p) setReservationsEnabledMap(prev => ({ ...prev, [pid]: !!p.reservations_enabled })) } }) }
    if (v === 'analytics') {
      if (isDevAdmin) { fetchAnalytics({ global: true }) }
      else if (placeId) { setAnalyticsPlaceId(placeId); fetchAnalytics({ placeId }) }
    }
    if (v === 'count' && isDevAdmin) fetchPlaces().then(list => { if (list.length > 0) setCountPlaceId(prev => { const chosen = prev || list[0].id; fetchCountForPlace(chosen); return chosen }) })
    if (v === 'feature-flags' && !flagsLoaded) loadFeatureFlags()
  }

  return (
    <div className="space-y-4">

      {/* ── Dev Admin Premium Header ── */}
      {isDevAdmin ? (
        <div className="space-y-3">
          {/* ── Main Identity Card ── */}
          <div className="relative rounded-2xl overflow-hidden" style={{
            background: 'linear-gradient(140deg, #04000d 0%, #0a0020 35%, #120038 65%, #0d001f 100%)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.35), 0 8px 40px rgba(109,40,217,0.15), inset 0 1px 0 rgba(255,255,255,0.04)'
          }}>
            {/* Animated sweep border */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden">
              <div className="h-full w-[200%]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0) 10%, rgba(167,139,250,0.9) 25%, rgba(99,102,241,1) 35%, rgba(167,139,250,0.9) 45%, rgba(139,92,246,0) 60%, transparent 100%)', animation: 'sweep 2.5s linear infinite' }} />
            </div>
            <style>{`@keyframes sweep { 0%{transform:translateX(-50%)} 100%{transform:translateX(0%)} } @keyframes devpulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }`}</style>

            {/* Glow orbs */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)', filter: 'blur(28px)' }} />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.14), transparent 70%)', filter: 'blur(22px)' }} />
            {/* Circuit grid */}
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

            <div className="relative p-5 space-y-4">
              {/* ── Row 1: Identity ── */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  {/* Avatar */}
                  <style>{`
                    @keyframes spinRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  `}</style>
                  <input
                    ref={adminPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAdminPhotoUpload}
                  />
                  <div
                    className="relative shrink-0 cursor-pointer"
                    style={{ width: 72, height: 72 }}
                    onClick={() => !adminPhotoUploading && adminPhotoInputRef.current?.click()}
                    onMouseEnter={() => setAdminPhotoHover(true)}
                    onMouseLeave={() => setAdminPhotoHover(false)}
                  >
                    {/* Spinning gradient ring */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        padding: 3,
                        background: 'conic-gradient(from 0deg, #7c3aed, #4f46e5, #818cf8, #c4b5fd, #7c3aed)',
                        animation: 'spinRing 3s linear infinite',
                        borderRadius: '50%',
                      }}
                    >
                      <div className="w-full h-full rounded-full" style={{ background: '#04000d' }} />
                    </div>
                    {/* Photo or placeholder */}
                    <div
                      className="absolute rounded-full overflow-hidden flex items-center justify-center"
                      style={{ inset: 3, background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(79,70,229,0.18))' }}
                    >
                      {adminPhotoUploading ? (
                        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#c4b5fd' }} />
                      ) : adminPhotoUrl ? (
                        <img src={adminPhotoUrl} alt="Admin" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="h-9 w-9" style={{ color: '#a78bfa' }} />
                      )}
                      {/* Hover overlay */}
                      {adminPhotoHover && !adminPhotoUploading && (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full"
                          style={{ background: 'rgba(4,0,13,0.65)', backdropFilter: 'blur(2px)' }}
                        >
                          <Camera className="h-4 w-4" style={{ color: '#e9d5ff' }} />
                          <span className="text-[9px] font-bold" style={{ color: '#e9d5ff' }}>تغيير</span>
                        </div>
                      )}
                    </div>
                    {/* Online dot */}
                    <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2" style={{ background: '#10b981', borderColor: '#04000d', boxShadow: '0 0 8px rgba(16,185,129,0.7)', zIndex: 10 }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h1 className="text-lg font-black tracking-tight text-white" style={{ textShadow: '0 0 24px rgba(167,139,250,0.6)' }}>Developer Admin</h1>
                    </div>
                    <p className="text-[11px] font-mono" style={{ color: '#7c6e9e' }}>root@sipflow · <span style={{ color: '#a78bfa' }}>full access</span></p>
                    <button
                      onClick={() => !adminPhotoUploading && adminPhotoInputRef.current?.click()}
                      className="mt-1 text-[10px] font-semibold transition-colors duration-200"
                      style={{ color: adminPhotoUrl ? '#6d5a9e' : '#a78bfa', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {adminPhotoUploading ? 'جارٍ الرفع...' : adminPhotoUrl ? '✎ تغيير الصورة الشخصية' : '+ اضغط للصورة الشخصية'}
                    </button>
                  </div>
                </div>
                {/* Right side: badge + clock */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.2em] uppercase"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(79,70,229,0.2))', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd', boxShadow: '0 0 12px rgba(139,92,246,0.25)' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />MASTER
                  </div>
                  <p className="font-mono text-base font-black tabular-nums" style={{ color: '#e9d5ff', letterSpacing: '0.06em', textShadow: '0 0 14px rgba(167,139,250,0.5)' }}>{currentTime}</p>
                  <p className="text-[10px] font-mono" style={{ color: '#4c3d72' }}>{currentDate}</p>
                </div>
              </div>

              {/* ── Row 2: KPI Cards ── */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'الأماكن',   value: places.length,               icon: '🏠', color: '#c4b5fd', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)', glow: 'rgba(139,92,246,0.15)' },
                  { label: 'الموظفون', value: staffUsers.length,             icon: '👥', color: '#6ee7b7', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.22)', glow: 'rgba(16,185,129,0.1)' },
                  { label: 'العملاء',  value: clients.length,               icon: '⭐', color: '#fcd34d', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', glow: 'rgba(245,158,11,0.1)' },
                  { label: 'الأصناف',  value: allDrinksStats?.total ?? '—', icon: '☕', color: '#f9a8d4', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.22)', glow: 'rgba(236,72,153,0.1)' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5 text-center transition-all duration-200 hover:scale-105 cursor-default"
                    style={{ background: s.bg, border: `1px solid ${s.border}`, boxShadow: `0 0 12px ${s.glow}` }}>
                    <p className="text-lg leading-none mb-1">{s.icon}</p>
                    <p className="text-lg font-black text-white tabular-nums leading-none">{s.value}</p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Row 3: System health ── */}
              <div className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-xs font-bold text-emerald-400">All Systems Operational</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[{ label: 'DB', color: '#6ee7b7' }, { label: 'API', color: '#6ee7b7' }, { label: 'Auth', color: '#6ee7b7' }, { label: 'CDN', color: '#6ee7b7' }].map(s => (
                    <span key={s.label} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)', color: s.color }}>
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />{s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Row 4: Developer signature ── */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#a78bfa', textShadow: '0 0 8px rgba(167,139,250,0.4)', letterSpacing: '0.08em' }}>Basem Samir Ebeid · SîpFlõw v2.0</span>
                <span className="text-[10px] font-mono" style={{ color: '#3d2d60' }}>ENV: production · region: auto</span>
              </div>
            </div>
          </div>

          {/* ── Nav Grid (replaces quick-access strip) ── */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-1" style={{ color: '#5b4a8a' }}>Navigation</p>
            {/* Group: Core */}
            <div className="space-y-1.5">
              {/* Live Places Hub — full width */}
              {canAccessDevTab('live') && <button onClick={() => handleTabChange('live')}
                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: activeAdminTab === 'live' ? 'linear-gradient(135deg, rgba(16,185,129,0.35), rgba(5,150,105,0.25))' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${activeAdminTab === 'live' ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.15)'}`,
                  boxShadow: activeAdminTab === 'live' ? '0 0 14px rgba(16,185,129,0.2)' : 'none'
                }}>
                <Radio className="h-4 w-4" style={{ color: activeAdminTab === 'live' ? '#6ee7b7' : '#3d6b56' }} />
                <span className="text-xs font-bold" style={{ color: activeAdminTab === 'live' ? '#6ee7b7' : '#3d6b56' }}>Live Places Hub</span>
                <span className="ml-auto flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </button>}

              {/* Smart Alerts — full width */}
              {canAccessDevTab('alerts') && <button onClick={() => handleTabChange('alerts')}
                className="relative w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: activeAdminTab === 'alerts'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.35), rgba(220,38,38,0.25))'
                    : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${activeAdminTab === 'alerts' ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.18)'}`,
                  boxShadow: activeAdminTab === 'alerts' ? '0 0 14px rgba(239,68,68,0.2)' : 'none'
                }}>
                <BrainCircuit className="h-4 w-4 shrink-0" style={{ color: activeAdminTab === 'alerts' ? '#fca5a5' : '#7f3030' }} />
                <span className="text-xs font-bold" style={{ color: activeAdminTab === 'alerts' ? '#fca5a5' : '#7f3030' }}>Smart Alerts</span>
                {(smartAlertsMeta?.critical ?? 0) + (smartAlertsMeta?.warning ?? 0) > 0 ? (
                  <span className="ml-auto flex items-center gap-1">
                    {(smartAlertsMeta?.critical ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white animate-pulse">
                        {smartAlertsMeta!.critical}
                      </span>
                    )}
                    {(smartAlertsMeta?.warning ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">
                        {smartAlertsMeta!.warning}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="ml-auto h-2 w-2 rounded-full" style={{ background: 'rgba(239,68,68,0.3)' }} />
                )}
              </button>}

              {/* Analytics group */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#7c3aed' }}>Analytics</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { tab: 'analytics', icon: <TrendingUp className="h-3.5 w-3.5" />,  label: 'Reports',     ac: '#7c3aed' },
                    { tab: 'notes',     icon: <FileText className="h-3.5 w-3.5" />,    label: 'Notes',        ac: '#7c3aed' },
                  ].filter(item => canAccessDevTab(item.tab)).map(item => (
                    <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                      className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                      style={{
                        background: activeAdminTab === item.tab ? `rgba(124,58,237,0.3)` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activeAdminTab === item.tab ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: activeAdminTab === item.tab ? '0 0 10px rgba(124,58,237,0.2)' : 'none',
                        color: activeAdminTab === item.tab ? '#ddd6fe' : '#5b4a8a'
                      }}>
                      {item.icon}
                      <span className="text-[10px] font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content group */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#b45309' }}>Content</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { tab: 'drinks',       icon: <Coffee className="h-3.5 w-3.5" />,      label: 'Drinks',       ac: '#d97706' },
                    { tab: 'inventory',    icon: <Package className="h-3.5 w-3.5" />,     label: 'Inventory',    ac: '#d97706' },
                    { tab: 'cashier',      icon: <Banknote className="h-3.5 w-3.5" />,    label: 'Cashier',      ac: '#d97706' },
                    { tab: 'reservations', icon: <CalendarDays className="h-3.5 w-3.5" />,label: 'Reservations', ac: '#d97706' },
                  ].filter(item => canAccessDevTab(item.tab)).map(item => (
                    <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                      className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                      style={{
                        background: activeAdminTab === item.tab ? 'rgba(217,119,6,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activeAdminTab === item.tab ? 'rgba(217,119,6,0.55)' : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: activeAdminTab === item.tab ? '0 0 10px rgba(217,119,6,0.18)' : 'none',
                        color: activeAdminTab === item.tab ? '#fde68a' : '#5b4a8a'
                      }}>
                      {item.icon}
                      <span className="text-[10px] font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* People group */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#047857' }}>People</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { tab: 'place-admins', icon: <UserCog className="h-3.5 w-3.5" />,   label: 'Admins',    ac: '#059669' },
                    { tab: 'staff',        icon: <Users className="h-3.5 w-3.5" />,      label: 'Employees', ac: '#059669' },
                    { tab: 'places',       icon: <Link2 className="h-3.5 w-3.5" />,      label: 'Places',    ac: '#059669' },
                  ].filter(item => canAccessDevTab(item.tab)).map(item => (
                    <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                      className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                      style={{
                        background: activeAdminTab === item.tab ? 'rgba(5,150,105,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activeAdminTab === item.tab ? 'rgba(5,150,105,0.55)' : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: activeAdminTab === item.tab ? '0 0 10px rgba(5,150,105,0.18)' : 'none',
                        color: activeAdminTab === item.tab ? '#6ee7b7' : '#5b4a8a'
                      }}>
                      {item.icon}
                      <span className="text-[10px] font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscriptions group */}
              {canAccessDevTab('subscriptions') && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#d97706' }}>Packages</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { tab: 'subscriptions', icon: <Award className="h-3.5 w-3.5" />, label: 'Subscriptions', ac: '#d97706' },
                    ].map(item => (
                      <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                        className="relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                        style={{
                          background: activeAdminTab === item.tab ? 'rgba(217,119,6,0.25)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${activeAdminTab === item.tab ? 'rgba(217,119,6,0.55)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: activeAdminTab === item.tab ? '0 0 10px rgba(217,119,6,0.18)' : 'none',
                          color: activeAdminTab === item.tab ? '#fde68a' : '#5b4a8a'
                        }}>
                        {item.icon}
                        <span className="text-[10px] font-semibold">{item.label}</span>
                        {subPlaces.filter(p => p.is_expired || p.expiring_soon).length > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">
                            {subPlaces.filter(p => p.is_expired || p.expiring_soon).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dev Tools group */}
              {canAccessDevTab('simulator') && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#6366f1' }}>Dev Tools</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { tab: 'simulator',     icon: <span className="text-sm">🎮</span>, label: 'Simulator',     ac: '#6366f1' },
                      { tab: 'templates',     icon: <span className="text-sm">📦</span>, label: 'Templates',     ac: '#a855f7' },
                      { tab: 'feature-flags', icon: <span className="text-sm">🚩</span>, label: 'Flags',          ac: '#10b981' },
                      { tab: 'ai-ideas',           icon: <span className="text-sm">💡</span>, label: 'AI Ideas',          ac: '#f59e0b' },
                      { tab: 'implemented-ideas',  icon: <span className="text-sm">✅</span>, label: 'Implemented',       ac: '#f43f5e' },
                    ].map(item => (
                      <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                        className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                        style={{
                          background: activeAdminTab === item.tab ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${activeAdminTab === item.tab ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: activeAdminTab === item.tab ? '0 0 10px rgba(99,102,241,0.18)' : 'none',
                          color: activeAdminTab === item.tab ? '#c7d2fe' : '#5b4a8a'
                        }}>
                        {item.icon}
                        <span className="text-[10px] font-semibold">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* System group */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: '#0369a1' }}>System</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { tab: 'messages',    icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'Messages',    ac: '#0284c7', badge: devNotifsUnread > 0 ? devNotifsUnread : 0 },
                    { tab: 'settings',    icon: <Settings2 className="h-3.5 w-3.5" />,     label: 'Settings',    ac: '#0284c7', badge: 0 },
                    { tab: 'branding',    icon: <span className="text-[13px] leading-none">🎨</span>, label: 'Branding', ac: '#a855f7', badge: 0 },
                    { tab: 'permissions', icon: <ShieldCheck className="h-3.5 w-3.5" />,   label: 'Permissions', ac: '#0284c7', badge: 0 },
                    { tab: 'danger',      icon: <Trash2 className="h-3.5 w-3.5" />,        label: 'Danger',      ac: '#dc2626', badge: 0 },
                  ].filter(item => canAccessDevTab(item.tab)).map(item => (
                    <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                      className="relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-150 hover:scale-105 active:scale-95"
                      style={(() => {
                        const isActive = activeAdminTab === item.tab
                        const ac = item.ac
                        const acAlpha25 = ac + '40'
                        const acAlpha55 = ac + '8c'
                        const acAlpha18 = ac + '2e'
                        return {
                          background: isActive ? (item.tab === 'danger' ? 'rgba(220,38,38,0.25)' : acAlpha25) : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isActive ? (item.tab === 'danger' ? 'rgba(220,38,38,0.55)' : acAlpha55) : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: isActive ? `0 0 10px ${item.tab === 'danger' ? 'rgba(220,38,38,0.18)' : acAlpha18}` : 'none',
                          color: isActive ? (item.tab === 'danger' ? '#fca5a5' : (item.tab === 'branding' ? '#d8b4fe' : '#7dd3fc')) : '#5b4a8a',
                        }
                      })()}>
                      {item.icon}
                      <span className="text-[10px] font-semibold">{item.label}</span>
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black animate-bounce">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── Place Admin header ── */
        <div className="relative rounded-2xl overflow-hidden mb-1" style={{
          background: 'linear-gradient(145deg, #0c0800 0%, #170d00 35%, #1e1200 65%, #140c00 100%)',
          boxShadow: '0 0 0 1px rgba(212,160,23,0.2), 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          {/* top shimmer line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(212,160,23,0.4) 20%, rgba(251,191,36,0.9) 50%, rgba(212,160,23,0.4) 80%, transparent 100%)' }} />
          {/* glow orbs */}
          <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 70%)', filter: 'blur(20px)' }} />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full" style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)', filter: 'blur(16px)' }} />

          <div className="relative p-4 space-y-4">
            {/* Top row: brand + status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: 'linear-gradient(135deg, rgba(212,160,23,0.2), rgba(251,191,36,0.08))', border: '1px solid rgba(212,160,23,0.35)', boxShadow: '0 0 12px rgba(212,160,23,0.15)' }}>
                  ☕
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-black text-white tracking-wide">لوحة الإدارة</h1>
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-black tracking-widest"
                      style={{ background: 'rgba(212,160,23,0.15)', border: '1px solid rgba(212,160,23,0.35)', color: '#fbbf24' }}>
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: 'rgba(212,160,23,0.75)' }}>
                    {currentPlace ? `📍 ${currentPlace.name}` : 'إدارة الأصناف والمستخدمين'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400">مباشر</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'الأصناف', value: drinks.length, icon: '🍹', accent: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.18)' },
                { label: 'طلبات اليوم', value: orders.length, icon: '📋', accent: '#60a5fa', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.18)' },
                { label: 'المستخدمين', value: users.length, icon: '👥', accent: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.18)' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center gap-0.5"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="text-base font-black text-white tabular-nums leading-tight">{s.value}</span>
                  <span className="text-[9px] font-semibold leading-none" style={{ color: s.accent }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Place code pill */}
            {currentPlace && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3" style={{ color: 'rgba(212,160,23,0.5)' }} />
                  <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color: 'rgba(212,160,23,0.6)' }}>{currentPlace.code}</span>
                </div>
                <span className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>SîpFlõw POS</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeAdminTab} onValueChange={handleTabChange} className="w-full">
        {/* ── Dev Admin: hidden TabsList (nav handled by grid above) ── */}
        {isDevAdmin ? (
          <TabsList className="hidden">
            {[
              ['alerts', 'Alerts'],
              ['analytics', 'Reports'],
              ['notes', 'المذكرة'],
              ['drinks', 'Drinks'],
              ['inventory', 'Inventory'],
              ['cashier', 'Cashier'],
              ['reservations', 'Reservations'],
              ['place-admins', 'Admins'],
              ['staff', 'Employees'],
              ['places', 'Places'],
              ['subscriptions', 'Subscriptions'],
              ['messages', 'Messages'],
              ['settings', 'Settings'],
              ['permissions', 'Permissions'],
              ['danger', 'Danger'],
              ['live', 'Live'],
              ['feature-flags', 'Feature Flags'],
              ['ai-ideas', 'AI Ideas'],
              ['implemented-ideas', 'Implemented Ideas'],
            ].filter(([value]) => canAccessDevTab(value)).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>
        ) : (
          /* ── Place Admin: modern grouped tab navigation ── */
          (() => {
            const placeTabsMeta: Record<string, { icon: React.ReactNode; active: string; activeBorder: string; activeText: string; dot?: { color: string; label: number } | null }> = {
              stats:        { icon: <BarChart3 className="h-4 w-4" />,        active: 'rgba(251,191,36,0.2)',  activeBorder: 'rgba(251,191,36,0.5)',  activeText: '#fbbf24', dot: null },
              tables:       { icon: <TableProperties className="h-4 w-4" />, active: 'rgba(251,191,36,0.2)',  activeBorder: 'rgba(251,191,36,0.5)',  activeText: '#fbbf24',
                dot: (() => { const n = new Set(orders.filter(o => o.table_number && o.status !== 'completed').map(o => o.table_number)).size; return n > 0 ? { color: '#34d399', label: n } : null })() },
              cashier:      { icon: <Banknote className="h-4 w-4" />,         active: 'rgba(251,191,36,0.2)',  activeBorder: 'rgba(251,191,36,0.5)',  activeText: '#fbbf24', dot: null },
              reservations: { icon: <CalendarDays className="h-4 w-4" />,     active: 'rgba(251,191,36,0.2)',  activeBorder: 'rgba(251,191,36,0.5)',  activeText: '#fbbf24', dot: null },
              drinks:       { icon: <Coffee className="h-4 w-4" />,           active: 'rgba(251,146,60,0.18)', activeBorder: 'rgba(251,146,60,0.45)', activeText: '#fb923c', dot: null },
              inventory:    { icon: <Package className="h-4 w-4" />,          active: 'rgba(251,146,60,0.18)', activeBorder: 'rgba(251,146,60,0.45)', activeText: '#fb923c',
                dot: (() => { const n = drinks.filter(d => (inventoryMap[d.id] ?? 0) < lowStockThreshold && (inventoryMap[d.id] ?? 0) >= 0).length; return n > 0 ? { color: '#f59e0b', label: n } : null })() },
              analytics:    { icon: <TrendingUp className="h-4 w-4" />,       active: 'rgba(251,146,60,0.18)', activeBorder: 'rgba(251,146,60,0.45)', activeText: '#fb923c', dot: null },
              staff:        { icon: <UserCog className="h-4 w-4" />,          active: 'rgba(52,211,153,0.15)', activeBorder: 'rgba(52,211,153,0.4)',  activeText: '#34d399', dot: null },
              messages:     { icon: <MessageSquare className="h-4 w-4" />,    active: 'rgba(96,165,250,0.15)', activeBorder: 'rgba(96,165,250,0.4)',  activeText: '#60a5fa', dot: null },
              settings:     { icon: <Settings2 className="h-4 w-4" />,        active: 'rgba(96,165,250,0.15)', activeBorder: 'rgba(96,165,250,0.4)',  activeText: '#60a5fa', dot: null },
              danger:       { icon: <Trash2 className="h-4 w-4" />,           active: 'rgba(248,113,113,0.18)',activeBorder: 'rgba(248,113,113,0.45)',activeText: '#f87171', dot: null },
            }
            const groupOrder: Array<{ id: string; label: string; cols: number }> = [
              { id: 'operations', label: 'Operations', cols: 4 },
              { id: 'menu',       label: 'Menu',       cols: 3 },
              { id: 'system',     label: 'System',     cols: 4 },
            ]
            const renderTab = (value: string) => {
              const t = placeTabsMeta[value]
              if (!t) return null
              return (
                <TabsTrigger key={value} value={value} className="relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 h-auto text-[10px] font-semibold transition-all duration-200 border"
                  style={{
                    background: activeAdminTab === value ? t.active : 'rgba(255,255,255,0.03)',
                    borderColor: activeAdminTab === value ? t.activeBorder : 'rgba(255,255,255,0.06)',
                    color: activeAdminTab === value ? t.activeText : 'rgba(255,255,255,0.35)',
                    boxShadow: activeAdminTab === value ? `0 0 12px ${t.activeBorder}` : 'none',
                  }}>
                  {t.icon}
                  <span>{getTabLabel(value)}</span>
                  {t.dot && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-black"
                      style={{ background: t.dot.color }}>
                      {t.dot.label}
                    </span>
                  )}
                </TabsTrigger>
              )
            }
            return (
              <TabsList className="flex w-full h-auto flex-col gap-2 bg-transparent border-0 p-0 mb-3">
                {groupOrder.map((g, idx) => (
                  <div key={g.id} className="contents">
                    <div className={'flex items-center gap-1 w-full' + (idx > 0 ? ' mt-1' : '')}>
                      <span className="text-[9px] font-black tracking-widest shrink-0 px-1" style={{ color: 'rgba(212,160,23,0.35)' }}>{g.label}</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(212,160,23,0.1)' }} />
                    </div>
                    <div className={`grid gap-1.5 w-full ${g.cols === 3 ? 'grid-cols-3' : g.cols === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {(tabOrder[g.id] || DEFAULT_TAB_ORDER[g.id] || []).map(renderTab)}
                    </div>
                  </div>
                ))}
              </TabsList>
            )
          })()
        )}

        {/* ── Live Places Hub Tab ── */}
        <TabsContent value="live" className="space-y-4">
          <LivePlacesHub />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {devAdminRole === 'super_developer' ? (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)' }}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-violet-100">صلاحيات أدمن المطور</h3>
                    <p className="text-[11px] text-violet-300/70">أنشئ حسابات Developer Admin محدودة حسب الوظيفة: دعم، مبيعات، مالية، أو صلاحية كاملة.</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-emerald-200" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>Super فقط</span>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <Label className="text-xs text-zinc-300">اسم الأدمن</Label>
                    <Input value={devAdminAccountName} onChange={e => setDevAdminAccountName(e.target.value)} placeholder="مثال: support1" className="mt-1 bg-black/40 border-violet-900/50 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-300">{editingDevAdminAccount ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</Label>
                    <Input type="password" value={devAdminAccountPassword} onChange={e => setDevAdminAccountPassword(e.target.value)} placeholder={editingDevAdminAccount ? 'اتركها كما هي' : '••••••••'} className="mt-1 bg-black/40 border-violet-900/50 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-300">الدور</Label>
                    <select value={devAdminAccountRole} onChange={e => setDevAdminAccountRole(e.target.value as DevAdminRole)} className="mt-1 h-10 w-full rounded-md border border-violet-900/50 bg-black/40 px-3 text-sm text-white">
                      <option value="support_admin">Support Admin — دعم</option>
                      <option value="sales_admin">Sales Admin — مبيعات</option>
                      <option value="finance_admin">Finance Admin — مالية</option>
                      <option value="super_developer">Super Developer — كامل</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleSaveDevAdminAccount} disabled={isSavingDevAdminAccount} className="flex-1 bg-violet-700 hover:bg-violet-600">
                      {isSavingDevAdminAccount ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-2 h-4 w-4" />}
                      {editingDevAdminAccount ? 'تحديث' : 'إضافة'}
                    </Button>
                    {editingDevAdminAccount && (
                      <Button variant="outline" onClick={() => { setEditingDevAdminAccount(null); setDevAdminAccountName(''); setDevAdminAccountPassword(''); setDevAdminAccountRole('support_admin') }} className="border-zinc-700 text-zinc-300">إلغاء</Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {devAdminAccounts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-violet-800/50 p-6 text-center text-sm text-zinc-400 md:col-span-2">لا توجد حسابات محدودة بعد. كلمة سر المطوّر الحالية ما زالت تعمل كـ Super Developer.</div>
                ) : devAdminAccounts.map(account => (
                  <div key={account.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{account.name}</p>
                        <p className="text-[11px] text-zinc-400">{devRoleMeta[account.role].label} — {devRoleMeta[account.role].description}</p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-emerald-200" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>{account.active ? 'نشط' : 'موقوف'}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingDevAdminAccount(account); setDevAdminAccountName(account.name); setDevAdminAccountPassword(''); setDevAdminAccountRole(account.role) }} className="border-violet-800/60 text-violet-200">
                        <Pencil className="ml-1.5 h-3.5 w-3.5" /> تعديل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteDevAdminAccount(account.id)} className="border-red-900/60 text-red-300">
                        <Trash2 className="ml-1.5 h-3.5 w-3.5" /> حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200">هذه الصفحة متاحة فقط لصلاحية Super Developer.</div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════ */}
        {/* Smart Alerts Tab                              */}
        {/* ══════════════════════════════════════════════ */}
        <TabsContent value="alerts" className="space-y-3">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, #0d0505 0%, #1a0a0a 60%, #200e0e 100%)',
            border: '1px solid rgba(239,68,68,0.25)'
          }}>
            <div className="pointer-events-none absolute -top-6 -right-6 h-32 w-32 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, #ef4444, transparent)', filter: 'blur(20px)' }} />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <BrainCircuit className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">Smart Alerts</h2>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {smartAlertsLastRun
                      ? `آخر تحليل: ${smartAlertsLastRun.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                      : 'اضغط للتحليل'}
                    {smartAlertsMeta && ` · ${smartAlertsMeta.places} مكان`}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchSmartAlerts}
                disabled={smartAlertsLoading}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
              >
                {smartAlertsLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />جاري التحليل...</>
                  : <><RefreshCw className="h-3.5 w-3.5" />تحليل الآن</>}
              </button>
            </div>

            {/* Summary pills */}
            {smartAlertsMeta && (
              <div className="relative mt-3 flex gap-2">
                <span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                  <Siren className="h-3 w-3" />{smartAlertsMeta.critical} حرجة
                </span>
                <span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d' }}>
                  <AlertTriangle className="h-3 w-3" />{smartAlertsMeta.warning} تحذير
                </span>
                <span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                  <Bell className="h-3 w-3" />{smartAlertsMeta.info} معلومة
                </span>
              </div>
            )}
          </div>

          {/* Loading state */}
          {smartAlertsLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <BrainCircuit className="h-6 w-6 text-red-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">جاري تحليل كل الأماكن...</p>
                <p className="text-xs text-zinc-500 mt-0.5">فحص الطلبات · الكاشير · نداءات النادل</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!smartAlertsLoading && smartAlertsLastRun && smartAlerts.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">كل شيء تمام 🎉</p>
              <p className="text-xs text-zinc-500">مفيش تنبيهات في الوقت الحالي</p>
            </div>
          )}

          {/* Initial state - not run yet */}
          {!smartAlertsLoading && !smartAlertsLastRun && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <BrainCircuit className="h-6 w-6" style={{ color: 'rgba(239,68,68,0.5)' }} />
              </div>
              <p className="text-sm font-semibold text-white">اضغط "تحليل الآن" لبدء الفحص</p>
              <p className="text-xs text-zinc-500">سيتم فحص كل الأماكن النشطة وإظهار التنبيهات الذكية</p>
              <button
                onClick={fetchSmartAlerts}
                className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(220,38,38,0.2))', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
              >
                <BrainCircuit className="h-4 w-4" />ابدأ التحليل
              </button>
            </div>
          )}

          {/* Alerts feed */}
          {!smartAlertsLoading && smartAlerts.length > 0 && (
            <div className="space-y-2">
              {smartAlerts.map(alert => {
                const isCritical = alert.severity === 'critical'
                const isWarning = alert.severity === 'warning'
                const color = isCritical ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5', icon: '#ef4444', dot: '#ef4444' }
                  : isWarning ? { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d', icon: '#f59e0b', dot: '#f59e0b' }
                  : { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.22)', text: '#a5b4fc', icon: '#6366f1', dot: '#6366f1' }

                const typeIcon = alert.type === 'stuck_orders' ? '⏳'
                  : alert.type === 'cashier_silent' ? '💳'
                  : alert.type === 'high_pending' ? '🔥'
                  : alert.type === 'ghost_session' ? '👻'
                  : alert.type === 'waiter_spike' ? '📣'
                  : '⚠️'

                return (
                  <div key={alert.id} className="relative overflow-hidden rounded-xl p-3.5"
                    style={{ background: color.bg, border: `1px solid ${color.border}` }}>
                    {isCritical && (
                      <div className="pointer-events-none absolute inset-0 rounded-xl animate-pulse opacity-20"
                        style={{ background: 'rgba(239,68,68,0.08)' }} />
                    )}
                    <div className="relative flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                        style={{ background: `${color.bg}`, border: `1px solid ${color.border}` }}>
                        {typeIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                            style={{ background: `${color.border}`, color: color.text }}>
                            {isCritical ? 'حرجة' : isWarning ? 'تحذير' : 'معلومة'}
                          </span>
                          <span className="text-[11px] font-bold truncate" style={{ color: color.text }}>
                            📍 {alert.place_name}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white leading-snug">{alert.message}</p>
                        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(alert.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Auto-refresh note */}
          {smartAlertsLastRun && (
            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              النظام لا يعمل تلقائياً في الخلفية — اضغط "تحليل الآن" لتحديث النتائج
            </p>
          )}
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
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.03))', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Label className="text-xs font-medium mb-2 block" style={{ color: '#a78bfa' }}>اختر المكان لعرض إحصائياته</Label>
              <select
                value={statsPlaceId}
                onChange={e => { setStatsPlaceId(e.target.value); fetchStatsForPlace(e.target.value) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
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
            <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div className="flex items-center gap-2" style={{ color: '#a78bfa' }}>
                <Coffee className="h-4 w-4" />
                <span className="text-xs font-medium">إجمالي الطلبات</span>
              </div>
              <p className="mt-2 text-3xl font-black text-white">
                {ao.reduce((acc, o) => acc + o.quantity, 0)}
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div className="flex items-center gap-2" style={{ color: '#818cf8' }}>
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">المستخدمين النشطين</span>
              </div>
              <p className="mt-2 text-3xl font-black text-white">
                {new Set(ao.map(o => o.user_id)).size}
              </p>
            </div>
          </div>

          {/* Top Drinks */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: '#a78bfa' }} />
              <h3 className="font-bold text-white text-sm">أكثر المشروبات طلباً</h3>
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
          <div className="rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">أكثر المستخدمين طلباً</h3>
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
          <div className="rounded-2xl p-4" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-white text-sm">آخر الطلبات</h3>
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
          <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.06) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,0.05) 0%, transparent 50%)' }} />
            <div className="relative p-5 pb-3">
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Coffee className="h-4 w-4" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">إضافة صنف جديد</h3>
                  <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>أضف مشروب أو صنف جديد للمنيو</p>
                </div>
              </div>
            </div>
            <div className="relative px-5 pb-5 space-y-4">
              {/* Dev admin: place selector */}
              {isDevAdmin && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>المكان</Label>
                  <select
                    value={devDrinkPlaceId}
                    onChange={e => setDevDrinkPlaceId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>اسم الصنف</Label>
                  <Input
                    value={newDrinkName}
                    onChange={(e) => setNewDrinkName(e.target.value)}
                    placeholder="كابتشينو"
                    className="h-10 text-sm rounded-xl text-white placeholder:text-white/25"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>السعر</Label>
                  <Input
                    type="number"
                    value={newDrinkPrice}
                    onChange={(e) => setNewDrinkPrice(e.target.value)}
                    placeholder="0"
                    className="h-10 text-sm rounded-xl text-white placeholder:text-white/25"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>الكمية الابتدائية في المخزون</Label>
                <Input
                  type="number"
                  value={newDrinkInitialStock}
                  onChange={(e) => setNewDrinkInitialStock(e.target.value)}
                  placeholder="100"
                  min="0"
                  className="h-10 text-sm rounded-xl text-white placeholder:text-white/25"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                />
              </div>
              {/* Category selector */}
              <div>
                <Label className="text-xs font-medium mb-2 block" style={{ color: '#a78bfa' }}>القسم</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'hot', label: '☕ ساخن', activeColor: 'rgba(239,68,68,0.2)', activeBorder: 'rgba(239,68,68,0.5)', activeText: '#fca5a5' },
                    { key: 'cold', label: '🧊 بارد', activeColor: 'rgba(56,189,248,0.2)', activeBorder: 'rgba(56,189,248,0.5)', activeText: '#7dd3fc' },
                    { key: 'shisha', label: '💨 شيشة', activeColor: 'rgba(139,92,246,0.2)', activeBorder: 'rgba(139,92,246,0.5)', activeText: '#c4b5fd' },
                  ] as const).map(({ key, label, activeColor, activeBorder, activeText }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewDrinkCategory(key)}
                      className="h-10 rounded-xl text-sm font-semibold transition-all duration-200"
                      style={newDrinkCategory === key ? { background: activeColor, border: `1.5px solid ${activeBorder}`, color: activeText, boxShadow: `0 0 12px ${activeColor}` } : { background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', color: 'rgba(255,255,255,0.35)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="w-full h-11 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}
                onClick={handleAddDrink} 
                disabled={!newDrinkName.trim() || (isDevAdmin && !devDrinkPlaceId)}
              >
                <Plus className="h-4 w-4" />
                إضافة الصنف
              </button>
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
                const placeDrinks = localDrinks.filter(d => d.place_id === devDrinkPlaceId)
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
                      {placeDrinks.map(drink => {
                        const isSeasonal = !!(drink.seasonal_start || drink.seasonal_end)
                        return (
                        <div
                          key={drink.id}
                          draggable
                          onDragStart={() => handleDragStart(drink.id)}
                          onDragOver={(e) => handleDragOver(e, drink.id)}
                          onDrop={() => handleDrop(drink.id, placeDrinks)}
                          onDragEnd={() => setDragOverId(null)}
                          className="flex items-center justify-between rounded-xl bg-muted p-3 transition-all"
                          style={dragOverId === drink.id ? { outline: '2px solid rgba(212,160,23,0.6)', background: 'rgba(212,160,23,0.07)' } : {}}
                        >
                          <div className="flex items-center gap-2">
                            <span className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing">
                              <GripVertical className="h-4 w-4" />
                            </span>
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
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{drink.name}</p>
                                {isSeasonal && (
                                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>موسمي</span>
                                )}
                              </div>
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
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
            )
          ) : (
          /* Place admin: flat list */
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">الأصناف الحالية ({localDrinks.length})</h3>
            <div className="space-y-2">
              {localDrinks.map((drink) => {
                const isSeasonal = !!(drink.seasonal_start || drink.seasonal_end)
                return (
                <div
                  key={drink.id}
                  draggable
                  onDragStart={() => handleDragStart(drink.id)}
                  onDragOver={(e) => handleDragOver(e, drink.id)}
                  onDrop={() => handleDrop(drink.id, localDrinks)}
                  onDragEnd={() => setDragOverId(null)}
                  className="flex items-center justify-between rounded-xl bg-muted p-3 transition-all"
                  style={dragOverId === drink.id ? { outline: '2px solid rgba(212,160,23,0.6)', background: 'rgba(212,160,23,0.07)' } : {}}
                >
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </span>
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{drink.name}</p>
                        {isSeasonal && (
                          <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>موسمي</span>
                        )}
                      </div>
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
                )
              })}
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
              {/* Seasonal Section */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌟</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#eab308' }}>عرض موسمي</p>
                      <p className="text-[10px] text-muted-foreground">يظهر الصنف فقط في الفترة المحددة</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditSeasonalEnabled(!editSeasonalEnabled)}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none`}
                    style={{ background: editSeasonalEnabled ? 'rgba(234,179,8,0.8)' : 'rgba(255,255,255,0.1)' }}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editSeasonalEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                {editSeasonalEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs mb-1 block" style={{ color: '#eab308' }}>من تاريخ</Label>
                      <Input
                        type="date"
                        value={editSeasonalStart}
                        onChange={e => setEditSeasonalStart(e.target.value)}
                        className="h-9 text-sm border-border bg-muted text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block" style={{ color: '#eab308' }}>إلى تاريخ</Label>
                      <Input
                        type="date"
                        value={editSeasonalEnd}
                        onChange={e => setEditSeasonalEnd(e.target.value)}
                        className="h-9 text-sm border-border bg-muted text-foreground"
                      />
                    </div>
                  </div>
                )}
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
          {(() => {
            const activeDrinks = isDevAdmin
              ? (inventoryDevPlaceId ? drinks.filter(d => d.place_id === inventoryDevPlaceId) : drinks)
              : drinks

            const totalCount = activeDrinks.length
            const outCount = activeDrinks.filter(d => (inventoryMap[d.id] ?? 0) === 0).length
            const lowCount = activeDrinks.filter(d => { const q = inventoryMap[d.id] ?? 0; return q > 0 && q < lowStockThreshold }).length
            const okCount = totalCount - outCount - lowCount

            const filtered = activeDrinks.filter(d => {
              const q = inventoryMap[d.id] ?? 0
              const matchSearch = invSearch === '' || d.name.toLowerCase().includes(invSearch.toLowerCase())
              const matchFilter =
                invFilterStatus === 'all' ? true :
                invFilterStatus === 'out' ? q === 0 :
                invFilterStatus === 'low' ? (q > 0 && q < lowStockThreshold) :
                q >= lowStockThreshold
              return matchSearch && matchFilter
            })

            const categories = Array.from(new Set(filtered.map(d => d.category || 'عام')))

            return (
              <>
                {/* ── Header ── */}
                <div className="relative overflow-hidden rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">إدارة المخزون</h3>
                        <p className="text-xs text-emerald-300">{totalCount} صنف إجمالي</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <span className="text-[10px] text-emerald-400">حد الإنذار</span>
                        <input type="number" min="0" value={lowStockThreshold}
                          onChange={e => setLowStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 rounded bg-transparent px-1 py-0.5 text-center text-xs font-bold text-amber-400 focus:outline-none"
                        />
                      </div>
                      <Button variant="outline" size="sm" className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => { fetchInventory(); toast.success('تم التحديث') }}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Stats cards ── */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'الكل', value: totalCount, color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', filter: 'all' as const },
                    { label: 'متوفر', value: okCount, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', filter: 'ok' as const },
                    { label: 'منخفض', value: lowCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', filter: 'low' as const },
                    { label: 'نفد', value: outCount, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', filter: 'out' as const },
                  ].map(s => (
                    <button key={s.filter} onClick={() => setInvFilterStatus(s.filter)}
                      className="rounded-xl p-2.5 text-center transition-all"
                      style={{ background: invFilterStatus === s.filter ? s.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${invFilterStatus === s.filter ? s.border : 'rgba(255,255,255,0.06)'}`, outline: invFilterStatus === s.filter ? `2px solid ${s.color}40` : 'none' }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </button>
                  ))}
                </div>

                {/* ── Dev admin place selector ── */}
                {isDevAdmin && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-violet-400">المكان</span>
                      {inventoryDevPlaceId && (
                        <button onClick={() => setInventoryDevPlaceId('')} className="text-[10px] text-muted-foreground hover:text-white underline">عرض الكل</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {places.map(p => {
                        const pDrinks = drinks.filter(d => d.place_id === p.id)
                        const pOut = pDrinks.filter(d => (inventoryMap[d.id] ?? 0) === 0).length
                        const pLow = pDrinks.filter(d => { const q = inventoryMap[d.id] ?? 0; return q > 0 && q < lowStockThreshold }).length
                        const isSelected = inventoryDevPlaceId === p.id
                        return (
                          <button key={p.id} onClick={() => setInventoryDevPlaceId(isSelected ? '' : p.id)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
                            style={{ background: isSelected ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.05)', border: `1px solid ${isSelected ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.15)'}`, color: isSelected ? '#c4b5fd' : '#a1a1aa' }}>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-[10px] opacity-60">{pDrinks.length}</span>
                            {pOut > 0 && <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">{pOut} نفد</span>}
                            {pLow > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-400">{pLow} ↓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Search + Bulk actions ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex flex-1 min-w-[160px] items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground text-sm">🔍</span>
                    <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
                      placeholder="بحث عن صنف..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0" />
                    {invSearch && <button onClick={() => setInvSearch('')} className="text-muted-foreground text-xs hover:text-white">✕</button>}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-1.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">ملء الكل بـ</span>
                    <input type="number" min="0" value={invBulkValue}
                      onChange={e => setInvBulkValue(e.target.value)}
                      className="w-12 rounded-lg bg-transparent px-1 py-0.5 text-center text-sm font-bold text-foreground focus:outline-none border border-border"
                    />
                    <Button size="sm" disabled={isInvBulkLoading || filtered.length === 0}
                      className="h-7 rounded-lg px-2 text-xs"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                      onClick={() => bulkSetInventory(filtered.map(d => d.id), parseInt(invBulkValue) || 0)}>
                      {isInvBulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'تطبيق'}
                    </Button>
                    <Button size="sm" disabled={isInvBulkLoading || filtered.length === 0} variant="outline"
                      className="h-7 rounded-lg px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => bulkSetInventory(filtered.map(d => d.id), 0)}>
                      تصفير
                    </Button>
                  </div>
                </div>

                {/* ── Empty state ── */}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    {invSearch ? `لا نتائج لـ "${invSearch}"` : isDevAdmin && !inventoryDevPlaceId ? 'اختر مكاناً أو ابحث عن صنف' : 'لا توجد أصناف'}
                  </div>
                )}

                {/* ── Drinks grouped by category ── */}
                {filtered.length > 0 && categories.map(cat => {
                  const catDrinks = filtered.filter(d => (d.category || 'عام') === cat)
                  if (catDrinks.length === 0) return null
                  const isExpanded = invExpandedCategories[cat] !== false
                  const catOut = catDrinks.filter(d => (inventoryMap[d.id] ?? 0) === 0).length
                  const catLow = catDrinks.filter(d => { const q = inventoryMap[d.id] ?? 0; return q > 0 && q < lowStockThreshold }).length
                  return (
                    <div key={cat} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Category header */}
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-right transition-colors hover:bg-white/[0.02]"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                        onClick={() => setInvExpandedCategories(prev => ({ ...prev, [cat]: !isExpanded }))}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-foreground">{cat}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{catDrinks.length} صنف</span>
                          {catOut > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-red-400" style={{ background: 'rgba(239,68,68,0.12)' }}>{catOut} نفد</span>}
                          {catLow > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-400" style={{ background: 'rgba(245,158,11,0.12)' }}>{catLow} منخفض</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={e => { e.stopPropagation(); bulkSetInventory(catDrinks.map(d => d.id), parseInt(invBulkValue) || 0) }}
                            className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-emerald-500/20"
                            style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)' }}>
                            ملء الفئة
                          </button>
                          <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* Drinks list */}
                      {isExpanded && (
                        <div className="divide-y divide-border/40">
                          {catDrinks.map(drink => {
                            const qty = inventoryMap[drink.id] ?? 0
                            const isOut = qty === 0
                            const isLow = qty > 0 && qty < lowStockThreshold
                            const isOk = qty >= lowStockThreshold
                            const maxBar = Math.max(lowStockThreshold * 3, qty, 1)
                            const barPct = Math.min(100, (qty / maxBar) * 100)
                            return (
                              <div key={drink.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.015]"
                                style={{ background: isOut ? 'rgba(239,68,68,0.03)' : isLow ? 'rgba(245,158,11,0.03)' : 'transparent' }}>
                                {/* Image */}
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                  {drink.image_url ? (
                                    <Image src={drink.image_url} alt={drink.name} fill className="object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                      <Coffee className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>

                                {/* Info + bar */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-sm text-foreground truncate">{drink.name}</p>
                                    {isOut && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-red-400" style={{ background: 'rgba(239,68,68,0.15)' }}>نفد</span>}
                                    {isLow && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-amber-400" style={{ background: 'rgba(245,158,11,0.15)' }}>⚠ منخفض</span>}
                                    {Number(drink.price) > 0 && <span className="shrink-0 text-[10px] text-primary">{Number(drink.price)} ج.م</span>}
                                  </div>
                                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                    <div className="h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${barPct}%`,
                                        background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'
                                      }} />
                                  </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Quick presets */}
                                  <div className="hidden sm:flex gap-1">
                                    {[0, 10, 50].map(preset => (
                                      <button key={preset} onClick={() => updateInventory(drink.id, preset)}
                                        className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors"
                                        style={{
                                          background: qty === preset ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                                          color: qty === preset ? '#818cf8' : '#71717a',
                                          border: `1px solid ${qty === preset ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`
                                        }}>
                                        {preset}
                                      </button>
                                    ))}
                                  </div>
                                  <button onClick={() => updateInventory(drink.id, Math.max(0, qty - 1))}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-white/10"
                                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <input type="number" value={qty} min="0"
                                    onChange={e => updateInventory(drink.id, Math.max(0, parseInt(e.target.value) || 0))}
                                    className="h-8 w-14 rounded-xl border border-border bg-muted/60 text-center text-sm font-bold focus:outline-none focus:border-primary"
                                    style={{ color: isOut ? '#ef4444' : isLow ? '#f59e0b' : 'inherit' }}
                                  />
                                  <button onClick={() => updateInventory(drink.id, qty + 1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-white/10"
                                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )
          })()}
        </TabsContent>

        {/* ── Place Admins Tab (Dev Admin only) ── */}
        <TabsContent value="place-admins" className="space-y-4">
          {(() => {
            const totalAdmins = users.filter(u => u.role === 'admin').length
            const placesWithoutAdmin = places.filter(p => !users.some(u => u.place_id === p.id && u.role === 'admin')).length
            return (
              <div className="space-y-4">

                {/* ── Hero header ── */}
                <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(79,70,229,0.1) 60%, rgba(16,185,129,0.06) 100%)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.12) 0%, transparent 60%)' }} />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
                        <ShieldCheck className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base leading-tight">أدمنز الأماكن</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}>
                            <UserCog className="h-3 w-3" />{totalAdmins} أدمن نشط
                          </span>
                          {placesWithoutAdmin > 0 && (
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>
                              ⚠ {placesWithoutAdmin} مكان بدون أدمن
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setShowCreateUser(v => !v); setCreateUserError(''); setCreateUserName(''); setCreateUserPassword(''); setCreateUserConfirmPass(''); setCreateUserPlaceId(''); setShowCreatePass(false) }}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all hover:scale-105 active:scale-95 shrink-0"
                      style={{ background: showCreateUser ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: showCreateUser ? '#fca5a5' : '#fff', border: showCreateUser ? '1px solid rgba(239,68,68,0.3)' : 'none', boxShadow: showCreateUser ? 'none' : '0 2px 12px rgba(124,58,237,0.35)' }}>
                      {showCreateUser ? <><span className="text-base leading-none">✕</span> إلغاء</> : <><Plus className="h-4 w-4" />أدمن جديد</>}
                    </button>
                  </div>
                </div>

                {/* ── Create admin form ── */}
                {showCreateUser && (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: 'rgba(124,58,237,0.25)' }}>
                        <UserPlus className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <p className="text-sm font-bold text-violet-300">إنشاء أدمن مكان جديد</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">المكان</label>
                        <select value={createUserPlaceId} onChange={e => setCreateUserPlaceId(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${createUserPlaceId ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                          <option value="">— اختر المكان —</option>
                          {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">اسم الأدمن</label>
                        <Input value={createUserName} onChange={e => setCreateUserName(e.target.value)}
                          placeholder="اسم أدمن المكان..."
                          className="rounded-xl border-white/10 bg-white/5 text-foreground text-sm focus-visible:border-violet-500/50 focus-visible:ring-0 h-10" />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">كلمة المرور</label>
                        <div className="relative">
                          <Input type={showCreatePass ? 'text' : 'password'} value={createUserPassword}
                            onChange={e => setCreateUserPassword(e.target.value)} placeholder="باسورد الأدمن..."
                            className="rounded-xl border-white/10 bg-white/5 text-foreground text-sm focus-visible:border-violet-500/50 focus-visible:ring-0 h-10 pl-10" />
                          <button type="button" onClick={() => setShowCreatePass(v => !v)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {createUserPassword.trim() && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">تأكيد كلمة المرور</label>
                          <div className="relative">
                            <Input type={showCreatePass ? 'text' : 'password'} value={createUserConfirmPass}
                              onChange={e => setCreateUserConfirmPass(e.target.value)} placeholder="أعد كتابة الباسورد..."
                              className={`rounded-xl border-white/10 bg-white/5 text-foreground text-sm focus-visible:ring-0 h-10 pl-10 ${createUserConfirmPass && createUserConfirmPass !== createUserPassword ? 'border-red-500/50' : createUserConfirmPass && createUserConfirmPass === createUserPassword ? 'border-emerald-500/50' : ''}`} />
                            <button type="button" onClick={() => setShowCreatePass(v => !v)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showCreatePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            {createUserConfirmPass && (
                              <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs">
                                {createUserConfirmPass === createUserPassword ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {createUserError && (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <span className="text-xs text-red-400">{createUserError}</span>
                      </div>
                    )}

                    <button
                      disabled={isCreatingUser}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', boxShadow: '0 2px 14px rgba(124,58,237,0.3)' }}
                      onClick={async () => {
                        if (!createUserPlaceId) { setCreateUserError('اختر المكان أولاً'); return }
                        if (!createUserName.trim()) { setCreateUserError('أدخل اسم الأدمن'); return }
                        if (!createUserPassword.trim()) { setCreateUserError('الباسورد مطلوب للأدمن'); return }
                        if (createUserPassword !== createUserConfirmPass) { setCreateUserError('الباسورد غير متطابق'); return }
                        setIsCreatingUser(true); setCreateUserError('')
                        try {
                          const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createUserName.trim(), password: createUserPassword, role: 'admin', place_id: createUserPlaceId }) })
                          if (!res.ok) throw new Error('Failed')
                          toast.success('تم إنشاء أدمن المكان بنجاح')
                          setShowCreateUser(false); onRefreshUsers?.()
                        } catch { setCreateUserError('فشل إنشاء الأدمن') }
                        setIsCreatingUser(false)
                      }}>
                      {isCreatingUser ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإنشاء...</> : <><CheckCircle2 className="h-4 w-4" /> إنشاء الأدمن</>}
                    </button>
                  </div>
                )}

                {/* ── Places list ── */}
                {places.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.1)' }}>
                      <UserCog className="h-7 w-7 text-violet-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">جاري تحميل الأماكن...</p>
                  </div>
                )}

                {places.map(place => {
                  const placeAdmins = users.filter(u => u.place_id === place.id && u.role === 'admin')
                  const placeNonAdmins = users.filter(u => u.place_id === place.id && u.role !== 'admin')
                  const hasAdmin = placeAdmins.length > 0
                  return (
                    <div key={place.id} className="rounded-2xl overflow-hidden transition-all" style={{ border: `1px solid ${hasAdmin ? 'rgba(124,58,237,0.18)' : 'rgba(239,68,68,0.18)'}` }}>

                      {/* Place header bar */}
                      <div className="flex items-center justify-between px-4 py-3 gap-3"
                        style={{ background: hasAdmin ? 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(79,70,229,0.06))' : 'linear-gradient(135deg, rgba(239,68,68,0.07), rgba(220,38,38,0.04))' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Place avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                            style={{ background: hasAdmin ? 'rgba(124,58,237,0.2)' : 'rgba(239,68,68,0.15)', color: hasAdmin ? '#c4b5fd' : '#fca5a5' }}>
                            {place.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{place.name}</p>
                            <p className="text-[10px] text-muted-foreground">{place.code} · {placeNonAdmins.length} مستخدم عادي</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                          style={{ background: hasAdmin ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: hasAdmin ? '#6ee7b7' : '#fca5a5', border: `1px solid ${hasAdmin ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                          {hasAdmin ? `${placeAdmins.length} أدمن` : 'بدون أدمن'}
                        </span>
                      </div>

                      <div className="p-4 space-y-3 bg-card/60">
                        {/* No admin placeholder */}
                        {!hasAdmin && (
                          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px dashed rgba(239,68,68,0.2)' }}>
                            <span className="text-lg">⚠️</span>
                            <p className="text-xs text-muted-foreground">هذا المكان ليس له أدمن — يمكنك ترقية أحد المستخدمين أدناه</p>
                          </div>
                        )}

                        {/* Admin cards */}
                        {placeAdmins.map(admin => (
                          <div key={admin.id} className="relative overflow-hidden rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(79,70,229,0.25))', color: '#ddd6fe' }}>
                                {admin.name.charAt(0).toUpperCase()}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-white">{admin.name}</span>
                                  <span className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-wide"
                                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(79,70,229,0.3))', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                                    👑 ADMIN
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="text-xs font-mono text-muted-foreground">
                                    {admin.password ? (revealedPassUserId === admin.id ? admin.password : '••••••') : 'بدون باسورد'}
                                  </p>
                                  {admin.password && (
                                    <button type="button" onClick={() => setRevealedPassUserId(v => v === admin.id ? null : admin.id)}
                                      className="text-muted-foreground hover:text-violet-400 transition-colors">
                                      {revealedPassUserId === admin.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Set password */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button onClick={() => openSetPassword(admin)}
                                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                                      style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                                      <Key className="h-3 w-3" />باسورد
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="border-border bg-card">
                                    <DialogHeader>
                                      <DialogTitle className="text-foreground">تعيين باسورد لـ {admin.name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="relative">
                                        <Input type={showNewPass ? 'text' : 'password'} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="الباسورد الجديد..." className="border-border bg-muted text-foreground pr-10" />
                                        <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                          {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                      </div>
                                      <div className="relative">
                                        <Input type={showNewPass ? 'text' : 'password'} value={confirmUserPassword} onChange={e => setConfirmUserPassword(e.target.value)} placeholder="تأكيد الباسورد..." className="border-border bg-muted text-foreground pr-10" />
                                        <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                          {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                      </div>
                                      {passwordError && <p className="text-center text-sm text-destructive">{passwordError}</p>}
                                      <Button className="w-full" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }} onClick={handleSetPassword}>حفظ الباسورد</Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {/* Revoke admin */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                                      style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                                      <Minus className="h-3 w-3" />سحب
                                    </button>
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
                                      }}>سحب</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                {/* Delete */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:scale-105 hover:bg-red-500/15 active:scale-95"
                                      style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
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
                          </div>
                        ))}

                        {/* Promote users section */}
                        {placeNonAdmins.length > 0 && (
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                              <UserPlus className="h-3 w-3" /> ترقية مستخدم إلى أدمن
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {placeNonAdmins.slice(0, 12).map(u => (
                                <AlertDialog key={u.id}>
                                  <AlertDialogTrigger asChild>
                                    <button className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
                                      style={{ background: 'rgba(124,58,237,0.08)', color: '#a5b4fc', border: '1px solid rgba(124,58,237,0.18)' }}>
                                      <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                                        style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}>
                                        {u.name.charAt(0).toUpperCase()}
                                      </span>
                                      {u.name}
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
                                          toast.success(`تم ترقية ${u.name} لأدمن ✓`)
                                          onRefreshUsers?.()
                                        } catch { toast.error('فشل الترقية') }
                                      }}>ترقية</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ))}
                              {placeNonAdmins.length > 12 && (
                                <span className="flex items-center rounded-xl px-2.5 py-1.5 text-[11px] text-muted-foreground" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  +{placeNonAdmins.length - 12} آخرين
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
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

          {/* ── Place Admin: Inbox from Dev Admin ── */}
          {!isDevAdmin && (
            <div className="space-y-3">
              {/* Header */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📬</span>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">رسائل الإدارة</h3>
                      <p className="text-xs text-muted-foreground">الرسائل الواردة من مطور النظام</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchPlaceMessages}
                    disabled={isFetchingPlaceMessages}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
                    <RefreshCw className={`h-3 w-3 ${isFetchingPlaceMessages ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>
              </div>

              {/* Messages list */}
              {isFetchingPlaceMessages ? (
                <div className="text-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-400" />
                  <p className="text-xs text-muted-foreground">جاري تحميل الرسائل...</p>
                </div>
              ) : placeMessages.length === 0 ? (
                <div className="text-center py-14 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)' }}>
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="text-sm font-medium text-foreground">لا توجد رسائل بعد</p>
                  <p className="text-xs text-muted-foreground mt-1">ستظهر هنا الرسائل القادمة من مطور النظام</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {placeMessages.map(msg => (
                    <div key={msg.id} className="rounded-2xl p-3.5" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                            📣
                          </div>
                          <div className="min-w-0 flex-1">
                            {msg.title && (
                              <p className="text-sm font-bold text-white mb-1">{msg.title}</p>
                            )}
                            <p className="text-sm text-foreground/90 leading-relaxed">{msg.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              {new Date(msg.created_at).toLocaleString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setIsDeletingPlaceMsg(msg.id)
                            try {
                              await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_one', id: msg.id }) })
                              setPlaceMessages(prev => prev.filter(m => m.id !== msg.id))
                            } catch {} finally { setIsDeletingPlaceMsg(null) }
                          }}
                          disabled={isDeletingPlaceMsg === msg.id}
                          className="flex-shrink-0 text-muted-foreground hover:text-red-400 transition-colors text-xs mt-0.5">
                          {isDeletingPlaceMsg === msg.id ? '...' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Clear all */}
              {placeMessages.length > 0 && (
                <button
                  onClick={async () => {
                    setIsDeletingMessages(true)
                    try {
                      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_all', place_id: placeId }) })
                      setPlaceMessages([])
                    } catch {} finally { setIsDeletingMessages(false) }
                  }}
                  disabled={isDeletingMessages}
                  className="w-full rounded-xl py-2.5 text-xs font-medium transition-all"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  {isDeletingMessages ? 'جاري الحذف...' : `🗑️ مسح كل الرسائل (${placeMessages.length})`}
                </button>
              )}
            </div>
          )}

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
                <h3 className="font-semibold text-foreground">إدارة الكابتن</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">ابعت الرابط ده للكابتن عشان يدخل على صفحته مباشرةً</p>
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
                <p className="text-sm font-semibold text-foreground">إضافة كابتن جديد</p>
                <p className="text-[11px] text-muted-foreground">وصول لصفحة الكابتن وتتبع الطلبات</p>
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
              {waiterAdded && <div className="rounded-lg p-2.5 text-center text-xs font-medium" style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.25)', color: '#D4A017' }}>✓ تم إضافة الكابتن بنجاح</div>}
              {waiterError && <div className="rounded-lg p-2.5 text-center text-xs font-medium" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}>⚠ {waiterError}</div>}
              <button onClick={handleAddWaiter} disabled={isAddingWaiter || !newWaiterUsername.trim() || !newWaiterPassword.trim() || !newWaiterName.trim() || (isDevAdmin && !newWaiterPlaceId)}
                className="w-full h-9 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800' }}>
                {isAddingWaiter ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isAddingWaiter ? 'جاري الإضافة...' : 'إضافة كابتن'}
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
              <h3 className="font-semibold text-foreground">الكابتن الحاليين</h3>
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
                            <AlertDialogTitle className="text-foreground">حذف الكابتن</AlertDialogTitle>
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
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: 'rgba(212,160,23,0.15)', color: '#D4A017' }}>🛎️ كابتن</span>
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
                )) : <p className="text-center text-muted-foreground">لا يوجد كابتن بعد</p>
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

          {/* ── Maintenance Mode (place admin only) ── */}
          {!isDevAdmin && placeId && (
            <div className="rounded-2xl p-4 space-y-3" style={{
              background: isMaintenanceMode ? 'rgba(212,160,23,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isMaintenanceMode ? 'rgba(212,160,23,0.35)' : 'rgba(255,255,255,0.08)'}`
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: isMaintenanceMode ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMaintenanceMode ? 'rgba(212,160,23,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                    <Wrench className="h-4 w-4" style={{ color: isMaintenanceMode ? '#D4A017' : 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {isMaintenanceMode ? '🔧 وضع الصيانة مفعّل' : '🔧 وضع الصيانة'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isMaintenanceMode ? 'الزبائن يرون شاشة الصيانة' : 'اعرض شاشة صيانة للزبائن مؤقتاً'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setIsSavingMaintenance(true)
                    const next = !isMaintenanceMode
                    try {
                      await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `maintenance_${placeId}`, value: next.toString() })
                      })
                      setIsMaintenanceMode(next)
                      toast.success(next ? '🔧 تم تفعيل وضع الصيانة' : '✅ تم إيقاف وضع الصيانة')
                    } catch { toast.error('خطأ في تغيير وضع الصيانة') }
                    finally { setIsSavingMaintenance(false) }
                  }}
                  disabled={isSavingMaintenance}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none`}
                  style={{ background: isMaintenanceMode ? '#D4A017' : 'rgba(255,255,255,0.1)' }}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${isMaintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {isMaintenanceMode && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-muted-foreground">رسالة الصيانة (تظهر للزبون)</Label>
                  <Input
                    value={maintenanceMsg}
                    onChange={e => setMaintenanceMsg(e.target.value)}
                    className="border-border bg-muted text-foreground text-sm"
                    placeholder="مثال: نقوم بتحديث النظام، سنعود قريباً"
                  />
                  <Button size="sm" variant="outline" className="w-full"
                    style={{ borderColor: 'rgba(212,160,23,0.3)', color: '#D4A017' }}
                    onClick={async () => {
                      await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `maintenance_message_${placeId}`, value: maintenanceMsg })
                      })
                      toast.success('تم حفظ رسالة الصيانة')
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
            <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.06) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 0% 100%, rgba(139,92,246,0.04) 0%, transparent 50%)' }} />
              <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Key className="h-4 w-4" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">كلمة سر الأرشيف</h3>
                  <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>للوصول للبيانات المؤرشفة</p>
                </div>
              </div>
              <div className="relative space-y-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>كلمة السر الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showArchivePassword ? 'text' : 'password'}
                      value={archivePassword}
                      onChange={e => { setArchivePassword(e.target.value); setArchivePasswordError(''); setArchivePasswordSuccess('') }}
                      placeholder="أدخل كلمة سر الأرشيف"
                      className="h-10 text-sm rounded-xl text-white placeholder:text-white/25 pr-10"
                      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
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
                  <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>تأكيد كلمة السر</Label>
                  <Input
                    type={showArchivePassword ? 'text' : 'password'}
                    value={archivePasswordConfirm}
                    onChange={e => { setArchivePasswordConfirm(e.target.value); setArchivePasswordError(''); setArchivePasswordSuccess('') }}
                    placeholder="أعد كتابة كلمة السر"
                    className="h-10 text-sm rounded-xl text-white placeholder:text-white/25"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                  />
                </div>
                {archivePasswordError && (
                  <p className="text-sm text-destructive">{archivePasswordError}</p>
                )}
                {archivePasswordSuccess && (
                  <p className="text-sm text-green-500">{archivePasswordSuccess}</p>
                )}
                <Button
                  className="w-full h-11 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}
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
          <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.06) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 100%, rgba(139,92,246,0.04) 0%, transparent 50%)' }} />
            <div className="relative p-5">
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <Clock className="h-4 w-4" style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">ساعات العمل</h3>
                <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>حدد أوقات فتح وإغلاق المكان</p>
              </div>
            </div>

            {/* Dev admin: place selector */}
            {isDevAdmin && (
              <div className="mb-4">
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>اختر المكان</Label>
                <select
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
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
            <button
              type="button"
              className="mt-3 w-full h-11 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}
              onClick={handleSaveWorkingHours}
              disabled={isSavingHours || isLoadingHours}
            >
              {isSavingHours
                ? <><div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري الحفظ...</>
                : <><Clock className="ml-2 h-4 w-4" /> حفظ ساعات العمل</>
              }
            </button>
            </div>
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
                        const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR طاولات ${currentPlace.name}</title><style>body{font-family:Arial,sans-serif;background:#fff;padding:20px}h1{text-align:center;margin-bottom:30px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px}.card{border:2px solid #ddd;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}.card h2{font-size:18px;margin:0 0 12px}.card img{width:150px;height:150px}@media print{.no-print{display:none}}</style></head><body><h1>${currentPlace.name} — QR الطاولات</h1><div class="grid">${sorted.map(u => `<div class="card"><h2>طاولة ${u.table_number}</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?place=' + currentPlace.code + '&table=' + u.table_number)}" /></div>`).join('')}</div></body></html>`
                        printHTML(html)
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

        {/* ─── Branding Tab (super_developer only) ─── */}
        <TabsContent value="branding" className="space-y-4">
          {/* Header */}
          <div className="relative rounded-2xl overflow-hidden p-4" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(99,102,241,0.08) 100%)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(168,85,247,0.08) 0%, transparent 60%)' }} />
            <div className="relative flex items-center gap-3">
              <span className="text-2xl">🎨</span>
              <div>
                <h2 className="font-black text-white text-sm tracking-wide">Branding Studio</h2>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(216,180,254,0.55)' }}>تخصيص هوية التطبيق — لوجو، أيقونات، اسم</p>
              </div>
            </div>
          </div>

          {/* Card 1 — System Logo */}
          <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.07) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(139,92,246,0.18)', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 0% 100%, rgba(139,92,246,0.05) 0%, transparent 50%)' }} />
            <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.22)' }}>
                <Upload className="h-4 w-4" style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">لوجو النظام</h3>
                <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>تغيير اللوجو في كل أجزاء التطبيق فوراً</p>
              </div>
            </div>
            <div className="relative space-y-3">
              <div className="flex items-center gap-4">
                <div className="shrink-0 h-20 w-20 rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center text-2xl" style={{ borderColor: (systemLogoInputUrl || externalSystemLogoUrl) ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.04)' }}>
                  {(systemLogoInputUrl || externalSystemLogoUrl) ? (
                    <img src={systemLogoInputUrl || externalSystemLogoUrl} alt="معاينة اللوجو" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <span style={{ color: 'rgba(139,92,246,0.4)' }}>🖼️</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={systemLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSystemLogoUpload} />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 text-xs rounded-xl"
                    style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa', background: 'rgba(139,92,246,0.06)' }}
                    disabled={systemLogoUploading}
                    onClick={() => systemLogoInputRef.current?.click()}
                  >
                    {systemLogoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Upload className="h-3.5 w-3.5 ml-1" />}
                    {systemLogoUploading ? 'جاري الرفع...' : 'رفع صورة'}
                  </Button>
                  <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>أو</p>
                  <Input
                    placeholder="رابط الصورة (URL)"
                    value={systemLogoInputUrl}
                    onChange={e => setSystemLogoInputUrl(e.target.value)}
                    className="h-9 text-xs rounded-xl text-white placeholder:text-white/25"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-10 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}
                  disabled={systemLogoUploading || !systemLogoInputUrl.trim()}
                  onClick={handleSystemLogoSave}
                >
                  حفظ اللوجو
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl text-xs"
                  style={{ borderColor: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.7)' }}
                  onClick={handleSystemLogoReset}
                >
                  إعادة الافتراضي
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2 — App Name */}
          <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(168,85,247,0.07) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(168,85,247,0.18)', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(168,85,247,0.05) 0%, transparent 50%)' }} />
            <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(168,85,247,0.12)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl text-lg" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(139,92,246,0.15))', border: '1px solid rgba(168,85,247,0.22)' }}>
                ✏️
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">اسم التطبيق</h3>
                <p className="text-[10px]" style={{ color: 'rgba(216,180,254,0.55)' }}>يظهر في الرأس والصفحة الرئيسية فوراً</p>
              </div>
            </div>
            <div className="relative space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)' }}>
                <span className="text-xs font-medium" style={{ color: 'rgba(216,180,254,0.5)' }}>معاينة:</span>
                <span className="text-base font-black text-white tracking-tight">{localAppName || 'SîpFlõw'}</span>
              </div>
              <Input
                placeholder="مثال: CaféPro أو مطعم النيل"
                value={localAppName}
                onChange={e => setLocalAppName(e.target.value)}
                className="h-10 text-sm rounded-xl text-white placeholder:text-white/25"
                style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-10 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', boxShadow: '0 4px 15px rgba(168,85,247,0.3)' }}
                  disabled={isSavingAppName || !localAppName.trim()}
                  onClick={handleSaveAppName}
                >
                  {isSavingAppName ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                  حفظ الاسم
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl text-xs"
                  style={{ borderColor: 'rgba(168,85,247,0.2)', color: 'rgba(216,180,254,0.7)' }}
                  disabled={isSavingAppName}
                  onClick={handleResetAppName}
                >
                  إعادة الافتراضي
                </Button>
              </div>
            </div>
          </div>

          {/* Card 3 — Button Icons */}
          <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(99,102,241,0.07) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(99,102,241,0.18)', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 0% 100%, rgba(99,102,241,0.05) 0%, transparent 50%)' }} />
            <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl text-lg" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.22)' }}>
                🔳
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">أيقونات الزراير</h3>
                <p className="text-[10px]" style={{ color: 'rgba(165,180,252,0.55)' }}>تخصيص أيقونات زراير الأدوار في الصفحة الرئيسية</p>
              </div>
            </div>
            <div className="relative space-y-4">
              {BUTTON_ICON_DEFS.map(({ key, label, options }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(165,180,252,0.8)' }}>{label}</span>
                    <span className="text-xl leading-none">{localButtonIcons[key]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setLocalButtonIcons(prev => ({ ...prev, [key]: emoji }))}
                        className="h-9 w-9 rounded-xl text-lg transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                        style={{
                          background: localButtonIcons[key] === emoji ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
                          border: localButtonIcons[key] === emoji ? '1.5px solid rgba(99,102,241,0.7)' : '1px solid rgba(255,255,255,0.07)',
                          boxShadow: localButtonIcons[key] === emoji ? '0 0 10px rgba(99,102,241,0.35)' : 'none',
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 h-10 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
                  disabled={isSavingButtonIcons}
                  onClick={handleSaveButtonIcons}
                >
                  {isSavingButtonIcons ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                  حفظ الأيقونات
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl text-xs"
                  style={{ borderColor: 'rgba(99,102,241,0.2)', color: 'rgba(165,180,252,0.7)' }}
                  disabled={isSavingButtonIcons}
                  onClick={handleResetButtonIcons}
                >
                  إعادة الافتراضي
                </Button>
              </div>
            </div>
          </div>

          {/* Card 4 — Theme Colors (project-wide) */}
          <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(34,197,94,0.06) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(34,197,94,0.18)', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
            <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.15))', border: '1px solid rgba(34,197,94,0.22)' }}>
                <Palette className="h-4 w-4" style={{ color: '#86efac' }} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">ألوان النظام</h3>
                <p className="text-[10px]" style={{ color: 'rgba(134,239,172,0.6)' }}>تخصيص ألوان المشروع كله — يطبّق فوراً على كل الصفحات</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {THEME_VAR_KEYS.map(k => (
                <div key={k} className="space-y-1.5 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/85">{THEME_LABELS_AR[k] || k}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(134,239,172,0.7)' }}>{(draftThemeColors[k] || '').toString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(draftThemeColors[k] as string) || (DEFAULT_THEME_COLORS[k] as string) || '#000000'}
                      onChange={e => setDraftThemeColors(prev => ({ ...prev, [k]: e.target.value }))}
                      className="h-9 w-12 rounded-lg cursor-pointer bg-transparent border border-white/10"
                    />
                    <Input
                      value={(draftThemeColors[k] as string) || ''}
                      onChange={e => setDraftThemeColors(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder={DEFAULT_THEME_COLORS[k] as string}
                      className="h-9 text-xs font-mono rounded-lg text-white placeholder:text-white/25"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-10 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #16a34a, #059669)', color: '#fff', boxShadow: '0 4px 15px rgba(22,163,74,0.3)' }}
                disabled={isSavingTheme}
                onClick={saveThemeColors}
              >
                {isSavingTheme ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                حفظ الألوان للمشروع
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl text-xs"
                style={{ borderColor: 'rgba(34,197,94,0.25)', color: 'rgba(134,239,172,0.85)' }}
                disabled={isSavingTheme}
                onClick={resetThemeColors}
              >
                إعادة الافتراضي
              </Button>
            </div>
          </div>

          {/* Card 5 — Tab Labels & Order */}
          <div className="relative rounded-2xl overflow-hidden p-5 space-y-4" style={{ background: 'linear-gradient(170deg, rgba(251,146,60,0.06) 0%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(251,146,60,0.18)', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
            <div className="relative flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(251,146,60,0.12)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl text-lg" style={{ background: 'linear-gradient(135deg, rgba(251,146,60,0.22), rgba(245,158,11,0.15))', border: '1px solid rgba(251,146,60,0.22)' }}>
                🏷️
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">أسماء وترتيب أزرار لوحة الإدارة</h3>
                <p className="text-[10px]" style={{ color: 'rgba(253,186,116,0.6)' }}>عدّل أسماء الأزرار وغيّر ترتيبها داخل كل مجموعة</p>
              </div>
            </div>
            <div className="space-y-4">
              {Object.keys(DEFAULT_TAB_ORDER).map(group => {
                const list = draftTabOrder[group] || DEFAULT_TAB_ORDER[group]
                return (
                  <div key={group} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.12)' }}>
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-[11px] font-black tracking-widest" style={{ color: '#fb923c' }}>
                        {TAB_GROUP_LABELS_AR[group]}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(251,146,60,0.15)' }} />
                    </div>
                    {list.map((tabKey, idx) => (
                      <div key={tabKey} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveTabInGroup(group, idx, -1)}
                            className="h-5 w-5 rounded flex items-center justify-center disabled:opacity-30"
                            style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === list.length - 1}
                            onClick={() => moveTabInGroup(group, idx, 1)}
                            className="h-5 w-5 rounded flex items-center justify-center disabled:opacity-30"
                            style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[10px] font-mono shrink-0 w-16 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{tabKey}</span>
                        <Input
                          value={draftTabLabels[tabKey] ?? DEFAULT_TAB_LABELS[tabKey] ?? ''}
                          onChange={e => setDraftTabLabels(prev => ({ ...prev, [tabKey]: e.target.value }))}
                          placeholder={DEFAULT_TAB_LABELS[tabKey]}
                          className="h-8 text-xs rounded-lg text-white placeholder:text-white/25"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-10 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#fff', boxShadow: '0 4px 15px rgba(234,88,12,0.3)' }}
                disabled={isSavingTabConfig}
                onClick={saveTabConfig}
              >
                {isSavingTabConfig ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                حفظ الأسماء والترتيب
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl text-xs"
                style={{ borderColor: 'rgba(251,146,60,0.25)', color: 'rgba(253,186,116,0.85)' }}
                disabled={isSavingTabConfig}
                onClick={resetTabConfig}
              >
                إعادة الافتراضي
              </Button>
            </div>
          </div>
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
                    <p className="text-[10px] text-muted-foreground">الإير��د المتوقع</p>
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

          <div className="relative rounded-2xl overflow-hidden p-5" style={{ background: 'linear-gradient(170deg, rgba(239,68,68,0.06) 0%, rgba(15,15,20,0.98) 100%)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(239,68,68,0.04) 0%, transparent 50%)' }} />
            <div className="relative">
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <RefreshCw className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-red-300 text-sm">بدء SîpFlõw جديدة</h3>
                <p className="text-[10px] text-red-400/50">الطلبات السابقة محفوظة في الأرشيف</p>
              </div>
            </div>

            {/* Dev admin: must pick a place first */}
            {isDevAdmin && (
              <div className="mb-4">
                <Label className="text-xs font-medium mb-1.5 block text-red-300/70">اختر المكان أولاً</Label>
                <select
                  value={resetPlaceId}
                  onChange={e => setResetPlaceId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
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
          </div>
        </TabsContent>

        {/* ─── Notes Tab (Dev Admin only) ─── */}
        {isDevAdmin && (
          <TabsContent value="notes" className="space-y-4">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.04))', border: '1px solid rgba(245,158,11,0.18)' }}>
              <div className="flex items-start gap-3 p-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <FileText className="h-5 w-5" style={{ color: '#fbbf24' }} />
                </div>
                <div>
                  <p className="text-sm font-bold mb-0.5" style={{ color: '#fbbf24' }}>مذكرة المطور</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    مساحة خاصة لتسجيل الملاحظات الداخلية، التذكيرات، والمهام العالقة. تُحفظ في قاعدة البيانات وتظهر فقط للأدمن المطور.
                  </p>
                </div>
              </div>
            </div>

            {/* Notepad */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.5)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>ملاحظاتي الخاصة</span>
                </div>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{devNote.length} حرف</span>
              </div>
              <div className="p-3">
                <textarea
                  value={devNote}
                  onChange={e => { setDevNote(e.target.value); setNoteSavedMsg('') }}
                  placeholder={'اكتب ملاحظاتك هنا...\n\nمثال:\n• تذكير: تجديد اشتراك SipFlow في 15 مايو\n• مشكلة: مكان X بيواجه تأخر في الطلبات\n• فكرة: إضافة تقرير أسبوعي للأماكن'}
                  rows={12}
                  dir="rtl"
                  className="w-full resize-none bg-transparent text-sm outline-none leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.8)', caretColor: '#fbbf24', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setIsSavingNote(true)
                  setNoteSavedMsg('')
                  try {
                    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'dev_notes', value: devNote }) })
                    setNoteSavedMsg('✅ تم الحفظ')
                    setTimeout(() => setNoteSavedMsg(''), 3000)
                  } catch { setNoteSavedMsg('❌ فشل الحفظ') }
                  finally { setIsSavingNote(false) }
                }}
                disabled={isSavingNote}
                className="flex-1 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#d97706,#92400e)', color: '#fff', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }}>
                {isSavingNote ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSavingNote ? 'جاري الحفظ...' : 'حفظ الملاحظات'}
              </button>
              {devNote && (
                <button
                  onClick={() => { setDevNote(''); setNoteSavedMsg('') }}
                  className="h-10 px-4 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                  مسح
                </button>
              )}
              {noteSavedMsg && (
                <span className="text-sm font-medium" style={{ color: noteSavedMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{noteSavedMsg}</span>
              )}
            </div>
          </TabsContent>
        )}

        {/* ─── Count (Delivered Items) Tab ─── */}
        <TabsContent value="count" className="space-y-4">

          {/* ── Section header with explanation ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.04))', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div className="flex items-start gap-3 p-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold mb-1" style={{ color: '#34d399' }}>الحصر اليومي للأصناف المسلّمة</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  يعرض تقرير شامل بكل الأصناف (المشروبات والأكل) التي تم تحضيرها أو تسليمها فعلياً خلال اليوم الحالي — مرتّبة حسب الأكثر مبيعاً مع نسبة كل صنف. يُستخدم لمتابعة الإنتاج ومطابقة الحسابات مع المخزون.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {[
                    { icon: '📊', text: 'ترتيب بالأكثر مبيعاً' },
                    { icon: '🖨️', text: 'قابل للطباعة' },
                    { icon: '🔄', text: 'يتجدد تلقائياً' },
                  ].map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <span>{f.icon}</span>{f.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dev admin: place selector */}
          {isDevAdmin && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)', background: 'rgba(139,92,246,0.05)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>📍</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>اختر المكان</span>
              </div>
              <div className="p-3">
                <select
                  value={countPlaceId}
                  onChange={e => { setCountPlaceId(e.target.value); fetchCountForPlace(e.target.value) }}
                  className="w-full h-10 rounded-xl px-3 text-sm text-white outline-none"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
                >
                  <option value="">— اختر مكان لعرض حصره —</option>
                  {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {isDevAdmin && !countPlaceId && (
            <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>اختر مكاناً لعرض الحصر اليومي</p>
            </div>
          )}

          {isDevAdmin && countPlaceId && isFetchingCount && (
            <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>جاري تحميل الحصر...</p>
            </div>
          )}

          {(!isDevAdmin || (countPlaceId && !isFetchingCount)) && (() => {
            const ordersToUse = isDevAdmin ? countOrders : orders
            const completedOrders = ordersToUse.filter(o => o.status === 'ready' || o.status === 'completed')
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
              printHTML(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>حصر</title></head><body><pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre></body></html>`)
            }

            return (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: totalDelivered, label: 'إجمالي المسلّم', icon: '📦', color: '#34d399', rgb: '52,211,153' },
                    { value: deliveredList.length, label: 'أنواع مختلفة', icon: '🍹', color: '#a78bfa', rgb: '167,139,250' },
                    { value: completedOrders.length, label: 'طلب منجز', icon: '✅', color: '#60a5fa', rgb: '96,165,250' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-2xl p-3 text-center" style={{ background: `rgba(${s.rgb},0.07)`, border: `1px solid rgba(${s.rgb},0.2)` }}>
                      <p className="text-xl mb-0.5">{s.icon}</p>
                      <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Date + print */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{todayDate}</p>
                  <button
                    onClick={handlePrintCount}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                    <Download className="h-3.5 w-3.5" />
                    طباعة الحصر
                  </button>
                </div>

                {deliveredList.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                    <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>لا توجد أصناف مسلّمة بعد</p>
                    <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>الحصر يظهر بعد تسليم أول طلب</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* List header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <span className="col-span-1 text-[9px] font-bold uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>#</span>
                      <span className="col-span-6 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>الصنف</span>
                      <span className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>الكمية</span>
                      <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>النسبة</span>
                    </div>
                    {deliveredList.map((item, idx) => {
                      const maxCount = deliveredList[0].count
                      const pct = Math.round((item.count / maxCount) * 100)
                      const totalPct = totalDelivered > 0 ? Math.round((item.count / totalDelivered) * 100) : 0
                      const isTop = idx === 0
                      const barColor = idx === 0 ? '#34d399' : idx === 1 ? '#60a5fa' : idx === 2 ? '#a78bfa' : '#6b7280'
                      return (
                        <div key={item.drinkName}
                          className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center transition-colors"
                          style={{ borderBottom: idx < deliveredList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isTop ? 'rgba(52,211,153,0.04)' : 'transparent' }}>
                          {/* Rank */}
                          <div className="col-span-1 flex justify-center">
                            {isTop
                              ? <span className="text-base leading-none">🥇</span>
                              : idx === 1 ? <span className="text-base leading-none">🥈</span>
                              : idx === 2 ? <span className="text-base leading-none">🥉</span>
                              : <span className="text-[10px] font-bold text-center w-full" style={{ color: 'rgba(255,255,255,0.2)' }}>{idx + 1}</span>
                            }
                          </div>
                          {/* Name + bar */}
                          <div className="col-span-6">
                            <p className="text-xs font-semibold mb-1 truncate" style={{ color: isTop ? '#34d399' : 'rgba(255,255,255,0.75)' }}>{item.drinkName}</p>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                            </div>
                          </div>
                          {/* Count */}
                          <div className="col-span-3 text-center">
                            <span className="text-sm font-black" style={{ color: barColor }}>× {item.count}</span>
                          </div>
                          {/* Percentage */}
                          <div className="col-span-2 text-center">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: `rgba(255,255,255,0.05)`, color: 'rgba(255,255,255,0.4)' }}>{totalPct}%</span>
                          </div>
                        </div>
                      )
                    })}
                    {/* Footer total */}
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>الإجمالي</span>
                      <span className="text-sm font-black" style={{ color: '#34d399' }}>× {totalDelivered}</span>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </TabsContent>

        {/* ─── Places Tab (Dev Admin only) ─── */}
        {isDevAdmin && (
          <TabsContent value="places" className="space-y-4">

            {/* ── Add + Clone grid ── */}
            <div className="grid grid-cols-1 gap-3">

              {/* Add new place */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.06))', borderBottom: '1px solid rgba(251,191,36,0.12)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>＋</div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#fbbf24' }}>إضافة مكان جديد</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>اسم المكان = الكود اللي يكتبه العميل</p>
                  </div>
                </div>
                {/* Body */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <Label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>اسم المكان</Label>
                      <Input value={newPlaceName} onChange={e => setNewPlaceName(e.target.value)}
                        placeholder="مثال: كافيه النيل"
                        className="h-9 text-sm border-0 text-foreground"
                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} />
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>وصف <span style={{ color: 'rgba(255,255,255,0.25)' }}>(اختياري)</span></Label>
                      <Input value={newPlaceDesc} onChange={e => setNewPlaceDesc(e.target.value)}
                        placeholder="وصف المكان..."
                        className="h-9 text-sm border-0 text-foreground"
                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} />
                    </div>
                  </div>
                  {/* Type selector */}
                  <div>
                    <Label className="text-[10px] font-semibold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>نوع المكان</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewPlaceType('cafe')}
                        className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all"
                        style={newPlaceType === 'cafe'
                          ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                        ☕ كافيه / مطعم
                      </button>
                      <button
                        onClick={() => setNewPlaceType('company')}
                        className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all"
                        style={newPlaceType === 'company'
                          ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                        🏢 شركة
                      </button>
                    </div>
                  </div>
                  {newPlaceType === 'company' && (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(96,165,250,0.8)' }}>الشركات لها موظفون بإيميل وباسورد — يُخصم إجمالي مشاريبهم من مرتباتهم شهرياً</p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number" min={0}
                          value={newPlaceFreeCount}
                          onChange={e => setNewPlaceFreeCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8 w-20 text-center border-0 text-sm font-bold"
                          style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderRadius: '8px' }}
                        />
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>مشروب مجاني/يوم — بعدها بسعره</span>
                      </div>
                    </div>
                  )}
                  {placesError && (
                    <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{placesError}</p>
                  )}
                  <button
                    onClick={handleAddPlace} disabled={isAddingPlace}
                    className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#d97706,#92400e)', color: '#fff', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }}>
                    {isAddingPlace ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {isAddingPlace ? 'جاري الإضافة...' : 'إضافة المكان'}
                  </button>
                </div>
              </div>

              {/* Clone Place */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(139,92,246,0.06))', borderBottom: '1px solid rgba(168,85,247,0.15)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>🪄</div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#c084fc' }}>نسخ مكان</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ينسخ المنيو والإعدادات لمكان جديد</p>
                  </div>
                </div>
                {/* Body */}
                <div className="p-4 space-y-2.5">
                  <div>
                    <Label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>المكان المصدر</Label>
                    <select
                      value={cloneSourceId}
                      onChange={e => {
                        setCloneSourceId(e.target.value)
                        const src = places.find(p => p.id === e.target.value)
                        if (src && !cloneNewName) setCloneNewName(`${src.name} (نسخة)`)
                        if (src && !cloneNewCode) setCloneNewCode(`${src.code}-copy`)
                      }}
                      className="w-full h-9 rounded-xl px-3 text-sm text-foreground border-0 outline-none"
                      style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
                    >
                      <option value="">— اختر المكان المصدر —</option>
                      {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>الاسم الجديد</Label>
                      <Input value={cloneNewName} onChange={e => setCloneNewName(e.target.value)}
                        placeholder="اسم المكان الجديد"
                        className="h-9 text-sm border-0 text-foreground"
                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} />
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>الكود الجديد</Label>
                      <Input value={cloneNewCode} onChange={e => setCloneNewCode(e.target.value)}
                        placeholder="كود-الزبون"
                        className="h-9 text-sm border-0 text-foreground"
                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} />
                    </div>
                  </div>
                  <button
                    onClick={handleClonePlace} disabled={isCloningPlace}
                    className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-1"
                    style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#c084fc', boxShadow: '0 4px 14px rgba(168,85,247,0.15)' }}>
                    {isCloningPlace ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>🪄</span>}
                    {isCloningPlace ? 'جاري النسخ...' : 'نسخ المكان'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Places list ── */}
            <div className="space-y-2.5">
              {/* List header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>الأماكن المسجّلة</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>{places.length}</span>
              </div>

              {places.length === 0 ? (
                <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-4xl mb-2">🏪</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>لا توجد أماكن بعد</p>
                </div>
              ) : places.map(place => (
                <div key={place.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: place.is_active ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(239,68,68,0.15)' }}>

                  {/* ── Info row ── */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Logo */}
                    <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {place.logo_url
                        ? <img src={place.logo_url} alt="شعار" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <span style={{ color: 'rgba(255,255,255,0.2)' }}>🏪</span>
                      }
                    </div>
                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-foreground leading-tight">{place.name}</span>
                        {place.code !== place.name && (
                          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{place.code}</span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${place.is_active ? '' : ''}`}
                          style={place.is_active
                            ? { background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }
                            : { background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>
                          {place.is_active ? '● مفعّل' : '● موقوف'}
                        </span>
                        {place.place_type === 'company' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd' }}>🏢 شركة</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <UserCog className="h-3 w-3 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                        {placeAdmins[place.id]
                          ? <span className="text-[11px] font-semibold" style={{ color: '#fbbf24' }}>{placeAdmins[place.id]!.name}</span>
                          : <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>لا يوجد أدمن</span>
                        }
                        {place.description && <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.2)' }}>· {place.description}</span>}
                      </div>
                    </div>
                    {/* Right quick actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => handleTogglePlace(place.id, place.is_active)}
                        className="h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all"
                        style={place.is_active
                          ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }
                          : { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                        {place.is_active ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => handleToggleOrderTracking(place.id, !orderTrackingMap[place.id])}
                        disabled={isSavingTracking}
                        className="h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all"
                        style={orderTrackingMap[place.id] !== false
                          ? { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                        📍 {orderTrackingMap[place.id] !== false ? 'تتبع' : 'موقوف'}
                      </button>
                    </div>
                  </div>

                  {/* ── Action buttons row ── */}
                  <div className="flex items-center gap-1.5 flex-wrap px-3 pb-3">
                    {/* Logo */}
                    <button
                      onClick={() => {
                        if (logoEditingPlace === place.id) { setLogoEditingPlace(null); setLogoUrlInput(''); setLogoError(''); return }
                        setLogoEditingPlace(place.id)
                        setLogoUrlInput(place.logo_url || '')
                        setLogoError('')
                        setAssigningForPlace(null)
                      }}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all"
                      style={logoEditingPlace === place.id
                        ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      🖼️ شعار
                    </button>
                    {/* Assign/edit admin */}
                    <button
                      onClick={() => {
                        if (assigningForPlace === place.id) { setAssigningForPlace(null); return }
                        setAssigningForPlace(place.id)
                        setAdminError('')
                        setAdminPassword('')
                        setAdminName(placeAdmins[place.id]?.name || '')
                        setLogoEditingPlace(null)
                      }}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                      style={assigningForPlace === place.id
                        ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#a78bfa' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      <UserCog className="h-3 w-3" />
                      {placeAdmins[place.id] ? 'تعديل الأدمن' : 'تعيين أدمن'}
                    </button>
                    {/* Delete admin */}
                    {placeAdmins[place.id] && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                            <Trash2 className="h-3 w-3" /> حذف الأدمن
                          </button>
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
                    {/* Company employees */}
                    {place.place_type === 'company' && (
                      <button
                        onClick={() => {
                          if (companyEmpPlace === place.id) { setCompanyEmpPlace(null); setCompanyEmployees([]); return }
                          setCompanyEmpPlace(place.id)
                          setReportsPlace(null)
                          setFreeDrinkEditingPlace(null)
                          fetchCompanyEmployees(place.id)
                        }}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                        style={companyEmpPlace === place.id
                          ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                        <Users className="h-3 w-3" /> الموظفون
                      </button>
                    )}
                    {/* Free drink */}
                    {place.place_type === 'company' && (
                      <button
                        onClick={() => {
                          if (freeDrinkEditingPlace === place.id) { setFreeDrinkEditingPlace(null); return }
                          setFreeDrinkEditingPlace(place.id)
                          setCompanyEmpPlace(null)
                          setReportsPlace(null)
                        }}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all"
                        style={freeDrinkEditingPlace === place.id
                          ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                        🎁 مجاني
                      </button>
                    )}
                    {/* Reports */}
                    {place.place_type === 'company' && (
                      <button
                        onClick={() => {
                          if (reportsPlace === place.id) { setReportsPlace(null); setEmployeeReports([]); return }
                          setReportsPlace(place.id)
                          setCompanyEmpPlace(null)
                          fetchEmployeeReports(place.id, reportsMonth)
                        }}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                        style={reportsPlace === place.id
                          ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                        <BarChart3 className="h-3 w-3" /> تقارير
                      </button>
                    )}
                    {/* Spacer + delete */}
                    <div className="flex-1" />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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

                  {/* Free Drink Panel */}
                  {freeDrinkEditingPlace === place.id && (() => {
                    const placeDrinks = drinks.filter(d => d.place_id === place.id)
                    const currentFreeDrink = placeDrinks.find(d => d.id === place.free_drink_id)
                    return (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                          🎁 إعدادات المشروب المجاني — {place.name}
                        </p>
                        {placeDrinks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">لا توجد مشاريب مضافة لهذا المكان بعد</p>
                        ) : (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">اختر المشروب المجاني</Label>
                              <select
                                defaultValue={place.free_drink_id || ''}
                                id={`free-drink-select-${place.id}`}
                                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                              >
                                <option value="">— بدون مشروب مجاني —</option>
                                {placeDrinks.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({Number(d.price).toFixed(2)} ج.م)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">عدد مرات المجانية لكل موظف يومياً</Label>
                              <Input
                                type="number"
                                min={0}
                                id={`free-drink-count-${place.id}`}
                                defaultValue={place.free_drinks_count || 0}
                                className="h-9 w-24 text-center border-border bg-muted text-foreground"
                              />
                            </div>
                            {currentFreeDrink && (
                              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                                المشروب المجاني الحالي: <span className="font-bold">{currentFreeDrink.name}</span>
                                {(place.free_drinks_count || 0) > 0 && <span className="mr-2">× {place.free_drinks_count} مرة يومياً</span>}
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="w-full bg-amber-500 hover:bg-amber-600 text-black"
                              disabled={isSavingFreeDrink}
                              onClick={() => {
                                const sel = (document.getElementById(`free-drink-select-${place.id}`) as HTMLSelectElement)?.value || null
                                const cnt = parseInt((document.getElementById(`free-drink-count-${place.id}`) as HTMLInputElement)?.value || '0') || 0
                                handleSetFreeDrink(place.id, sel || null, cnt)
                              }}
                            >
                              {isSavingFreeDrink ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                            </Button>
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Assign / Edit admin inline form */}
                  {/* Company Employees Panel */}
                  {companyEmpPlace === place.id && (
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
                      <p className="text-xs font-semibold text-blue-400 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" /> موظفو {place.name}
                      </p>
                      {/* Add employee form */}
                      <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2">
                        <p className="text-[11px] text-blue-300/70 font-medium">➕ إضافة موظف جديد</p>

                        {/* Avatar upload */}
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-xl shrink-0">
                            {newEmpAvatarUrl
                              ? <img src={newEmpAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                              : <span>👤</span>}
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">صورة الموظف</Label>
                            <div className="flex gap-1.5 mt-1">
                              <label className="flex-1 h-8 px-2 rounded-md border border-border bg-muted hover:bg-muted/70 cursor-pointer text-xs text-foreground flex items-center justify-center gap-1">
                                {isUploadingEmpAvatar ? 'جاري الرفع...' : '📷 رفع صورة'}
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadEmpAvatar(f); e.target.value = '' }}
                                  disabled={isUploadingEmpAvatar} />
                              </label>
                              {newEmpAvatarUrl && (
                                <button type="button" onClick={() => setNewEmpAvatarUrl('')}
                                  className="h-8 px-2 rounded-md border border-destructive/30 text-destructive text-xs hover:bg-destructive/10">
                                  حذف
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">الاسم</Label>
                            <Input value={newEmpName} onChange={e => setNewEmpName(e.target.value)}
                              placeholder="اسم الموظف" className="mt-1 h-9 border-border bg-muted text-foreground text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">الإيميل</Label>
                            <Input value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)}
                              placeholder="email@company.com" className="mt-1 h-9 border-border bg-muted text-foreground text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">الإدارة / القسم</Label>
                            <Input value={newEmpDepartment} onChange={e => setNewEmpDepartment(e.target.value)}
                              placeholder="مثال: الموارد البشرية" className="mt-1 h-9 border-border bg-muted text-foreground text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">المسمى الوظيفي</Label>
                            <Input value={newEmpTitle} onChange={e => setNewEmpTitle(e.target.value)}
                              placeholder="مثال: محاسب" className="mt-1 h-9 border-border bg-muted text-foreground text-sm" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">كلمة المرور</Label>
                          <div className="relative mt-1">
                            <Input type={showEmpPass ? 'text' : 'password'} value={newEmpPassword} onChange={e => setNewEmpPassword(e.target.value)}
                              placeholder="••••••••" className="h-9 border-border bg-muted text-foreground text-sm pr-8" />
                            <button type="button" onClick={() => setShowEmpPass(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showEmpPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        {empError && <p className="text-xs text-destructive">{empError}</p>}
                        <Button size="sm" className="w-full" onClick={handleAddEmployee} disabled={isAddingEmp}>
                          <Plus className="h-3.5 w-3.5 ml-1" />
                          {isAddingEmp ? 'جاري الإضافة...' : 'إضافة الموظف'}
                        </Button>
                      </div>
                      {/* Employees list */}
                      {isFetchingEmployees ? (
                        <p className="text-xs text-muted-foreground text-center py-2">جاري التحميل...</p>
                      ) : companyEmployees.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">لا يوجد موظفون بعد</p>
                      ) : (
                        <div className="space-y-1.5">
                          {companyEmployees.map((emp: any) => (
                            <div key={emp.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5">
                              <div className="h-9 w-9 rounded-full overflow-hidden border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-sm shrink-0">
                                {emp.avatar_url
                                  ? <img src={emp.avatar_url} alt={emp.name} className="h-full w-full object-cover" />
                                  : <span>👤</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{emp.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{emp.email}</p>
                                {(emp.department || emp.title) && (
                                  <p className="text-[10px] text-blue-400/80 truncate">
                                    {[emp.title, emp.department].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${emp.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {emp.is_active ? 'مفعّل' : 'موقوف'}
                              </span>
                              <button onClick={() => handleToggleEmployee(emp.id, emp.is_active)}
                                className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground transition-colors">
                                {emp.is_active ? 'إيقاف' : 'تفعيل'}
                              </button>
                              <button onClick={() => handleDeleteEmployee(emp.id)}
                                className="text-destructive hover:bg-destructive/10 rounded p-1 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Employee Reports Panel */}
                  {reportsPlace === place.id && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-green-400 flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5" /> تقارير موظفي {place.name}
                        </p>
                        <button onClick={() => fetchEmployeeReports(place.id, reportsMonth, reportsMode === 'day' ? reportsDate : undefined)}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Mode toggle */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setReportsMode('month'); fetchEmployeeReports(place.id, reportsMonth) }}
                          className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-colors ${reportsMode === 'month' ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-border bg-muted text-muted-foreground'}`}
                        >
                          📅 شهري
                        </button>
                        <button
                          onClick={() => { setReportsMode('day'); fetchEmployeeReports(place.id, reportsMonth, reportsDate) }}
                          className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-colors ${reportsMode === 'day' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-border bg-muted text-muted-foreground'}`}
                        >
                          🗓️ يومي
                        </button>
                      </div>
                      {/* Date/Month picker */}
                      {reportsMode === 'month' ? (
                        <input
                          type="month"
                          value={reportsMonth}
                          onChange={e => { setReportsMonth(e.target.value); fetchEmployeeReports(place.id, e.target.value) }}
                          className="w-full rounded border border-border bg-muted text-foreground text-xs px-2 py-1.5"
                        />
                      ) : (
                        <input
                          type="date"
                          value={reportsDate}
                          onChange={e => { setReportsDate(e.target.value); fetchEmployeeReports(place.id, reportsMonth, e.target.value) }}
                          className="w-full rounded border border-border bg-muted text-foreground text-xs px-2 py-1.5"
                        />
                      )}
                      {isFetchingReports ? (
                        <p className="text-xs text-muted-foreground text-center py-4">جاري التحميل...</p>
                      ) : employeeReports.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">لا توجد تقارير لهذه الفترة</p>
                      ) : (
                        <div className="space-y-2">
                          {employeeReports.map((rep: any) => (
                            <div key={rep.employee_id} className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
                              <button
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors text-right"
                                onClick={() => setExpandedEmployee(expandedEmployee === rep.employee_id ? null : rep.employee_id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground">{rep.employee_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{rep.employee_email}</p>
                                </div>
                                <div className="text-left shrink-0">
                                  <p className="text-xs font-bold text-green-400">{Number(rep.total_amount).toFixed(2)} ج.م</p>
                                  <p className="text-[10px] text-muted-foreground">{rep.total_drinks} مشروب</p>
                                </div>
                                <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expandedEmployee === rep.employee_id ? '-rotate-90' : ''}`} />
                              </button>
                              {expandedEmployee === rep.employee_id && rep.drinks_breakdown.length > 0 && (
                                <div className="border-t border-border/30 px-3 py-2 space-y-1">
                                  <p className="text-[10px] text-muted-foreground font-medium mb-1.5">تفاصيل المشاريب:</p>
                                  {rep.drinks_breakdown.map((d: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                      <span className="text-foreground/80">{d.drink_name}</span>
                                      <span className="text-muted-foreground">× {d.quantity}</span>
                                      <span className="text-green-400 font-medium">{Number(d.total).toFixed(2)} ج.م</span>
                                    </div>
                                  ))}
                                  <div className="border-t border-border/30 mt-1.5 pt-1.5 flex justify-between text-xs font-bold">
                                    <span className="text-foreground">الإجمالي</span>
                                    <span className="text-green-400">{Number(rep.total_amount).toFixed(2)} ج.م</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Summary */}
                          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {reportsMode === 'day' ? `إجمالي ${reportsDate}` : 'إجمالي الشهر'} (كل الموظفين)
                            </span>
                            <span className="text-sm font-bold text-green-400">
                              {employeeReports.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
            <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.04) 50%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(139,92,246,0.1)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,0.06) 0%, transparent 50%)' }} />
              <div className="relative p-5 space-y-4">
                <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <UserPlus className="h-4 w-4" style={{ color: '#a78bfa' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">إضافة عميل جديد</h3>
                    <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>تسجيل مالك أو مشترك جديد في النظام</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: '#a78bfa' }}>الاسم <span className="text-red-400 text-[10px]">مطلوب</span></Label>
                    <Input value={newClientName} onChange={e => setNewClientName(e.target.value)}
                      placeholder="أحمد محمد" className="h-10 text-sm rounded-xl text-white placeholder:text-white/25" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>رقم التليفون</Label>
                      <Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                        placeholder="01012345678" className="h-10 text-sm rounded-xl text-white placeholder:text-white/25" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }} dir="ltr" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block" style={{ color: '#a78bfa' }}>اسم المكان</Label>
                      <Input value={newClientPlace} onChange={e => setNewClientPlace(e.target.value)}
                        placeholder="كافيه النيل" className="h-10 text-sm rounded-xl text-white placeholder:text-white/25" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-2 block" style={{ color: '#a78bfa' }}>نوع الاشتراك</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewClientSub('monthly')}
                        className="relative h-11 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={newClientSub === 'monthly' ? { background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.2))', border: '1.5px solid rgba(139,92,246,0.5)', color: '#c4b5fd', boxShadow: '0 0 15px rgba(139,92,246,0.15)' } : { background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', color: 'rgba(255,255,255,0.35)' }}
                      >
                        {newClientSub === 'monthly' && <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa' }} />}
                        🔄 شهري
                      </button>
                      <button
                        onClick={() => setNewClientSub('owned')}
                        className="relative h-11 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={newClientSub === 'owned' ? { background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.15))', border: '1.5px solid rgba(245,158,11,0.45)', color: '#fbbf24', boxShadow: '0 0 15px rgba(245,158,11,0.1)' } : { background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', color: 'rgba(255,255,255,0.35)' }}
                      >
                        {newClientSub === 'owned' && <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }} />}
                        🏆 اشترى البرنامج
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'rgba(167,139,250,0.5)' }}>ملاحظات <span className="text-[10px]">(اختياري)</span></Label>
                    <Input value={newClientNotes} onChange={e => setNewClientNotes(e.target.value)}
                      placeholder="أي ملاحظات إضافية..." className="h-10 text-sm rounded-xl text-white placeholder:text-white/20" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }} />
                  </div>
                </div>

                {clientsError && (
                  <div className="rounded-lg px-3 py-2 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{clientsError}</div>
                )}

                <button
                  onClick={handleAddClient}
                  disabled={isAddingClient}
                  className="w-full h-11 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', boxShadow: '0 4px 15px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                >
                  {isAddingClient ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isAddingClient ? 'جاري الإضافة...' : 'إضافة عميل'}
                </button>
              </div>
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

          {/* ─── Subscriptions Tab (dev admin only) ─── */}
          <TabsContent value="subscriptions" className="space-y-4">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(170deg, rgba(217,119,6,0.1) 0%, rgba(245,158,11,0.05) 50%, rgba(15,15,25,0.95) 100%)', border: '1px solid rgba(217,119,6,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(217,119,6,0.1)' }}>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 pb-4" style={{ borderBottom: '1px solid rgba(217,119,6,0.12)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(245,158,11,0.15))', border: '1px solid rgba(217,119,6,0.25)' }}>
                      <Award className="h-5 w-5" style={{ color: '#fbbf24' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">إدارة الباقات والاشتراكات</h3>
                      <p className="text-[10px]" style={{ color: 'rgba(251,191,36,0.6)' }}>تحديد الباقة ومميزاتها لكل مكان</p>
                    </div>
                  </div>
                  <button onClick={fetchSubscriptions} disabled={isFetchingSubs}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                    style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)', color: '#fbbf24' }}>
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingSubs ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>

                {/* Plans overview + edit toggle */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold" style={{ color: 'rgba(251,191,36,0.7)' }}>الباقات المتاحة</p>
                    <button
                      onClick={() => setShowPlanEditor(v => !v)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-medium transition-all"
                      style={showPlanEditor
                        ? { background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.45)', color: '#fbbf24' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                      <Pencil className="h-3 w-3" />
                      {showPlanEditor ? 'إخفاء المحرر' : 'تعديل الحدود'}
                    </button>
                  </div>

                  {/* Summary cards (always visible) */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'free',    emoji: '🎁', label: 'مجانية',   color: '#6b7280' },
                      { key: 'monthly', emoji: '📅', label: 'شهرية',    color: '#3b82f6' },
                      { key: 'yearly',  emoji: '📆', label: 'سنوية',    color: '#8b5cf6' },
                      { key: 'premium', emoji: '👑', label: 'بريميوم',  color: '#f59e0b' },
                    ].map(p => {
                      const e = planEdits[p.key]
                      const rgbMap: Record<string, string> = { '#6b7280': '107,114,128', '#3b82f6': '59,130,246', '#8b5cf6': '139,92,246', '#f59e0b': '245,158,11' }
                      const rgb = rgbMap[p.color]
                      return (
                        <div key={p.key} className="rounded-xl p-2.5 flex items-center gap-2"
                          style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.2)` }}>
                          <span className="text-base shrink-0">{p.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-[11px] font-bold" style={{ color: p.color }}>{p.label}</p>
                              {e && (
                                <p className="text-[10px] font-black shrink-0" style={{ color: p.color }}>
                                  {e.customPrice !== '' ? Number(e.customPrice) : calcSuggestedPrice(e).total} ج
                                  {e.customPrice !== '' && <span className="text-[8px] mr-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>✏️</span>}
                                </p>
                              )}
                            </div>
                            <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {e ? `${e.maxTables || '∞'} ط · ${e.maxStaff || '∞'} م · ${e.maxProducts || '∞'} منتج` : '...'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Editable plan configs */}
                  {showPlanEditor && (
                    <div className="rounded-2xl overflow-hidden mt-3" style={{ border: '1px solid rgba(217,119,6,0.2)', background: 'rgba(0,0,0,0.3)' }}>
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(217,119,6,0.12)', background: 'rgba(217,119,6,0.06)' }}>
                        <p className="text-xs font-bold text-amber-400">✏️ تعديل حدود الباقات</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>اترك الخانة فارغة = غير محدود</p>
                      </div>
                      <div className="p-4 space-y-5">
                        {[
                          { key: 'free',    emoji: '🎁', label: 'مجانية',   color: '#6b7280', rgb: '107,114,128' },
                          { key: 'monthly', emoji: '📅', label: 'شهرية',    color: '#3b82f6', rgb: '59,130,246' },
                          { key: 'yearly',  emoji: '📆', label: 'سنوية',    color: '#8b5cf6', rgb: '139,92,246' },
                          { key: 'premium', emoji: '👑', label: 'بريميوم',  color: '#f59e0b', rgb: '245,158,11' },
                        ].map(p => {
                          const e = planEdits[p.key] || {}
                          const setField = (field: string, val: any) =>
                            setPlanEdits(prev => ({ ...prev, [p.key]: { ...prev[p.key], [field]: val } }))
                          return (
                            <div key={p.key} className="space-y-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{p.emoji}</span>
                                <span className="text-xs font-bold" style={{ color: p.color }}>{p.label}</span>
                                <div className="flex-1 h-px" style={{ background: `rgba(${p.rgb},0.15)` }} />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { field: 'maxTables',   label: 'طاولات' },
                                  { field: 'maxStaff',    label: 'موظفين' },
                                  { field: 'maxProducts', label: 'منتجات' },
                                ].map(f => (
                                  <div key={f.field}>
                                    <Label className="text-[10px] mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.label}</Label>
                                    <Input
                                      type="number" min="0"
                                      value={(e as any)[f.field] ?? ''}
                                      onChange={ev => setField(f.field, ev.target.value)}
                                      placeholder="∞"
                                      className="h-8 text-xs rounded-lg text-white text-center"
                                      style={{ background: `rgba(${p.rgb},0.06)`, border: `1px solid rgba(${p.rgb},0.2)` }}
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[10px] mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>مدة (يوم)</Label>
                                  <Input
                                    type="number" min="0"
                                    value={(e as any).durationDays ?? ''}
                                    onChange={ev => setField('durationDays', ev.target.value)}
                                    placeholder="دائم"
                                    className="h-8 text-xs rounded-lg text-white text-center"
                                    style={{ background: `rgba(${p.rgb},0.06)`, border: `1px solid rgba(${p.rgb},0.2)` }}
                                  />
                                </div>
                                <div className="flex flex-col justify-end gap-1.5">
                                  <button
                                    onClick={() => setField('reservationsEnabled', !(e as any).reservationsEnabled)}
                                    className="h-8 rounded-lg text-[10px] font-medium transition-all px-1"
                                    style={(e as any).reservationsEnabled
                                      ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#6ee7b7' }
                                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                                    {(e as any).reservationsEnabled ? '✓' : '✗'} حجوزات
                                  </button>
                                </div>
                                <div className="flex flex-col justify-end gap-1.5">
                                  <button
                                    onClick={() => setField('reportsEnabled', !(e as any).reportsEnabled)}
                                    className="h-8 rounded-lg text-[10px] font-medium transition-all px-1"
                                    style={(e as any).reportsEnabled
                                      ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#6ee7b7' }
                                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                                    {(e as any).reportsEnabled ? '✓' : '✗'} تقارير
                                  </button>
                                </div>
                              </div>

                              {/* Pricing estimate */}
                              {(() => {
                                const pricing = calcSuggestedPrice(e as PlanConfigEdit)
                                const hasDuration = !!(e as any).durationDays
                                return (
                                  <div className="rounded-xl p-3 mt-1" style={{ background: `rgba(${p.rgb},0.06)`, border: `1px solid rgba(${p.rgb},0.18)` }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-bold" style={{ color: `rgba(255,255,255,0.5)` }}>💰 التسعير المقترح</span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                                        {hasDuration ? `كل ${(e as any).durationDays} يوم` : 'شهرياً'}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                                      {pricing.breakdown.map((item, i) => (
                                        <div key={i} className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                                          <span className="text-[9px] font-bold" style={{ color: p.color }}>+{item.amount} ج</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex items-end justify-between mb-2.5">
                                      <div>
                                        {hasDuration && pricing.total !== pricing.monthly && (
                                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                            {pricing.monthly} ج/شهر × {Math.round(parseInt((e as any).durationDays) / 30 * 10) / 10}
                                          </p>
                                        )}
                                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>السعر الكلي للفترة</p>
                                      </div>
                                      <div className="text-left">
                                        <p className="text-lg font-black leading-none" style={{ color: p.color }}>{pricing.total}</p>
                                        <p className="text-[9px] font-bold" style={{ color: `rgba(${p.rgb},0.7)` }}>جنيه</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                      <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>✏️ تعديل السعر</span>
                                      <Input
                                        type="number" min="0"
                                        value={(e as any).customPrice ?? ''}
                                        onChange={ev => setField('customPrice', ev.target.value)}
                                        placeholder={String(pricing.total)}
                                        className="h-7 text-xs rounded-lg text-center flex-1"
                                        style={{ background: `rgba(${p.rgb},0.08)`, border: `1px solid rgba(${p.rgb},0.3)`, color: p.color }}
                                      />
                                      <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>ج</span>
                                      {(e as any).customPrice !== '' && (
                                        <button
                                          onClick={() => setField('customPrice', '')}
                                          className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0"
                                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                                          إعادة
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })}

                        {planSaveMsg && (
                          <p className="text-center text-sm font-medium" style={{ color: planSaveMsg.startsWith('✅') ? '#6ee7b7' : '#fca5a5' }}>{planSaveMsg}</p>
                        )}

                        <button
                          onClick={handleSavePlans}
                          disabled={isSavingPlans}
                          className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                          style={{ background: 'linear-gradient(135deg, #d97706, #92400e)', color: '#fff', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}>
                          {isSavingPlans ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {isSavingPlans ? 'جاري الحفظ...' : 'حفظ إعدادات الباقات'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'الكل' },
                { key: 'expiring', label: '⚠️ تنتهي قريباً' },
                { key: 'expired', label: '🔴 منتهية' },
              ].map(f => (
                <button key={f.key} onClick={() => setSubFilter(f.key as any)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={subFilter === f.key
                    ? { background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.5)', color: '#fbbf24' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                  {f.label}
                  {f.key === 'expiring' && subPlaces.filter(p => p.expiring_soon && !p.is_expired).length > 0 && (
                    <span className="mr-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-[8px] font-black text-black">{subPlaces.filter(p => p.expiring_soon && !p.is_expired).length}</span>
                  )}
                  {f.key === 'expired' && subPlaces.filter(p => p.is_expired).length > 0 && (
                    <span className="mr-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-[8px] font-black text-white">{subPlaces.filter(p => p.is_expired).length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Places list */}
            {isFetchingSubs ? (
              <div className="text-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                <p className="text-sm text-muted-foreground">جاري التحميل...</p>
              </div>
            ) : subPlaces.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-4xl mb-3">🏪</p>
                <p>لا توجد أماكن مسجّلة بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subPlaces
                  .filter(p => {
                    if (subFilter === 'expiring') return p.expiring_soon && !p.is_expired
                    if (subFilter === 'expired') return p.is_expired
                    return true
                  })
                  .map(p => {
                    const isEditing = editSubId === p.id
                    const planColors: Record<string, string> = { free: '#6b7280', monthly: '#3b82f6', yearly: '#8b5cf6', premium: '#f59e0b' }
                    const planColor = planColors[p.subscription_plan] || '#6b7280'

                    return (
                      <div key={p.id} className="rounded-2xl overflow-hidden" style={{ border: p.is_expired ? '1px solid rgba(239,68,68,0.35)' : p.expiring_soon ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.07)', background: p.is_expired ? 'rgba(239,68,68,0.04)' : p.expiring_soon ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)' }}>
                        {/* Place header row */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-base"
                              style={{ background: `rgba(${planColor === '#6b7280' ? '107,114,128' : planColor === '#3b82f6' ? '59,130,246' : planColor === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.15)`, border: `1px solid rgba(${planColor === '#6b7280' ? '107,114,128' : planColor === '#3b82f6' ? '59,130,246' : planColor === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.3)` }}>
                              {p.plan_config?.emoji || '🏪'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0" style={{ background: `rgba(${planColor === '#6b7280' ? '107,114,128' : planColor === '#3b82f6' ? '59,130,246' : planColor === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.15)`, color: planColor, border: `1px solid rgba(${planColor === '#6b7280' ? '107,114,128' : planColor === '#3b82f6' ? '59,130,246' : planColor === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.3)` }}>
                                  {p.plan_config?.label || p.subscription_plan}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {p.subscription_expires_at ? (
                                  p.is_expired ? (
                                    <span className="text-[10px] text-red-400 font-medium">🔴 انتهى الاشتراك</span>
                                  ) : (
                                    <span className={`text-[10px] font-medium ${p.expiring_soon ? 'text-amber-400' : 'text-white/40'}`}>
                                      {p.expiring_soon ? '⚠️' : '⏰'} ينتهي خلال {p.days_left} يوم · {new Date(p.subscription_expires_at).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                  )
                                ) : p.subscription_plan === 'free' ? (
                                  <span className="text-[10px] text-white/30">باقة مجانية · بدون انتهاء</span>
                                ) : (
                                  <span className="text-[10px] text-white/30">♾️ دائمة</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {p.owner_name && (
                                  <span className="text-[10px] text-white/45">👤 {p.owner_name}</span>
                                )}
                                {p.owner_phone && (
                                  <span className="text-[10px] text-white/45" dir="ltr">📞 {p.owner_phone}</span>
                                )}
                                {p.subscription_amount != null && Number(p.subscription_amount) > 0 && (
                                  <span className="text-[10px] text-emerald-300 font-medium">
                                    💰 {Number(p.subscription_amount).toLocaleString('ar-EG')} ج.م
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (isEditing) { setEditSubId(null) }
                              else {
                                setEditSubId(p.id)
                                setEditSubPlan(p.subscription_plan)
                                const exp = p.subscription_expires_at ? new Date(p.subscription_expires_at).toISOString().split('T')[0] : ''
                                setEditSubExpiry(exp)
                                setEditSubOwnerName(p.owner_name || '')
                                setEditSubOwnerPhone(p.owner_phone || '')
                                setEditSubAmount(p.subscription_amount == null ? '' : String(p.subscription_amount))
                              }
                            }}
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                            style={isEditing
                              ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
                              : { background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#fbbf24' }}>
                            {isEditing ? 'إلغاء' : <><Pencil className="inline h-3 w-3 ml-1" />تعديل</>}
                          </button>
                        </div>

                        {/* Features row */}
                        <div className="flex items-center gap-3 px-4 pb-3 flex-wrap">
                          {[
                            { label: `${p.plan_config?.maxTables ?? '∞'} طاولة`, ok: true },
                            { label: `${p.plan_config?.maxStaff ?? '∞'} موظف`, ok: true },
                            { label: `${p.plan_config?.maxProducts ?? '∞'} منتج`, ok: true },
                            { label: 'حجوزات', ok: p.plan_config?.reservationsEnabled },
                            { label: 'تقارير', ok: p.plan_config?.reportsEnabled },
                          ].map((feat, fi) => (
                            <span key={fi} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: feat.ok ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)', color: feat.ok ? '#6ee7b7' : '#4b5563', border: `1px solid rgba(${feat.ok ? '16,185,129' : '107,114,128'},0.15)` }}>
                              {feat.ok ? '✓' : '✗'} {feat.label}
                            </span>
                          ))}
                        </div>

                        {/* Edit panel */}
                        {isEditing && (
                          <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(217,119,6,0.15)' }}>
                            <p className="text-[11px] font-semibold text-amber-400 pt-3">تعديل الباقة</p>

                            {/* Plan selector */}
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { plan: 'free',    emoji: '🎁', label: 'مجانية',   color: '#6b7280' },
                                { plan: 'monthly', emoji: '📅', label: 'شهرية',    color: '#3b82f6' },
                                { plan: 'yearly',  emoji: '📆', label: 'سنوية',    color: '#8b5cf6' },
                                { plan: 'premium', emoji: '👑', label: 'بريميوم',  color: '#f59e0b' },
                              ].map(opt => (
                                <button key={opt.plan} onClick={() => setEditSubPlan(opt.plan)}
                                  className="h-10 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2"
                                  style={editSubPlan === opt.plan
                                    ? { background: `rgba(${opt.color === '#6b7280' ? '107,114,128' : opt.color === '#3b82f6' ? '59,130,246' : opt.color === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.2)`, border: `1.5px solid rgba(${opt.color === '#6b7280' ? '107,114,128' : opt.color === '#3b82f6' ? '59,130,246' : opt.color === '#8b5cf6' ? '139,92,246' : '245,158,11'},0.6)`, color: opt.color }
                                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                                  {opt.emoji} {opt.label}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                  اسم مالك المكان
                                </Label>
                                <Input
                                  value={editSubOwnerName}
                                  onChange={e => setEditSubOwnerName(e.target.value)}
                                  placeholder="مثال: أحمد محمد"
                                  className="h-9 text-sm rounded-xl text-white"
                                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}
                                />
                              </div>
                              <div>
                                <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                  رقم تليفون المالك
                                </Label>
                                <Input
                                  value={editSubOwnerPhone}
                                  onChange={e => setEditSubOwnerPhone(e.target.value)}
                                  placeholder="01000000000"
                                  dir="ltr"
                                  className="h-9 text-sm rounded-xl text-white"
                                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}
                                />
                              </div>
                              <div>
                                <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                  قيمة الاشتراك بالجنيه
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editSubAmount}
                                  onChange={e => setEditSubAmount(e.target.value)}
                                  placeholder="مثال: 500"
                                  className="h-9 text-sm rounded-xl text-white"
                                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}
                                />
                              </div>
                            </div>

                            {/* Expiry date */}
                            {editSubPlan !== 'free' && editSubPlan !== 'premium' && (
                              <div>
                                <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                  تاريخ الانتهاء <span className="text-white/30 font-normal">(اتركه فارغ للحساب التلقائي)</span>
                                </Label>
                                <Input type="date" value={editSubExpiry} onChange={e => setEditSubExpiry(e.target.value)}
                                  className="h-9 text-sm rounded-xl text-white"
                                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }} />
                              </div>
                            )}

                            {/* Save */}
                            <button
                              onClick={() => handleSaveSubscription(p.id)}
                              disabled={isSavingSub}
                              className="w-full h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}>
                              {isSavingSub ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {isSavingSub ? 'جاري الحفظ...' : 'حفظ الباقة'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                {subPlaces.filter(p => {
                  if (subFilter === 'expiring') return p.expiring_soon && !p.is_expired
                  if (subFilter === 'expired') return p.is_expired
                  return true
                }).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-3xl mb-2">{subFilter === 'expiring' ? '✅' : '✅'}</p>
                    <p className="text-sm">لا توجد نتائج لهذا الفلتر</p>
                  </div>
                )}
              </div>
            )}
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
                      setFeeDiscountCode(p.discount_code ?? '')
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
              <div>
                <Label className="text-xs text-muted-foreground">كود الخصم (مطلوب لتفعيل أي خصم)</Label>
                <Input
                  value={feeDiscountCode}
                  onChange={e => setFeeDiscountCode(e.target.value)}
                  placeholder="مثال: DISC2024 — اتركه فارغاً لإلغاء الكود"
                  className="mt-1 border-border bg-muted text-foreground font-mono tracking-widest"
                />
                <p className="text-xs text-muted-foreground mt-1">لو محدد، الكاشير لازم يدخل الكود الصح عشان يعمل أي خصم على الطاولة</p>
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

        {/* ─── Order Simulator Tab ─────────────────────────── */}
        <TabsContent value="simulator" className="space-y-4">
          <OrderSimulator places={places} />
        </TabsContent>

        {/* ─── Place Templates Tab ─────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          <PlaceTemplates places={places} />
        </TabsContent>

        {/* ─── Feature Flags Tab ─────────────────────────── */}
        <TabsContent value="feature-flags" className="space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(6,182,212,0.04))', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(16,185,129,0.12)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🚩</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Feature Flags</h3>
                  <p className="text-[11px]" style={{ color: '#6ee7b7' }}>تحكم في تفعيل وتعطيل ميزات النظام فوراً بدون نشر كود جديد</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {!flagsLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#34d399' }} />
                </div>
              ) : (
                FLAG_DEFS.map(flag => (
                  <div key={flag.key} className="flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-200"
                    style={{ background: featureFlags[flag.key] ? `${flag.color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${featureFlags[flag.key] ? `${flag.color}30` : 'rgba(255,255,255,0.06)'}` }}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-white">{flag.label}</span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{flag.desc}</span>
                    </div>
                    <button
                      onClick={() => toggleFlag(flag.key)}
                      disabled={isSavingFlags}
                      className="relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 focus:outline-none"
                      style={{ background: featureFlags[flag.key] ? flag.color : 'rgba(255,255,255,0.1)', boxShadow: featureFlags[flag.key] ? `0 0 10px ${flag.color}60` : 'none' }}
                    >
                      <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 shadow"
                        style={{ transform: featureFlags[flag.key] ? 'translateX(20px)' : 'translateX(0px)' }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── AI Ideas Tab ─────────────────────────── */}
        <TabsContent value="ai-ideas" className="space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(251,191,36,0.03))', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(245,158,11,0.12)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <div>
                  <h3 className="text-sm font-bold text-white">مولّد الأفكار</h3>
                  <p className="text-[11px]" style={{ color: '#fcd34d' }}>اضغط الزر واحصل على فكرة جاهزة للتطبيق في المشروع</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <button
                onClick={generateIdea}
                disabled={isGeneratingIdea}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm transition-all duration-200 active:scale-95"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.15))', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', boxShadow: '0 0 20px rgba(245,158,11,0.1)' }}
              >
                {isGeneratingIdea ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التفكير...</>
                ) : (
                  <><BrainCircuit className="h-4 w-4" /> {currentIdea ? 'فكرة ثانية ←' : 'اقترح لي فكرة'}</>
                )}
              </button>

              {currentIdea && !isGeneratingIdea && (
                <div className="rounded-xl p-4 space-y-3 transition-all duration-300"
                  style={{ background: `${currentIdea.color}10`, border: `1px solid ${currentIdea.color}35` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{currentIdea.icon}</span>
                    <h4 className="text-base font-black text-white">{currentIdea.title}</h4>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{currentIdea.desc}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${currentIdea.color}20`, color: currentIdea.color, border: `1px solid ${currentIdea.color}40` }}>
                      📍 {currentIdea.tabLabel}
                    </span>
                    <button
                      onClick={() => setPendingIdea(currentIdea)}
                      disabled={isImplementingIdea || isIdeaImplemented(currentIdea.flagKey)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[12px] font-black transition-all duration-200 active:scale-95"
                      style={{ background: isImplementingIdea || isIdeaImplemented(currentIdea.flagKey) ? 'rgba(255,255,255,0.06)' : `${currentIdea.color}`, color: isImplementingIdea || isIdeaImplemented(currentIdea.flagKey) ? 'rgba(255,255,255,0.55)' : '#000', boxShadow: isImplementingIdea || isIdeaImplemented(currentIdea.flagKey) ? 'none' : `0 0 16px ${currentIdea.color}60` }}
                    >
                      {isImplementingIdea ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> جارٍ التنفيذ...</>
                      ) : isIdeaImplemented(currentIdea.flagKey) ? (
                        <><CheckCircle2 className="h-3 w-3" /> مطبقة بالفعل</>
                      ) : (
                        <><Wrench className="h-3 w-3" /> نفّذ الفكرة ←</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!currentIdea && !isGeneratingIdea && (
                <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <BrainCircuit className="h-10 w-10" />
                  <p className="text-sm">اضغط الزر لتوليد فكرة</p>
                </div>
              )}
            </div>
          </div>

          <Dialog open={!!pendingIdea} onOpenChange={(open) => { if (!open && !isImplementingIdea) setPendingIdea(null) }}>
            <DialogContent className="max-w-sm border-border bg-card text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-base">أين تريد تنفيذ الفكرة؟</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {pendingIdea ? `اختر نطاق تنفيذ "${pendingIdea.title}" حتى تظل محفوظة وتظهر في المكان الصحيح بعد إغلاق البرنامج.` : ''}
                </p>
                <button
                  onClick={() => pendingIdea && implementIdea(pendingIdea, 'developer_admin')}
                  disabled={isImplementingIdea}
                  className="w-full rounded-xl p-3 text-right transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  <div className="font-bold text-sm text-foreground">الأدمن المطور فقط</div>
                  <div className="text-[11px] text-muted-foreground mt-1">تظهر الميزة داخل لوحة الأدمن المطور فقط.</div>
                </button>
                <button
                  onClick={() => pendingIdea && implementIdea(pendingIdea, 'all_pages')}
                  disabled={isImplementingIdea}
                  className="w-full rounded-xl p-3 text-right transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}
                >
                  <div className="font-bold text-sm text-foreground">كل الصفحات المتاحة</div>
                  <div className="text-[11px] text-muted-foreground mt-1">تظهر في لوحة المطور وأي صفحة/لوحة مناسبة للفكرة.</div>
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Implemented Ideas Tab ─────────────────────────── */}
        <TabsContent value="implemented-ideas" className="space-y-4">
          {(() => {
            const activeIdeas = AI_IDEAS.filter(i => isIdeaImplemented(i.flagKey))
            if (activeIdeas.length === 0) {
              return (
                <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(236,72,153,0.03))', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <div className="text-4xl mb-2">✨</div>
                  <h3 className="text-sm font-bold text-white mb-1">لا توجد مزايا مُفعّلة</h3>
                  <p className="text-[11px]" style={{ color: '#fda4af' }}>اذهب إلى تبويب AI Ideas لتوليد فكرة جديدة وتنفيذها</p>
                </div>
              )
            }
            return (
              <>
                <div className="rounded-2xl p-3" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(236,72,153,0.03))', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white">المزايا المُفعّلة (Implemented Ideas)</h3>
                      <p className="text-[11px]" style={{ color: '#fda4af' }}>{activeIdeas.length} ميزة مُفعّلة — تظهر هنا فقط ولا تظهر في تبويباتها الأصلية</p>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}

          {isIdeaImplemented('idea_branch_ctrl') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(232,121,249,0.07)', border: '1px solid rgba(232,121,249,0.25)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🌐</span>
                <h3 className="font-bold text-sm text-foreground">مركز تحكم الفروع</h3>
                <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(232,121,249,0.15)', color: '#e879f9' }}>مباشر</span>
                {renderDeleteFeatureBtn('idea_branch_ctrl')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'فرع المعادي', orders: 12, rev: '1,840 ج', status: 'active' },
                  { name: 'فرع مدينة نصر', orders: 7, rev: '960 ج', status: 'active' },
                  { name: 'فرع التجمع', orders: 0, rev: '0 ج', status: 'closed' },
                ].map((branch, i) => (
                  <div key={i} className="rounded-xl p-3 text-center space-y-1" style={{ background: branch.status === 'active' ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${branch.status === 'active' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                    <div className="text-[10px] font-medium text-foreground truncate">{branch.name}</div>
                    <div className="text-lg font-bold" style={{ color: branch.status === 'active' ? '#34d399' : '#6b7280' }}>{branch.orders}</div>
                    <div className="text-[9px] text-muted-foreground">طلب نشط</div>
                    <div className="text-[10px] font-semibold" style={{ color: '#e879f9' }}>{branch.rev}</div>
                    <div className="text-[9px] px-1.5 py-0.5 rounded-full inline-block" style={{ background: branch.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(107,114,128,0.15)', color: branch.status === 'active' ? '#34d399' : '#6b7280' }}>
                      {branch.status === 'active' ? 'مفتوح' : 'مغلق'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: 'rgba(232,121,249,0.06)', border: '1px solid rgba(232,121,249,0.12)' }}>
                <span className="text-xs text-muted-foreground">إجمالي الإيرادات اليوم</span>
                <span className="text-sm font-bold" style={{ color: '#e879f9' }}>2,800 ج</span>
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_drink_custom') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(244,114,182,0.07)', border: '1px solid rgba(244,114,182,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎛️</span>
                <h3 className="font-bold text-sm text-foreground">تخصيص المشروب — خيارات الأصناف</h3>
                {renderDeleteFeatureBtn('idea_drink_custom')}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">مستوى السكر</p>
                  <div className="flex gap-2 flex-wrap">
                    {drinkCustomOptions.sugar.map(s => (
                      <span key={s} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', color: '#f472b6' }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">الثلج</p>
                  <div className="flex gap-2 flex-wrap">
                    {drinkCustomOptions.ice.map(s => (
                      <span key={s} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', color: '#f472b6' }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">إضافات</p>
                  <div className="flex gap-2 flex-wrap">
                    {drinkCustomOptions.extras.map(s => (
                      <span key={s} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', color: '#f472b6' }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">هذه الخيارات تظهر للزبون عند إضافة أي صنف للسلة. يمكن تعديلها لاحقاً لكل منتج على حدة.</p>
            </div>
          )}

          {isIdeaImplemented('idea_auto_hide') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <h3 className="font-bold text-sm text-foreground">إخفاء المنتج تلقائياً</h3>
                  {renderDeleteFeatureBtn('idea_auto_hide')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">مفعّل</span>
                  <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ background: '#f59e0b' }}>
                    <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">عندما يصل مخزون أي صنف إلى صفر، يختفي تلقائياً من قائمة الزبائن ويرجع لما يتجدد المخزون.</p>
              <div className="rounded-xl p-2.5 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <span className="text-[10px]" style={{ color: '#f59e0b' }}>⚠️ تنبيه مسبق: يُرسل تنبيه للأدمن لما الكمية تقل عن 5 وحدات</span>
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_staff_perf') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🏅</span>
                <h3 className="font-bold text-sm text-foreground">لوحة أداء الموظفين — هذا الشهر</h3>
                {renderDeleteFeatureBtn('idea_staff_perf')}
              </div>
              <div className="space-y-2">
                {staffPerfData.map((emp, i) => (
                  <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : '#b45309' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground">{emp.orders} طلب · متوسط {emp.avgTime} · ذروة {emp.peak}</div>
                    </div>
                    <div className="text-sm font-bold" style={{ color: '#fbbf24' }}>{emp.score}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_waitlist') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <h3 className="font-bold text-sm text-foreground">قائمة الانتظار الذكية</h3>
                <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>{waitlistEntries.length} انتظار</span>
                {renderDeleteFeatureBtn('idea_waitlist')}
              </div>
              <div className="space-y-1.5">
                {waitlistEntries.map((e, i) => (
                  <div key={e.id} className="rounded-xl p-2.5 flex items-center gap-2" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa' }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground">{e.name} · {e.people} أشخاص</div>
                      <div className="text-[10px] text-muted-foreground">{e.phone} · {e.time}</div>
                    </div>
                    <button onClick={() => setWaitlistEntries(prev => prev.filter(x => x.id !== e.id))} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>تم</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newWaitName} onChange={e => setNewWaitName(e.target.value)} placeholder="الاسم" className="flex-1 h-8 text-xs border-border bg-muted" />
                <Input value={newWaitPeople} onChange={e => setNewWaitPeople(e.target.value)} placeholder="عدد" className="w-14 h-8 text-xs border-border bg-muted" type="number" />
                <Button size="sm" className="h-8 text-xs px-3" style={{ background: '#60a5fa', color: '#000' }}
                  onClick={() => {
                    if (!newWaitName.trim()) return
                    setWaitlistEntries(prev => [...prev, { id: Date.now(), name: newWaitName, phone: newWaitPhone || '—', people: Number(newWaitPeople) || 1, time: 'الآن' }])
                    setNewWaitName(''); setNewWaitPhone(''); setNewWaitPeople('2')
                    toast.success('تم إضافة الزبون للانتظار')
                  }}>إضافة</Button>
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_loyalty') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <h3 className="font-bold text-sm text-foreground">بطاقة الولاء الرقمية</h3>
                {renderDeleteFeatureBtn('idea_loyalty')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">عدد الطلبات للمكافأة</Label>
                  <Input value={loyaltyThreshold} onChange={e => setLoyaltyThreshold(e.target.value)} type="number" className="mt-1 h-8 text-xs border-border bg-muted" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">المكافأة</Label>
                  <Input value={loyaltyReward} onChange={e => setLoyaltyReward(e.target.value)} className="mt-1 h-8 text-xs border-border bg-muted" />
                </div>
              </div>
              <Button size="sm" className="w-full h-8 text-xs" style={{ background: '#fb923c', color: '#000' }}
                onClick={() => { setLoyaltySaved(true); toast.success('تم حفظ إعدادات الولاء ✅') }}>
                {loyaltySaved ? '✅ محفوظ' : 'حفظ الإعدادات'}
              </Button>
            </div>
          )}

          {isIdeaImplemented('idea_voice_announce') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔊</span>
                  <h3 className="font-bold text-sm text-foreground">الإعلان الصوتي للطلب</h3>
                  {renderDeleteFeatureBtn('idea_voice_announce')}
                </div>
                <button onClick={() => setVoiceEnabled(v => !v)} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{voiceEnabled ? 'مفعّل' : 'معطّل'}</span>
                  <div className="w-10 h-5 rounded-full relative transition-colors" style={{ background: voiceEnabled ? '#6366f1' : 'rgba(255,255,255,0.1)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ right: voiceEnabled ? '2px' : 'calc(100% - 18px)' }} />
                  </div>
                </button>
              </div>
              {voiceEnabled && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">نص الإعلان (يُضاف له رقم الطاولة تلقائياً)</Label>
                  <Input value={voiceText} onChange={e => setVoiceText(e.target.value)} className="mt-1 h-8 text-xs border-border bg-muted" dir="rtl" />
                  <button onClick={() => { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(`${voiceText} 5`); u.lang = 'ar'; window.speechSynthesis.speak(u) } }} className="mt-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>▶ اختبر الصوت (طاولة 5)</button>
                </div>
              )}
            </div>
          )}

          {isIdeaImplemented('idea_table_map') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🗺️</span>
                <h3 className="font-bold text-sm text-foreground">خريطة الطاولات التفاعلية</h3>
                {renderDeleteFeatureBtn('idea_table_map')}
                <div className="mr-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#34d399' }} /> نشطة
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f87171' }} /> تنتظر الحساب
                  <span className="w-2 h-2 rounded-full inline-block bg-muted" /> فارغة
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(t => {
                  const status = tableStatuses[t] || 'free'
                  const colors = { active: { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)', text: '#34d399' }, waiting: { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', text: '#f87171' }, free: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: '#6b7280' } }
                  const c = colors[status]
                  return (
                    <button key={t} onClick={() => setTableStatuses(prev => ({ ...prev, [t]: prev[t] === 'free' ? 'active' : prev[t] === 'active' ? 'waiting' : 'free' }))}
                      className="rounded-xl py-3 text-center transition-all" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                      <div className="text-xs font-bold" style={{ color: c.text }}>{t}</div>
                      <div className="text-[9px] text-muted-foreground">{status === 'active' ? 'نشطة' : status === 'waiting' ? 'حساب' : 'فارغة'}</div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">اضغط على الطاولة لتغيير حالتها</p>
            </div>
          )}

          {isIdeaImplemented('idea_table_timer') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <h3 className="font-bold text-sm text-foreground">مؤقت الطاولات النشطة</h3>
                {renderDeleteFeatureBtn('idea_table_timer')}
              </div>
              <div className="space-y-2">
                {Object.entries(tableStartTimes).map(([tableNum, startMs]) => {
                  const mins = Math.floor((Date.now() - startMs) / 60000)
                  const isOver = mins > 60
                  return (
                    <div key={tableNum} className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: isOver ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isOver ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      <span className="text-xs text-foreground">طاولة {tableNum}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: isOver ? '#f87171' : '#34d399' }}>{mins} دقيقة</span>
                      {isOver && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>تجاوزت الحد</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_split_bill') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">💳</span>
                <h3 className="font-bold text-sm text-foreground">تقسيم الحساب</h3>
                {renderDeleteFeatureBtn('idea_split_bill')}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">إجمالي الفاتورة (جنيه)</Label>
                  <Input value={splitTotal} onChange={e => setSplitTotal(e.target.value)} type="number" className="mt-1 h-8 text-xs border-border bg-muted" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">عدد الأشخاص</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button onClick={() => setSplitCount(c => Math.max(2, c - 1))} className="w-8 h-8 rounded-lg text-foreground" style={{ background: 'rgba(255,255,255,0.08)' }}>-</button>
                    <span className="w-6 text-center text-sm font-bold text-foreground">{splitCount}</span>
                    <button onClick={() => setSplitCount(c => c + 1)} className="w-8 h-8 rounded-lg text-foreground" style={{ background: 'rgba(255,255,255,0.08)' }}>+</button>
                  </div>
                </div>
              </div>
              {splitTotal && Number(splitTotal) > 0 && (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div className="text-[10px] text-muted-foreground">نصيب كل شخص</div>
                  <div className="text-2xl font-bold" style={{ color: '#a78bfa' }}>{(Number(splitTotal) / splitCount).toFixed(2)} ج</div>
                </div>
              )}
            </div>
          )}

          {isIdeaImplemented('idea_order_rating') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h3 className="font-bold text-sm text-foreground">تقييمات الزبائن</h3>
                <span className="mr-auto text-xs font-bold" style={{ color: '#fbbf24' }}>⭐ 4.7 متوسط</span>
                {renderDeleteFeatureBtn('idea_order_rating')}
              </div>
              <div className="space-y-2">
                {ideaRatings.map((r, i) => (
                  <div key={i} className="rounded-xl p-2.5 flex items-start gap-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-foreground">{r.table}</span>
                        <span className="text-[10px]">{'⭐'.repeat(r.stars)}</span>
                      </div>
                      {r.comment && <div className="text-[10px] text-muted-foreground mt-0.5">"{r.comment}"</div>}
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">{r.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isIdeaImplemented('idea_pdf_reports') && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <h3 className="font-bold text-sm text-foreground">تقارير PDF يومية</h3>
                {renderDeleteFeatureBtn('idea_pdf_reports')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['اليوم', 'أمس', 'الأسبوع'].map(period => (
                  <button key={period} onClick={() => toast.success(`📄 جارٍ تصدير تقرير ${period}…`)}
                    className="rounded-xl p-3 text-center space-y-1 transition-all hover:opacity-90" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <Download className="h-4 w-4 mx-auto" style={{ color: '#34d399' }} />
                    <div className="text-[10px] font-medium text-foreground">{period}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">يشمل التقرير: المبيعات · أكثر المنتجات طلباً · صافي الإيراد</p>
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

                {/* Rating summary card */}
                {analyticsData.totalRatings != null && analyticsData.totalRatings > 0 && (
                  <div className="rounded-2xl border bg-card p-5 space-y-4" style={{ borderColor: 'rgba(212,160,23,0.2)' }}>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <span style={{ color: '#D4A017' }}>★</span>
                      تقييمات الزبائن
                    </h3>
                    <div className="flex items-center gap-6 flex-wrap">
                      {/* Average score */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-4xl font-black" style={{ color: '#D4A017' }}>
                          {analyticsData.avgRating?.toFixed(1) ?? '—'}
                        </span>
                        <div className="flex gap-0.5" dir="ltr">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className="text-lg" style={{ color: s <= Math.round(analyticsData.avgRating ?? 0) ? '#f59e0b' : '#3f3f46' }}>★</span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{analyticsData.totalRatings} تقييم</span>
                      </div>

                      {/* Distribution bars */}
                      <div className="flex-1 space-y-1.5 min-w-[160px]">
                        {[5,4,3,2,1].map(star => {
                          const entry = analyticsData.ratingDistribution?.find(r => r.star === star)
                          const cnt   = entry?.count ?? 0
                          const pct   = analyticsData.totalRatings! > 0 ? (cnt / analyticsData.totalRatings!) * 100 : 0
                          return (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4 text-left">{star}★</span>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: star >= 4 ? '#D4A017' : star === 3 ? '#f59e0b80' : 'rgba(239,68,68,0.6)'
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-6 text-left">{cnt}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

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
                            <div className="flex items-center gap-2">
                              {p.avgRating != null && (
                                <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                                  ★ {p.avgRating.toFixed(1)}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{p.totalRevenue.toFixed(0)} جنيه • {p.totalOrders} طلب</span>
                            </div>
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
                            <span className="text-xs text-muted-foreground">{d.qty} طل�� • {d.revenue.toFixed(0)} جنيه</span>
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

      {/* Remove Implemented Idea — global confirmation (works from any tab) */}
      <AlertDialog open={!!pendingRemoveIdea} onOpenChange={(open) => { if (!open && !removingIdeaKey) setPendingRemoveIdea(null) }}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-400" />
              حذف الميزة من المشروع؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoveIdea ? (
                <>
                  ستُحذف ميزة <span className="font-bold text-foreground">"{pendingRemoveIdea.title}"</span> ولن تظهر في أي صفحة من صفحات التطبيق.
                  <br />
                  <span className="text-[11px] text-muted-foreground">ملاحظة: البيانات المحفوظة في قاعدة البيانات لن تُحذف — فقط الميزة ستُخفى. يمكنك إعادة تفعيلها لاحقاً من مولّد الأفكار.</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingIdeaKey}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (pendingRemoveIdea) removeIdea(pendingRemoveIdea) }}
              disabled={!!removingIdeaKey}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {removingIdeaKey ? 'جارٍ الحذف...' : 'نعم، احذفها'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
