"use client"

import { useState, useEffect, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Plus, AlertTriangle, TrendingUp, Package, ClipboardList, Truck, FileText, Sparkles, RefreshCw, Edit2, Beaker } from 'lucide-react'
import { UNIT_OPTIONS, CATEGORY_OPTIONS, formatStock } from '@/lib/units'

interface Props { placeId: string | null; isDevAdmin?: boolean }

type Ingredient = {
  id: string; name_ar: string; category: string; unit: string;
  current_stock: number; min_threshold: number; reorder_point: number; reorder_quantity: number;
  cost_per_unit: number; supplier_id: string | null; expiry_date: string | null;
  place_id: string | null; is_active: boolean; supplier_name?: string | null; notes?: string | null
}

export default function InventorySystem({ placeId, isDevAdmin }: Props) {
  const [tab, setTab] = useState('dashboard')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [drinks, setDrinks] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    const qs = placeId ? `?place_id=${placeId}` : ''
    try {
      const [ing, sup, drk, dash] = await Promise.all([
        fetch(`/api/ingredients${qs}`).then(r => r.json()),
        fetch(`/api/suppliers${qs}`).then(r => r.json()),
        fetch(`/api/drinks${qs}`).then(r => r.json()),
        fetch(`/api/inventory-dashboard${qs}`).then(r => r.json()),
      ])
      setIngredients(Array.isArray(ing) ? ing : [])
      setSuppliers(Array.isArray(sup) ? sup : [])
      setDrinks(Array.isArray(drk) ? drk : [])
      setDashboard(dash || null)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { reload() }, [placeId])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Beaker className="h-5 w-5" /> نظام المخزون الذكي</h2>
          <p className="text-xs text-muted-foreground">مكونات • وصفات • حركات • موردين • أوامر شراء • تنبؤ ذكي</p>
        </div>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-1 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full h-auto gap-1">
          <TabsTrigger value="dashboard" className="text-xs">📊 لوحة</TabsTrigger>
          <TabsTrigger value="ingredients" className="text-xs">📦 المكونات</TabsTrigger>
          <TabsTrigger value="recipes" className="text-xs">🍳 الوصفات</TabsTrigger>
          <TabsTrigger value="movements" className="text-xs">📝 الحركات</TabsTrigger>
          <TabsTrigger value="ops" className="text-xs">⚡ عمليات</TabsTrigger>
          <TabsTrigger value="suppliers" className="text-xs">🚚 موردين</TabsTrigger>
          <TabsTrigger value="po" className="text-xs">🧾 شراء</TabsTrigger>
          <TabsTrigger value="smart" className="text-xs">✨ ذكي</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab dashboard={dashboard} ingredients={ingredients} /></TabsContent>
        <TabsContent value="ingredients"><IngredientsTab ingredients={ingredients} suppliers={suppliers} placeId={placeId} isDevAdmin={isDevAdmin} onChange={reload} /></TabsContent>
        <TabsContent value="recipes"><RecipesTab drinks={drinks} ingredients={ingredients} /></TabsContent>
        <TabsContent value="movements"><MovementsTab placeId={placeId} ingredients={ingredients} /></TabsContent>
        <TabsContent value="ops"><OpsTab ingredients={ingredients} placeId={placeId} onChange={reload} /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab suppliers={suppliers} placeId={placeId} onChange={reload} /></TabsContent>
        <TabsContent value="po"><PurchaseOrdersTab placeId={placeId} ingredients={ingredients} suppliers={suppliers} onChange={reload} /></TabsContent>
        <TabsContent value="smart"><SmartTab placeId={placeId} ingredients={ingredients} suppliers={suppliers} onChange={reload} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────
function DashboardTab({ dashboard, ingredients }: { dashboard: any; ingredients: Ingredient[] }) {
  if (!dashboard) return <div className="text-center py-8 text-sm text-muted-foreground">جاري التحميل...</div>
  const KPI = ({ label, value, color, icon }: any) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between"><div className="text-xs text-muted-foreground">{label}</div>{icon}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
    </CardContent></Card>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="قيمة المخزون" value={`${(dashboard.totalValue || 0).toFixed(2)} ج`} color="#10b981" icon={<TrendingUp className="h-4 w-4 text-green-500" />} />
        <KPI label="عدد المكونات" value={dashboard.ingredientCount || 0} color="#3b82f6" icon={<Package className="h-4 w-4 text-blue-500" />} />
        <KPI label="تحت الحد الأدنى" value={dashboard.lowStockCount || 0} color="#f59e0b" icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} />
        <KPI label="نفد تماماً" value={dashboard.outOfStockCount || 0} color="#ef4444" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KPI label="قارب على الانتهاء" value={dashboard.expiringSoonCount || 0} color="#a855f7" icon={<AlertTriangle className="h-4 w-4 text-purple-500" />} />
        <KPI label="تكلفة الهدر هذا الشهر" value={`${(dashboard.wasteCost || 0).toFixed(2)} ج`} color="#dc2626" icon={<Trash2 className="h-4 w-4 text-red-500" />} />
      </div>

      {dashboard.lowStock?.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base text-orange-600">⚠️ مكونات قاربت على النفاد</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.lowStock.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                <div><div className="font-semibold">{i.name_ar}</div><div className="text-xs text-muted-foreground">{formatStock(i.current_stock, i.unit)} • نقطة إعادة الطلب: {formatStock(i.reorder_point, i.unit)}</div></div>
                <Badge variant="outline" className="text-orange-700">منخفض</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dashboard.topConsumed?.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">🏆 أعلى 5 مكونات استهلاكاً (آخر 30 يوم)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.topConsumed.map((i: any, idx: number) => (
              <div key={i.ingredient_id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2"><Badge>{idx + 1}</Badge><span className="font-semibold">{i.name_ar}</span></div>
                <div className="text-sm text-muted-foreground">{formatStock(Number(i.total_used), i.unit)} • {Number(i.total_cost).toFixed(2)} ج</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dashboard.expiringSoon?.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base text-purple-600">⏰ صلاحية تنتهي قريباً</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.expiringSoon.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <div className="font-semibold">{i.name_ar}</div>
                <div className="text-xs">ينتهي: {i.expiry_date}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Live status grid */}
      <Card><CardHeader><CardTitle className="text-base">المخزون الآن</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ingredients.map(i => {
            const pct = i.reorder_point > 0 ? Math.min(100, (Number(i.current_stock) / (Number(i.reorder_point) * 2)) * 100) : 100
            const color = i.current_stock <= 0 ? 'bg-red-500' : (i.current_stock <= i.reorder_point ? 'bg-orange-500' : 'bg-green-500')
            return (
              <div key={i.id} className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div><div className="font-semibold text-sm">{i.name_ar}</div><div className="text-xs text-muted-foreground">{CATEGORY_OPTIONS.find(c => c.value === i.category)?.label}</div></div>
                  <div className="text-sm font-bold">{formatStock(Number(i.current_stock), i.unit)}</div>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
          {ingredients.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-6">لا يوجد مكونات بعد. ابدأ بإضافة مكونات من تبويب "المكونات"</div>}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Ingredients Library ─────────────────────────────────────
function IngredientsTab({ ingredients, suppliers, placeId, isDevAdmin, onChange }: any) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => ingredients.filter((i: Ingredient) => {
    const matchesSearch = !search || i.name_ar.toLowerCase().includes(search.toLowerCase())
    const matchesCat = filterCat === 'all' || i.category === filterCat
    return matchesSearch && matchesCat
  }), [ingredients, search, filterCat])

  const startNew = () => { setEditing({ name_ar: '', category: 'other', unit: 'g', current_stock: 0, min_threshold: 0, reorder_point: 0, reorder_quantity: 0, cost_per_unit: 0, supplier_id: null, expiry_date: null, place_id: placeId, scope: placeId ? 'place' : 'global' }); setOpen(true) }
  const startEdit = (i: Ingredient) => { setEditing({ ...i, scope: i.place_id ? 'place' : 'global' }); setOpen(true) }

  const save = async () => {
    if (!editing.name_ar) return alert('الاسم مطلوب')
    const payload = { ...editing, place_id: editing.scope === 'global' ? null : (editing.place_id || placeId) }
    delete (payload as any).scope
    const url = editing.id ? `/api/ingredients/${editing.id}` : '/api/ingredients'
    const method = editing.id ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) { const e = await r.json(); return alert(e.error || 'فشل الحفظ') }
    setOpen(false); setEditing(null); onChange()
  }
  const remove = async (id: string) => {
    if (!confirm('متأكد من الحذف؟')) return
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' }); onChange()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={startNew} className="ml-auto"><Plus className="h-4 w-4 ml-1" /> مكون جديد</Button>
      </div>

      <div className="grid gap-2">
        {filtered.map((i: Ingredient) => {
          const status = i.current_stock <= 0 ? { label: 'نفد', color: 'destructive' } : (i.current_stock <= i.reorder_point ? { label: 'منخفض', color: 'secondary' } : { label: 'متوفر', color: 'default' })
          return (
            <Card key={i.id}><CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{i.name_ar}</span>
                  <Badge variant={status.color as any}>{status.label}</Badge>
                  {!i.place_id && <Badge variant="outline">عام</Badge>}
                  <Badge variant="outline" className="text-xs">{CATEGORY_OPTIONS.find(c => c.value === i.category)?.icon} {CATEGORY_OPTIONS.find(c => c.value === i.category)?.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  المخزون: <b>{formatStock(Number(i.current_stock), i.unit)}</b> • نقطة الطلب: {formatStock(Number(i.reorder_point), i.unit)} • تكلفة الوحدة: {Number(i.cost_per_unit).toFixed(3)} ج
                  {i.supplier_name && <> • مورد: {i.supplier_name}</>}
                  {i.expiry_date && <> • صلاحية: {i.expiry_date}</>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(i)}><Edit2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </CardContent></Card>
          )
        })}
        {filtered.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">لا توجد مكونات</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? 'تعديل المكون' : 'مكون جديد'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>الاسم</Label><Input value={editing.name_ar} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div><Label>الفئة</Label>
                <Select value={editing.category} onValueChange={v => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>وحدة القياس الأساسية</Label>
                <Select value={editing.unit} onValueChange={v => setEditing({ ...editing, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">جرام (g)</SelectItem>
                    <SelectItem value="ml">مل (ml)</SelectItem>
                    <SelectItem value="piece">قطعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المخزون الحالي ({editing.unit})</Label><Input type="number" value={editing.current_stock} onChange={e => setEditing({ ...editing, current_stock: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>تكلفة الوحدة (جنيه)</Label><Input type="number" step="0.001" value={editing.cost_per_unit} onChange={e => setEditing({ ...editing, cost_per_unit: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>الحد الأدنى ({editing.unit})</Label><Input type="number" value={editing.min_threshold} onChange={e => setEditing({ ...editing, min_threshold: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>نقطة إعادة الطلب ({editing.unit})</Label><Input type="number" value={editing.reorder_point} onChange={e => setEditing({ ...editing, reorder_point: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>كمية الطلب الموصى بها ({editing.unit})</Label><Input type="number" value={editing.reorder_quantity} onChange={e => setEditing({ ...editing, reorder_quantity: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>المورد</Label>
                <Select value={editing.supplier_id || 'none'} onValueChange={v => setEditing({ ...editing, supplier_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— بدون —</SelectItem>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>تاريخ الصلاحية</Label><Input type="date" value={editing.expiry_date || ''} onChange={e => setEditing({ ...editing, expiry_date: e.target.value || null })} /></div>
              {isDevAdmin && (
                <div className="col-span-2"><Label>النطاق</Label>
                  <Select value={editing.scope} onValueChange={v => setEditing({ ...editing, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">عام (لكل النظام)</SelectItem>
                      <SelectItem value="place">خاص بهذا الفرع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Recipes ─────────────────────────────────────────────────
function RecipesTab({ drinks, ingredients }: any) {
  const [selected, setSelected] = useState<string>('')
  const [recipes, setRecipes] = useState<any[]>([])
  const [size, setSize] = useState('default')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [recipeId, setRecipeId] = useState<string | null>(null)

  const loadRecipes = async (drinkId: string) => {
    if (!drinkId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/recipes?drink_id=${drinkId}`).then(r => r.json())
      setRecipes(Array.isArray(r) ? r : [])
      const main = r.find((x: any) => x.size === size && !x.is_addon)
      if (main) { setItems(main.items || []); setRecipeId(main.id) } else { setItems([]); setRecipeId(null) }
    } finally { setLoading(false) }
  }
  useEffect(() => { if (selected) loadRecipes(selected) }, [selected])
  useEffect(() => {
    const main = recipes.find((x: any) => x.size === size && !x.is_addon)
    if (main) { setItems(main.items || []); setRecipeId(main.id) } else { setItems([]); setRecipeId(null) }
  }, [size, recipes])

  const addItem = () => setItems([...items, { ingredient_id: '', quantity: 0, unit: 'g' }])
  const updItem = (idx: number, key: string, val: any) => { const c = [...items]; c[idx] = { ...c[idx], [key]: val }; setItems(c) }
  const rmItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const save = async () => {
    if (!selected) return
    const valid = items.filter(it => it.ingredient_id && it.quantity > 0)
    const r = await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drink_id: selected, size, items: valid, recipe_id: recipeId }) })
    if (!r.ok) return alert('فشل الحفظ')
    alert('تم حفظ الوصفة ✓')
    loadRecipes(selected)
  }

  // Cost calc
  const cost = useMemo(() => {
    let c = 0
    for (const it of items) {
      const ing = ingredients.find((x: any) => x.id === it.ingredient_id)
      if (!ing) continue
      // Convert to base
      const factor = it.unit === 'kg' ? 1000 : it.unit === 'l' ? 1000 : 1
      c += Number(it.quantity) * factor * Number(ing.cost_per_unit || 0)
    }
    return c
  }, [items, ingredients])
  const drink = drinks.find((d: any) => d.id === selected)
  const margin = drink ? Number(drink.price) - cost : 0
  const marginPct = drink && drink.price > 0 ? (margin / Number(drink.price)) * 100 : 0

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-4 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>المشروب</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="اختر مشروب" /></SelectTrigger>
            <SelectContent>{drinks.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.price}ج</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label>الحجم</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="default">افتراضي</SelectItem><SelectItem value="small">صغير</SelectItem><SelectItem value="medium">وسط</SelectItem><SelectItem value="large">كبير</SelectItem></SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      {selected && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">
          <span>مكونات الوصفة</span>
          <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 ml-1" /> إضافة مكون</Button>
        </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">لا يوجد مكونات. أضف مكونات لبناء الوصفة.</div>}
            {items.map((it, idx) => {
              const ing = ingredients.find((x: any) => x.id === it.ingredient_id)
              return (
                <div key={idx} className="flex items-center gap-2 flex-wrap p-2 bg-muted/30 rounded">
                  <Select value={it.ingredient_id} onValueChange={v => updItem(idx, 'ingredient_id', v)}>
                    <SelectTrigger className="flex-1 min-w-[150px]"><SelectValue placeholder="اختر مكون" /></SelectTrigger>
                    <SelectContent>{ingredients.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name_ar} ({i.unit})</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={it.quantity} onChange={e => updItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-24" placeholder="الكمية" />
                  <Select value={it.unit} onValueChange={v => updItem(idx, 'unit', v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {ing && <span className="text-xs text-muted-foreground">≈ {(Number(it.quantity) * (it.unit === 'kg' || it.unit === 'l' ? 1000 : 1) * Number(ing.cost_per_unit || 0)).toFixed(3)} ج</span>}
                  <Button size="sm" variant="ghost" onClick={() => rmItem(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              )
            })}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded mt-3">
              <div>
                <div className="text-xs text-muted-foreground">تكلفة الوصفة</div>
                <div className="text-xl font-bold text-blue-700">{cost.toFixed(3)} ج</div>
              </div>
              {drink && (<>
                <div>
                  <div className="text-xs text-muted-foreground">سعر البيع</div>
                  <div className="text-xl font-bold">{Number(drink.price).toFixed(2)} ج</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">الربح</div>
                  <div className={`text-xl font-bold ${margin > 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(2)} ج ({marginPct.toFixed(0)}%)</div>
                </div>
              </>)}
              <Button onClick={save}>حفظ الوصفة</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Movements ───────────────────────────────────────────────
function MovementsTab({ placeId, ingredients }: any) {
  const [moves, setMoves] = useState<any[]>([])
  const [filterType, setFilterType] = useState('all')
  const [filterIng, setFilterIng] = useState('all')
  useEffect(() => {
    const qs = new URLSearchParams()
    if (placeId) qs.set('place_id', placeId)
    if (filterType !== 'all') qs.set('type', filterType)
    if (filterIng !== 'all') qs.set('ingredient_id', filterIng)
    fetch(`/api/stock-movements?${qs.toString()}`).then(r => r.json()).then(setMoves)
  }, [placeId, filterType, filterIng])

  const TYPE_LABELS: any = { sale: { label: 'بيع', color: 'text-blue-600' }, purchase: { label: 'شراء', color: 'text-green-600' }, waste: { label: 'هدر', color: 'text-red-600' }, adjustment: { label: 'تعديل', color: 'text-amber-600' }, transfer: { label: 'نقل', color: 'text-purple-600' }, return: { label: 'إرجاع', color: 'text-pink-600' } }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]: any) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterIng} onValueChange={setFilterIng}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل المكونات</SelectItem>{ingredients.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name_ar}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="space-y-1">
          {moves.map((m: any) => {
            const t = TYPE_LABELS[m.movement_type] || { label: m.movement_type, color: 'text-gray-600' }
            const inflow = Number(m.quantity) > 0
            return (
              <div key={m.id} className="flex items-center gap-3 p-2 bg-muted/20 rounded text-sm">
                <Badge variant="outline" className={t.color}>{t.label}</Badge>
                <span className="font-semibold">{m.ingredient_name}</span>
                <span className={inflow ? 'text-green-600 font-mono' : 'text-red-600 font-mono'}>{inflow ? '+' : ''}{formatStock(Number(m.quantity), m.unit)}</span>
                {m.cost_total != 0 && <span className="text-xs text-muted-foreground">{Number(m.cost_total).toFixed(2)} ج</span>}
                <span className="text-xs text-muted-foreground flex-1">{m.reason}</span>
                <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
              </div>
            )
          })}
          {moves.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">لا توجد حركات</div>}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Operations: waste / adjustment / daily count / receive ──
function OpsTab({ ingredients, placeId, onChange }: any) {
  const [op, setOp] = useState<'waste' | 'adjust' | 'count'>('waste')
  const [ingId, setIngId] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('g')
  const [reason, setReason] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const ing = ingredients.find((i: any) => i.id === ingId)

  const submit = async () => {
    if (!ingId || !qty) return alert('اختر مكون وأدخل الكمية')
    const q = parseFloat(qty)
    let movement_type = op === 'waste' ? 'waste' : 'adjustment'
    let dir = direction
    if (op === 'waste') dir = 'out'
    if (op === 'count') {
      // Daily count: calculate diff and submit as adjustment
      if (!ing) return
      const factor = unit === 'kg' ? 1000 : unit === 'l' ? 1000 : 1
      const actualBase = q * factor
      const diff = actualBase - Number(ing.current_stock)
      if (diff === 0) return alert('لا يوجد فرق')
      await fetch('/api/stock-movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredient_id: ingId, movement_type: 'adjustment', quantity: Math.abs(diff), unit: ing.unit, base_unit: ing.unit, reason: reason || `جرد يومي: العدد الفعلي ${q} ${unit}`, place_id: placeId, direction: diff > 0 ? 'in' : 'out' }) })
    } else {
      await fetch('/api/stock-movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredient_id: ingId, movement_type, quantity: q, unit, base_unit: ing?.unit, reason, place_id: placeId, direction: dir, cost_per_unit: ing?.cost_per_unit }) })
    }
    setQty(''); setReason(''); onChange(); alert('تم التسجيل ✓')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant={op === 'waste' ? 'default' : 'outline'} onClick={() => setOp('waste')}>🗑️ تسجيل هدر</Button>
        <Button variant={op === 'adjust' ? 'default' : 'outline'} onClick={() => setOp('adjust')}>⚖️ تعديل يدوي</Button>
        <Button variant={op === 'count' ? 'default' : 'outline'} onClick={() => setOp('count')}>📋 جرد يومي</Button>
      </div>
      <Card><CardContent className="p-4 space-y-3">
        <div><Label>المكون</Label>
          <Select value={ingId} onValueChange={setIngId}>
            <SelectTrigger><SelectValue placeholder="اختر مكون" /></SelectTrigger>
            <SelectContent>{ingredients.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name_ar} — حالياً: {formatStock(Number(i.current_stock), i.unit)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{op === 'count' ? 'العدد الفعلي' : 'الكمية'}</Label><Input type="number" step="0.01" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><Label>الوحدة</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {op === 'adjust' && (
          <div><Label>الاتجاه</Label>
            <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in">إضافة (+)</SelectItem><SelectItem value="out">خصم (-)</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        <div><Label>السبب / ملاحظة</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={op === 'waste' ? 'مثال: انسكب كوب لاتيه' : op === 'count' ? 'ملاحظات الجرد' : 'سبب التعديل'} /></div>
        <Button onClick={submit} className="w-full">تسجيل</Button>
      </CardContent></Card>
    </div>
  )
}

// ─── Suppliers ───────────────────────────────────────────────
function SuppliersTab({ suppliers, placeId, onChange }: any) {
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)
  const startNew = () => { setEditing({ name: '', phone: '', email: '', payment_terms: '', notes: '', place_id: placeId }); setOpen(true) }
  const save = async () => {
    if (!editing.name) return alert('الاسم مطلوب')
    const url = editing.id ? `/api/suppliers/${editing.id}` : '/api/suppliers'
    const method = editing.id ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setOpen(false); onChange()
  }
  const remove = async (id: string) => { if (confirm('حذف؟')) { await fetch(`/api/suppliers/${id}`, { method: 'DELETE' }); onChange() } }
  return (
    <div className="space-y-3">
      <Button onClick={startNew}><Plus className="h-4 w-4 ml-1" /> مورد جديد</Button>
      <div className="grid gap-2">
        {suppliers.map((s: any) => (
          <Card key={s.id}><CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1">
              <div className="font-bold">{s.name}</div>
              <div className="text-xs text-muted-foreground">📞 {s.phone || '—'} • ✉️ {s.email || '—'} {s.payment_terms && `• شروط: ${s.payment_terms}`}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true) }}><Edit2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </CardContent></Card>
        ))}
        {suppliers.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">لا يوجد موردين</div>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? 'تعديل مورد' : 'مورد جديد'}</DialogTitle></DialogHeader>
          {editing && (<div className="space-y-3">
            <div><Label>الاسم</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><Label>البريد</Label><Input value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><Label>شروط الدفع</Label><Input value={editing.payment_terms || ''} onChange={e => setEditing({ ...editing, payment_terms: e.target.value })} placeholder="مثال: 30 يوم" /></div>
            <div><Label>ملاحظات</Label><Textarea value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>)}
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Purchase Orders ─────────────────────────────────────────
function PurchaseOrdersTab({ placeId, ingredients, suppliers, onChange }: any) {
  const [pos, setPos] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<any>({ supplier_id: null, expected_date: '', notes: '', items: [] })
  const [receiveOpen, setReceiveOpen] = useState<any>(null)
  const [receipts, setReceipts] = useState<Record<string, number>>({})
  const reload = () => { fetch(`/api/purchase-orders${placeId ? '?place_id=' + placeId : ''}`).then(r => r.json()).then(setPos) }
  useEffect(reload, [placeId])

  const addLine = () => setDraft({ ...draft, items: [...draft.items, { ingredient_id: '', quantity_ordered: 0, unit: 'g', unit_cost: 0 }] })
  const updLine = (idx: number, key: string, val: any) => { const c = [...draft.items]; c[idx] = { ...c[idx], [key]: val }; setDraft({ ...draft, items: c }) }
  const rmLine = (idx: number) => setDraft({ ...draft, items: draft.items.filter((_: any, i: number) => i !== idx) })
  const totalCost = draft.items.reduce((s: number, it: any) => s + Number(it.quantity_ordered) * Number(it.unit_cost), 0)

  const create = async () => {
    if (draft.items.length === 0) return alert('أضف بنوداً')
    await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, place_id: placeId, items: draft.items.filter((it: any) => it.ingredient_id && it.quantity_ordered > 0) }) })
    setOpen(false); setDraft({ supplier_id: null, expected_date: '', notes: '', items: [] }); reload()
  }
  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/purchase-orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    reload()
  }
  const doReceive = async () => {
    const arr = Object.entries(receipts).filter(([_, v]) => v > 0).map(([item_id, quantity_received]) => ({ item_id, quantity_received }))
    await fetch(`/api/purchase-orders/${receiveOpen.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'receive', receipts: arr }) })
    setReceiveOpen(null); setReceipts({}); reload(); onChange()
  }
  const STATUS: any = { draft: { label: 'مسودة', color: 'secondary' }, sent: { label: 'مرسل', color: 'default' }, partial: { label: 'استلام جزئي', color: 'outline' }, received: { label: 'مستلم', color: 'default' }, cancelled: { label: 'ملغي', color: 'destructive' } }

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 ml-1" /> أمر شراء جديد</Button>
      <div className="grid gap-2">
        {pos.map((po: any) => (
          <Card key={po.id}><CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold">{po.po_number}</span>
              <Badge variant={STATUS[po.status]?.color}>{STATUS[po.status]?.label}</Badge>
              <span className="text-sm">{po.supplier_name || '— بدون مورد —'}</span>
              <span className="text-sm font-bold">{Number(po.total_cost).toFixed(2)} ج</span>
              {po.expected_date && <span className="text-xs text-muted-foreground">متوقع: {po.expected_date}</span>}
              <div className="ml-auto flex gap-1">
                {po.status === 'draft' && <Button size="sm" variant="outline" onClick={() => updateStatus(po.id, 'sent')}>إرسال</Button>}
                {(po.status === 'sent' || po.status === 'partial') && <Button size="sm" onClick={() => { setReceiveOpen(po); const init: any = {}; po.items?.forEach((it: any) => init[it.id] = Number(it.quantity_ordered) - Number(it.quantity_received)); setReceipts(init) }}>استلام</Button>}
                <Button size="sm" variant="ghost" onClick={async () => { if (confirm('حذف؟')) { await fetch(`/api/purchase-orders/${po.id}`, { method: 'DELETE' }); reload() } }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {po.items?.map((it: any) => (
                <div key={it.id} className="text-xs flex gap-3 p-1 bg-muted/20 rounded">
                  <span className="flex-1">{it.ingredient_name}</span>
                  <span>طلب: {Number(it.quantity_ordered)} {it.unit}</span>
                  <span>مستلم: {Number(it.quantity_received)} {it.unit}</span>
                  <span>سعر: {Number(it.unit_cost).toFixed(2)} ج</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        ))}
        {pos.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">لا يوجد أوامر شراء</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader><DialogTitle>أمر شراء جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>المورد</Label>
                <Select value={draft.supplier_id || 'none'} onValueChange={v => setDraft({ ...draft, supplier_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— بدون —</SelectItem>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>تاريخ متوقع</Label><Input type="date" value={draft.expected_date} onChange={e => setDraft({ ...draft, expected_date: e.target.value })} /></div>
            </div>
            <div className="flex justify-between items-center"><Label>البنود</Label><Button size="sm" onClick={addLine}><Plus className="h-4 w-4 ml-1" /> بند</Button></div>
            {draft.items.map((it: any, idx: number) => (
              <div key={idx} className="flex gap-2 items-center flex-wrap p-2 bg-muted/30 rounded">
                <Select value={it.ingredient_id} onValueChange={v => { const ing = ingredients.find((i: any) => i.id === v); updLine(idx, 'ingredient_id', v); if (ing) { updLine(idx, 'unit', ing.unit); updLine(idx, 'unit_cost', ing.cost_per_unit) } }}>
                  <SelectTrigger className="flex-1 min-w-[140px]"><SelectValue placeholder="مكون" /></SelectTrigger>
                  <SelectContent>{ingredients.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name_ar}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="الكمية" className="w-24" value={it.quantity_ordered} onChange={e => updLine(idx, 'quantity_ordered', parseFloat(e.target.value) || 0)} />
                <Select value={it.unit} onValueChange={v => updLine(idx, 'unit', v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" step="0.01" placeholder="سعر الوحدة" className="w-28" value={it.unit_cost} onChange={e => updLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)} />
                <Button size="sm" variant="ghost" onClick={() => rmLine(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
            <div className="text-end font-bold">الإجمالي: {totalCost.toFixed(2)} ج</div>
            <div><Label>ملاحظات</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={create}>إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiveOpen} onOpenChange={v => !v && setReceiveOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>استلام أمر الشراء {receiveOpen?.po_number}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {receiveOpen?.items?.map((it: any) => (
              <div key={it.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{it.ingredient_name}</span>
                <span className="text-xs text-muted-foreground">/ {Number(it.quantity_ordered) - Number(it.quantity_received)} {it.unit}</span>
                <Input type="number" className="w-24" value={receipts[it.id] || ''} onChange={e => setReceipts({ ...receipts, [it.id]: parseFloat(e.target.value) || 0 })} />
                <span className="text-xs">{it.unit}</span>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={doReceive}>تأكيد الاستلام</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Smart Features ──────────────────────────────────────────
function SmartTab({ placeId, ingredients, suppliers, onChange }: any) {
  const [view, setView] = useState<'forecast' | 'leak' | 'profit' | 'suggest'>('forecast')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const reload = async () => {
    setLoading(true)
    try {
      const qs = placeId ? `&place_id=${placeId}` : ''
      const r = await fetch(`/api/inventory-dashboard?view=${view === 'profit' ? 'profitability' : view === 'suggest' ? 'suggest_po' : view}${qs}`).then(r => r.json())
      setData(r)
    } finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [view, placeId])

  const createPOFromSuggest = async (supId: string, items: any[]) => {
    if (!confirm(`إنشاء أمر شراء بـ ${items.length} مكون؟`)) return
    await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      supplier_id: supId === 'no_supplier' ? null : supId,
      place_id: placeId,
      items: items.map(it => ({ ingredient_id: it.ingredient_id, quantity_ordered: it.quantity_ordered, unit: it.unit, unit_cost: it.unit_cost }))
    }) })
    alert('تم إنشاء أمر الشراء ✓ راجعه في تبويب "شراء"')
    onChange()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={view === 'forecast' ? 'default' : 'outline'} onClick={() => setView('forecast')}>🔮 التنبؤ بالنفاد</Button>
        <Button size="sm" variant={view === 'suggest' ? 'default' : 'outline'} onClick={() => setView('suggest')}>🧾 اقتراحات شراء تلقائية</Button>
        <Button size="sm" variant={view === 'leak' ? 'default' : 'outline'} onClick={() => setView('leak')}>🔍 كشف التسريب</Button>
        <Button size="sm" variant={view === 'profit' ? 'default' : 'outline'} onClick={() => setView('profit')}>💰 تحليل الربحية</Button>
      </div>

      {loading && <div className="text-center text-sm text-muted-foreground py-4">جاري التحليل...</div>}

      {view === 'forecast' && Array.isArray(data) && (
        <div className="grid gap-2">
          {data.sort((a: any, b: any) => (a.days_left ?? 999) - (b.days_left ?? 999)).map((i: any) => {
            const days = i.days_left
            const urgent = days !== null && days < 3
            const warn = days !== null && days < 7
            return (
              <Card key={i.id}><CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="font-bold">{i.name_ar}</div>
                  <div className="text-xs text-muted-foreground">حالياً: {formatStock(i.current_stock, i.unit)} • متوسط الاستهلاك: {formatStock(i.daily_avg, i.unit)}/يوم</div>
                </div>
                {days === null ? <Badge variant="outline">لا توجد بيانات استهلاك</Badge>
                  : <Badge variant={urgent ? 'destructive' : warn ? 'secondary' : 'default'}>{days < 0 ? 'نفد' : `~ ${Math.floor(days)} يوم`}</Badge>}
              </CardContent></Card>
            )
          })}
          {data.length === 0 && <div className="text-center text-muted-foreground py-6">لا يوجد بيانات</div>}
        </div>
      )}

      {view === 'suggest' && data && typeof data === 'object' && (
        <div className="space-y-3">
          {Object.entries(data).map(([supId, items]: any) => {
            const sup = suppliers.find((s: any) => s.id === supId)
            const total = items.reduce((s: number, it: any) => s + Number(it.quantity_ordered) * Number(it.unit_cost), 0)
            return (
              <Card key={supId}><CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">
                <span>🚚 {sup?.name || 'بدون مورد محدد'} — {items.length} مكون</span>
                <Button size="sm" onClick={() => createPOFromSuggest(supId, items)}>إنشاء أمر شراء</Button>
              </CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {items.map((it: any) => (
                    <div key={it.ingredient_id} className="flex items-center gap-3 text-sm p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                      <span className="flex-1 font-semibold">{it.name_ar}</span>
                      <span className="text-xs text-muted-foreground">حالياً: {formatStock(it.current_stock, it.unit)}</span>
                      {it.days_left !== null && <span className="text-xs text-orange-600">~{Math.floor(it.days_left)} يوم</span>}
                      <span className="font-mono">طلب: {Number(it.quantity_ordered).toFixed(0)} {it.unit}</span>
                      <span className="text-xs">@{Number(it.unit_cost).toFixed(2)}ج</span>
                    </div>
                  ))}
                  <div className="text-end font-bold pt-1">إجمالي: {total.toFixed(2)} ج</div>
                </CardContent>
              </Card>
            )
          })}
          {Object.keys(data).length === 0 && <div className="text-center text-muted-foreground py-6">لا توجد اقتراحات حالياً — كل المخزون فوق نقطة إعادة الطلب 🎉</div>}
        </div>
      )}

      {view === 'leak' && Array.isArray(data) && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">مقارنة: المتوقع (حسب الوصفات × المبيعات) ضد الفعلي المخصوم — آخر 7 أيام</div>
          {data.map((r: any) => {
            const isLeak = r.variance > 0.5
            const isExcess = r.variance < -0.5
            return (
              <div key={r.id} className={`p-3 rounded flex items-center gap-3 ${isLeak ? 'bg-red-50 dark:bg-red-900/20' : isExcess ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted/30'}`}>
                <div className="flex-1"><div className="font-bold">{r.name_ar}</div>
                  <div className="text-xs">المتوقع: {formatStock(r.expected, r.unit)} • الفعلي المخصوم: {formatStock(r.actual, r.unit)}</div>
                </div>
                <Badge variant={isLeak ? 'destructive' : isExcess ? 'default' : 'outline'}>
                  {isLeak ? `🚨 تسريب +${formatStock(r.variance, r.unit)}` : isExcess ? `وفر ${formatStock(Math.abs(r.variance), r.unit)}` : 'متطابق'}
                </Badge>
              </div>
            )
          })}
          {data.length === 0 && <div className="text-center text-muted-foreground py-6">لا توجد بيانات للمقارنة</div>}
        </div>
      )}

      {view === 'profit' && Array.isArray(data) && (
        <div className="grid gap-2">
          {data.map((d: any) => (
            <Card key={d.id}><CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 font-bold">{d.name}</div>
              <div className="text-xs text-muted-foreground">السعر: {Number(d.price).toFixed(2)} ج</div>
              {d.cost === null ? <Badge variant="outline">بدون وصفة</Badge> : (<>
                <div className="text-xs">التكلفة: <b>{Number(d.cost).toFixed(2)} ج</b></div>
                <div className="text-xs">ربح: <b className={d.margin > 0 ? 'text-green-600' : 'text-red-600'}>{Number(d.margin).toFixed(2)} ج</b></div>
                <Badge variant={d.margin_pct > 60 ? 'default' : d.margin_pct > 30 ? 'secondary' : 'destructive'}>{Number(d.margin_pct).toFixed(0)}%</Badge>
              </>)}
            </CardContent></Card>
          ))}
          {data.length === 0 && <div className="text-center text-muted-foreground py-6">لا توجد بيانات</div>}
        </div>
      )}
    </div>
  )
}
