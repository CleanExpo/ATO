# 🎨 Customization Guide

Quick guide to customize your live visual dashboards.

---

## 🎬 Animation Speed

### Make Animations Slower (More Dramatic)

**AnimatedCounter** - Change from 500ms to 1000ms:
```tsx
// File: components/dashboard/AnimatedCounter.tsx
// Line 30
duration={1000}  // Was 500
```

**LiveProgressCard** - Change transition speed:
```tsx
// File: components/dashboard/LiveProgressCard.tsx
// Line 133
transition-all duration-1000  // Was duration-500
```

### Make Animations Faster (More Snappy)

```tsx
// AnimatedCounter.tsx
duration={300}  // Was 500

// LiveProgressCard.tsx
transition-all duration-300  // Was duration-500
```

---

## 🎨 Color Themes

### Add Your Brand Colors

**File:** `components/dashboard/LiveProgressCard.tsx`

Add after line 17 (in colorClasses object):

```tsx
// Your brand color
brand: {
  gradient: 'from-indigo-500 to-purple-500',
  border: 'border-indigo-500/50',
  bg: 'bg-indigo-500/10',
  text: 'text-indigo-400',
  glow: 'shadow-indigo-500/20'
},

// Another example - Teal
teal: {
  gradient: 'from-teal-500 to-cyan-500',
  border: 'border-teal-500/50',
  bg: 'bg-teal-500/10',
  text: 'text-teal-400',
  glow: 'shadow-teal-500/20'
}
```

**Use it:**
```tsx
<LiveProgressCard
  color="brand"  // or "teal"
  // ... other props
/>
```

### Change Default Colors

**File:** `components/dashboard/LiveChart.tsx`

Line 42 - Change the color palette:

```tsx
const DEFAULT_COLORS = [
  '#your-color-1',  // Was '#0ea5e9'
  '#your-color-2',  // Was '#10b981'
  '#your-color-3',  // Was '#f59e0b'
  // ... add more
]
```

---

## 📝 Language & Text

### Simplify Client View Language Even More

**File:** `lib/utils/client-view-transformer.ts`

**Change Headlines:**
```tsx
// Line 55-65 - Make even simpler
if (accuracyScore >= 95) {
  headline = `Perfect! ${accuracyScore}% accurate` // Shorter
}
```

**Change Descriptions:**
```tsx
// Line 75-80 - Simplify duplicates message
keyFindings.push(
  `${data.issuesByType.duplicate} duplicate entries to remove` // Simpler
)
```

**Change "What This Means":**
```tsx
// Line 117-130 - Make it plain English
whatThisMeans = 'Your bookkeeping looks great! Just a few small fixes needed.'
```

### Add Your Company Name

**File:** `app/dashboard/page.tsx` (or page-enhanced.tsx)

Line 115:
```tsx
<h1 className="font-bold">Your Company Tax Optimizer</h1>
<p className="text-xs text-[var(--text-muted)]">Powered by AI</p>
```

---

## 🔢 Number Formatting

### Change Currency Symbol

**File:** `components/dashboard/AnimatedCounter.tsx`

Line 56-61:
```tsx
return new Intl.NumberFormat('en-US', {  // Was en-AU
  style: 'currency',
  currency: 'USD',  // Was AUD
  // ...
})
```

### Use Thousands Separator (K, M, B)

Already built in! Just use format="compact":

```tsx
<AnimatedCounter
  value={1500000}
  format="compact"  // Shows "1.5M"
  decimals={1}
/>
```

---

## ⏱️ Polling Intervals

### Change How Often Data Refreshes

**Data Quality Scan:**

File: `app/dashboard/data-quality/page-enhanced.tsx`

Line 122:
```tsx
}, 3000)  // Was 2000 (poll every 3 seconds instead of 2)
```

**Forensic Audit:**

File: `app/dashboard/forensic-audit/page-enhanced.tsx`

Line 190:
```tsx
}, 10000) // Was 5000 (poll every 10 seconds)
```

Line 216:
```tsx
}, 30000) // Was 15000 (poll every 30 seconds)
```

**Main Dashboard:**

File: `app/dashboard/page-enhanced.tsx`

Line 282:
```tsx
const interval = setInterval(checkActiveOperations, 10000) // Was 5000
```

---

## 📊 Chart Styles

### Change Chart Colors

**File:** `components/dashboard/LiveChart.tsx`

Line 42-50:
```tsx
const DEFAULT_COLORS = [
  '#FF6384',  // Pink
  '#36A2EB',  // Blue
  '#FFCE56',  // Yellow
  '#4BC0C0',  // Teal
  '#9966FF',  // Purple
]
```

### Change Chart Height

When using LiveChart:
```tsx
<LiveChart
  height={400}  // Was 300
  // ... other props
/>
```

---

## 🎯 Activity Feed

### Show More Activities

**File:** `app/dashboard/data-quality/page-enhanced.tsx`

Line 320:
```tsx
maxItems={25}  // Was 15
```

### Change Auto-Scroll Behavior

```tsx
<ActivityFeed
  autoScroll={false}  // Disable auto-scroll
  showTimestamps={false}  // Hide timestamps
/>
```

---

## 🔤 Font Sizes

### Make Numbers Bigger

**Stat Cards:**

File: `app/dashboard/page.tsx` or similar

Change `text-3xl` to `text-4xl` or `text-5xl`:

```tsx
<AnimatedCounter
  className="text-5xl font-bold"  // Was text-3xl
/>
```

### Make Headers Bigger

```tsx
<h2 className="text-4xl font-bold">  // Was text-2xl
  Tax Optimization Dashboard
</h2>
```

---

## 🎪 Remove Animations (Performance Mode)

### Disable Counter Animations

**File:** `components/dashboard/AnimatedCounter.tsx`

Line 29:
```tsx
duration={0}  // Was 500 (instant, no animation)
```

### Disable Progress Bar Animations

**File:** `components/dashboard/LiveProgressCard.tsx`

Line 133:
```tsx
transition-none  // Was transition-all duration-500
```

---

## 💾 Persistence

### Change Where View Preference is Stored

**File:** `components/dashboard/ViewToggle.tsx`

Line 75:
```tsx
persistKey="my_app_view"  // Change the localStorage key
```

### Clear All Saved Preferences

In browser console:
```javascript
localStorage.clear()
```

---

## 📱 Mobile Adjustments

### Change Breakpoints

**File:** `app/globals.css`

Line 383-397:
```css
@media (max-width: 768px) {
  .stat-card {
    padding: 1rem;  /* Make smaller on mobile */
  }
}
```

### Hide Elements on Mobile

Add to any component:
```tsx
<div className="hidden md:block">
  {/* Only shows on desktop */}
</div>

<div className="md:hidden">
  {/* Only shows on mobile */}
</div>
```

---

## 🎨 Quick Color Reference

Common Tailwind colors you can use:

- **Blue:** `sky-400`, `sky-500`, `blue-400`
- **Green:** `emerald-400`, `green-500`, `teal-400`
- **Orange:** `amber-400`, `orange-500`
- **Red:** `red-400`, `rose-500`
- **Purple:** `purple-400`, `violet-500`, `fuchsia-400`
- **Gray:** `slate-400`, `gray-500`, `zinc-400`

Use them like: `text-sky-400`, `bg-emerald-500/10`, `border-purple-500/50`

---

## 🔧 Common Tweaks

### Make Activity Feed Taller

```tsx
<ActivityFeed
  className="max-h-96"  // Change to max-h-[600px] for taller
/>
```

### Remove Glassmorphism Effect

Replace `.glass-card` with `.bg-[var(--bg-secondary)]` in any component.

### Add More Quick Action Cards

File: `app/dashboard/page.tsx`

Copy one of the existing cards and modify it.

---

## 📚 Where to Find Colors in Code

All color variables are in: `app/globals.css` lines 4-41

Example:
```css
--color-primary: #0284c7;  /* Change this to your brand color */
```

Then use it in components:
```tsx
className="text-[var(--color-primary)]"
```

---

## 🎯 Pro Tips

1. **Test changes in dev mode first:** `npm run dev`
2. **Use browser DevTools** to inspect elements and try CSS changes live
3. **Keep backups:** All originals are in `-original.tsx` files
4. **Restart dev server** after changing `globals.css`
5. **Check responsiveness** by resizing browser window

---

## 🆘 Reset Everything

If you want to go back to originals:

```bash
cd /c/ATO/ato-app

# Restore original dashboards
cp app/dashboard/page-original-main.tsx app/dashboard/page.tsx
cp app/dashboard/data-quality/page-original.tsx app/dashboard/data-quality/page.tsx
cp app/dashboard/forensic-audit/page-original.tsx app/dashboard/forensic-audit/page.tsx
```

---

**Happy customizing! 🎉**

For more advanced customizations, check the component source code - everything is well-commented.
