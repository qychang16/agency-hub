import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'
import { fmtSGT, fmtSGTdate, daysUntil } from '../../../utils/dates'
import Button from '../../ui/Button'

// Format SGD cents to "S$X.XX" string. -1 means unlimited per plan schema.
function fmtSGD(cents, opts = {}) {
  if (cents === -1 || cents === '-1') return 'Unlimited'
  if (cents === null || cents === undefined) return 'S$0.00'
  const n = parseInt(cents) / 100
  if (opts.compact && n >= 1000) return 'S$' + (n / 1000).toFixed(1) + 'k'
  return 'S$' + n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtLimit(value) {
  if (value === -1 || value === '-1') return 'Unlimited'
  if (value === null || value === undefined) return '0'
  return Number(value).toLocaleString('en-SG')
}

// ─── Helper Components ────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#c2bdb3', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function StatusBadge({ status, billing_exempt }) {
  if (billing_exempt) return <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 11, background: '#fef3c7', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Exempt</span>
  const map = {
    active:    { bg: '#dcfce7', fg: '#16a34a', label: 'Active' },
    trialing:  { bg: '#dbeafe', fg: '#1d4ed8', label: 'Pilot' },
    past_due:  { bg: '#fef3c7', fg: '#92400e', label: 'Past Due' },
    unpaid:    { bg: '#fee2e2', fg: '#dc2626', label: 'Unpaid' },
    canceled:  { bg: '#f5f3ef', fg: '#6e6a63', label: 'Cancelled' },
    paused:    { bg: '#f5f3ef', fg: '#6e6a63', label: 'Paused' },
  }
  const s = map[status] || { bg: '#f5f3ef', fg: '#9a958c', label: 'No subscription' }
  return <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 11, background: s.bg, color: s.fg, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</span>
}

function UsageBar({ label, used, max, unit }) {
  const isUnlimited = max === -1 || max === '-1'
  const pct = isUnlimited ? 0 : Math.min(100, ((used || 0) / max) * 100)
  const isHigh = pct > 80
  const isFull = pct >= 100
  const barColor = isFull ? '#dc2626' : isHigh ? '#f59e0b' : ACCENT
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6e6a63', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#14130f', fontWeight: 600 }}>
          {fmtLimit(used || 0)} {isUnlimited ? '' : `/ ${fmtLimit(max)}`} {unit && <span style={{ color: '#9a958c', fontWeight: 400 }}>{unit}</span>}
        </span>
      </div>
      <div style={{ width: '100%', height: 5, background: '#f5f3ef', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: isUnlimited ? '8%' : `${pct}%`, background: isUnlimited ? 'repeating-linear-gradient(45deg, #c2bdb3, #c2bdb3 4px, #dcd8d0 4px, #dcd8d0 8px)' : barColor, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

function PlanCard({ plan, isCurrent, billingCycle, onSelect, disabled }) {
  const isAnnual = billingCycle === 'annual'
  const monthlyEquiv = isAnnual ? plan.annual_monthly_equivalent_cents : plan.monthly_price_cents
  const isEnterprise = plan.is_custom

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: isCurrent ? `2px solid ${ACCENT}` : '0.5px solid #dcd8d0',
      padding: 20,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {isCurrent && (
        <div style={{ position: 'absolute', top: -10, left: 16, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Current Plan
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#14130f', marginBottom: 4 }}>{plan.display_name}</div>
      <div style={{ marginBottom: 16 }}>
        {isEnterprise ? (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', lineHeight: 1 }}>From {fmtSGD(monthlyEquiv)}</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 4 }}>Custom annual contracts</div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#14130f', lineHeight: 1 }}>{fmtSGD(monthlyEquiv)}</span>
              <span style={{ fontSize: 11, color: '#9a958c' }}>/month</span>
            </div>
            {isAnnual && (
              <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                Save 15% vs monthly
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, padding: '10px 0', borderTop: '0.5px solid #f5f3ef', borderBottom: '0.5px solid #f5f3ef' }}>
        <div style={{ fontSize: 11, color: '#6e6a63' }}><strong>{fmtLimit(plan.max_users)}</strong> users</div>
        <div style={{ fontSize: 11, color: '#6e6a63' }}><strong>{fmtLimit(plan.max_phone_numbers)}</strong> phone numbers</div>
        <div style={{ fontSize: 11, color: '#6e6a63' }}><strong>{fmtLimit(plan.max_conversations_per_month)}</strong> conversations/month</div>
        <div style={{ fontSize: 11, color: '#6e6a63' }}><strong>{fmtLimit(plan.max_contacts)}</strong> contacts</div>
        <div style={{ fontSize: 11, color: '#6e6a63' }}>Wallet markup <strong>{plan.markup_percent}%</strong></div>
      </div>

      <div style={{ flex: 1, marginBottom: 14 }}>
        {(plan.features || []).slice(0, 4).map((f, i) => (
          <div key={i} style={{ fontSize: 11, color: '#4a4742', display: 'flex', gap: 6, marginBottom: 4, lineHeight: 1.4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{f}</span>
          </div>
        ))}
        {(plan.features || []).length > 4 && (
          <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4, paddingLeft: 18 }}>
            + {plan.features.length - 4} more
          </div>
        )}
      </div>

      <Button
        variant={isCurrent ? 'secondary' : 'primary'}
        onClick={() => onSelect(plan)}
        disabled={disabled || isCurrent}
        style={{ width: '100%' }}>
        {isCurrent ? 'Current plan' : isEnterprise ? 'Contact sales' : 'Select plan'}
      </Button>
    </div>
  )
}

function TransactionRow({ tx }) {
  const isCredit = tx.direction === 'credit'
  const sign = isCredit ? '+' : '−'
  const color = isCredit ? '#16a34a' : '#dc2626'
  const typeIcons = {
    topup:           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    message_charge:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    refund:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
    pilot_credit:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  }
  const icon = typeIcons[tx.type] || <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #faf9f7' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6a63', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.description || tx.type.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 10, color: '#9a958c', marginTop: 1 }}>{fmtSGT(tx.created_at)}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color, flexShrink: 0 }}>
        {sign}{fmtSGD(Math.abs(tx.amount_cents))}
      </div>
    </div>
  )
}

function InvoiceRow({ inv }) {
  const statusMap = {
    paid:           { bg: '#dcfce7', fg: '#16a34a', label: 'Paid' },
    open:           { bg: '#fef3c7', fg: '#92400e', label: 'Open' },
    draft:          { bg: '#f5f3ef', fg: '#6e6a63', label: 'Draft' },
    void:           { bg: '#f5f3ef', fg: '#9a958c', label: 'Void' },
    uncollectible:  { bg: '#fee2e2', fg: '#dc2626', label: 'Uncollectible' },
  }
  const s = statusMap[inv.status] || { bg: '#f5f3ef', fg: '#9a958c', label: inv.status }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 80px 1fr 1fr 60px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid #faf9f7' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>{inv.stripe_invoice_number || `#${inv.id}`}</div>
        <div style={{ fontSize: 10, color: '#9a958c' }}>{fmtSGTdate(inv.created_at)}</div>
      </div>
      <div>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: s.bg, color: s.fg, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>
        {fmtSGD(inv.amount_due_cents)}
      </div>
      <div style={{ fontSize: 11, color: '#6e6a63' }}>
        {inv.due_date ? fmtSGTdate(inv.due_date) : '—'}
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {inv.hosted_invoice_url && (
          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
            style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #dcd8d0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6e6a63', textDecoration: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        )}
        {inv.invoice_pdf_url && (
          <a href={inv.invoice_pdf_url} target="_blank" rel="noopener noreferrer" download
            style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #dcd8d0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6e6a63', textDecoration: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Billing Component ────────────────────────────────────────

export default function Billing() {
  const { token, hasPermission } = useAuth()
  const canManageBilling = hasPermission('manage_billing')

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [plans, setPlans] = useState([])
  const [transactions, setTransactions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [showAllPlans, setShowAllPlans] = useState(false)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [walletForm, setWalletForm] = useState({
    low_balance_threshold_cents: 1000,
    low_balance_threshold_dollars: '10',
    auto_topup_enabled: false,
    auto_topup_amount_cents: null,
    auto_topup_threshold_cents: null,
    auto_topup_amount_dollars: '',
    auto_topup_threshold_dollars: '',
  })
  const [saved, setSaved] = useState(false)
  const { save: apiSave, saving, error } = useApiSave(token)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const headers = { Authorization: 'Bearer ' + token }
        const [summaryRes, plansRes] = await Promise.all([
          fetch(`${API}/billing/summary`, { headers }).then(r => r.json()),
          fetch(`${API}/billing/plans`, { headers }).then(r => r.json()),
        ])
        if (cancelled) return
        setSummary(summaryRes)
        setPlans(Array.isArray(plansRes) ? plansRes : [])
        if (summaryRes?.subscription?.billing_cycle) setBillingCycle(summaryRes.subscription.billing_cycle)
        if (summaryRes?.wallet) {
          const lowBalCents = parseInt(summaryRes.wallet.low_balance_threshold_cents) || 1000
          const topupAmtCents = summaryRes.wallet.auto_topup_amount_cents
          const topupThrCents = summaryRes.wallet.auto_topup_threshold_cents
          setWalletForm({
            low_balance_threshold_cents: lowBalCents,
            low_balance_threshold_dollars: (lowBalCents / 100).toString(),
            auto_topup_enabled: summaryRes.wallet.auto_topup_enabled === true,
            auto_topup_amount_cents: topupAmtCents,
            auto_topup_threshold_cents: topupThrCents,
            auto_topup_amount_dollars: topupAmtCents != null ? (parseInt(topupAmtCents) / 100).toString() : '',
            auto_topup_threshold_dollars: topupThrCents != null ? (parseInt(topupThrCents) / 100).toString() : '',
          })
        }
        // These three require manage_billing - safe to skip if no permission
        if (canManageBilling) {
          const [txRes, invRes, pmRes] = await Promise.all([
            fetch(`${API}/billing/wallet/transactions?limit=5`, { headers }).then(r => r.json()).catch(() => ({ transactions: [] })),
            fetch(`${API}/billing/invoices?limit=10`, { headers }).then(r => r.json()).catch(() => ({ invoices: [] })),
            fetch(`${API}/billing/payment-method`, { headers }).then(r => r.json()).catch(() => null),
          ])
          if (cancelled) return
          setTransactions(txRes.transactions || [])
          setInvoices(invRes.invoices || [])
          setPaymentMethod(pmRes)
        }
      } catch (err) {
        console.error('Billing load error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token, canManageBilling])

  async function saveWalletSettings() {
    // Send only cents fields to backend; strip the dollar display fields
    const payload = {
      low_balance_threshold_cents: walletForm.low_balance_threshold_cents,
      auto_topup_enabled: walletForm.auto_topup_enabled,
      auto_topup_amount_cents: walletForm.auto_topup_amount_cents,
      auto_topup_threshold_cents: walletForm.auto_topup_threshold_cents,
    }
    const result = await apiSave(`${API}/billing/wallet`, { method: 'PATCH', body: payload })
    if (!result.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleSelectPlan(plan) {
    if (plan.is_custom) {
      window.location.href = 'mailto:sales@tel-cloud.sg?subject=Enterprise%20plan%20enquiry'
      return
    }
    alert(`Plan changes will be available once Stripe is connected.\n\nSelected: ${plan.display_name} (${billingCycle})`)
  }

  // State for the top-up modal (amount picker)
  // Defined at top-level state would be cleaner but adding inline here to
  // minimize patch scope; refactor to dedicated component later.
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState(5000)  // S$50 default, in cents
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState('')

  // Detect ?topup=success or ?topup=cancelled in URL (set by Stripe redirect)
  // and show a banner. Banner auto-dismisses after 5 seconds; URL query
  // params are cleaned up so refresh doesn't re-trigger.
  const [topupStatus, setTopupStatus] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('topup')
    if (status === 'success' || status === 'cancelled') {
      setTopupStatus(status)
      // Clean up URL so refresh doesn't re-show the banner
      params.delete('topup')
      params.delete('session_id')
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
      window.history.replaceState({}, '', newUrl)
      // Auto-dismiss after 5s
      const timeout = setTimeout(() => setTopupStatus(''), 5000)
      return () => clearTimeout(timeout)
    }
  }, [])

  function handleTopup() {
    setTopupError('')
    setTopupOpen(true)
  }

  async function startTopupCheckout() {
    setTopupError('')
    if (!Number.isInteger(topupAmount) || topupAmount < 1000 || topupAmount > 1000000) {
      setTopupError('Amount must be between S$10 and S$10,000')
      return
    }
    setTopupLoading(true)
    try {
      const r = await fetch(`${API}/billing/wallet/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount_cents: topupAmount }),
      })
      const data = await r.json()
      if (!r.ok) {
        setTopupError(data.error || 'Failed to create top-up session')
        setTopupLoading(false)
        return
      }
      // Redirect to Stripe Checkout (full page navigation)
      window.location.href = data.checkout_url
    } catch (err) {
      setTopupError('Network error: ' + err.message)
      setTopupLoading(false)
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 10, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      <div>Loading billing…</div>
    </div>
  )

  if (!summary) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
      <div style={{ fontSize: 13 }}>Could not load billing details.</div>
    </div>
  )

  const ws = summary.workspace
  const plan = summary.plan
  const subscription = summary.subscription || {}
  const pilot = summary.pilot || {}
  const wallet = summary.wallet || {}
  const usage = summary.usage_this_month || { spent_cents: 0, transactions: 0 }
  const isExempt = ws.billing_exempt === true
  const pilotActive = pilot.is_active === true
  const pilotDays = pilotActive ? daysUntil(pilot.ends_at) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Billing</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>
            Manage your plan, wallet, payment method and invoices. All amounts in SGD, all times in Singapore Time.
          </div>
        </div>
        <StatusBadge status={subscription.status} billing_exempt={isExempt} />
      </div>

      {/* Top-up status banner (success or cancelled, set by Stripe redirect, auto-dismisses in 5s) */}
      {topupStatus === 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 8, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Top-up successful</div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>Your wallet has been credited. Updated balance shown below.</div>
          </div>
          <button onClick={() => setTopupStatus('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#15803d' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
      {topupStatus === 'cancelled' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>Top-up cancelled</div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>No charges were applied. You can try again anytime.</div>
          </div>
          <button onClick={() => setTopupStatus('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#92400e' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
      {/* Conditional banners */}
      {isExempt && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e', lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <strong>Billing-exempt workspace.</strong> No charges will be applied. Wallet still tracks Meta cost passthrough at 0% markup.
          </div>
        </div>
      )}

      {pilotActive && (
        <div style={{ padding: '12px 16px', background: '#dbeafe', border: '0.5px solid #93c5fd', borderRadius: 10, fontSize: 12, color: '#1e40af', lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <div>
            <strong>Pilot active — {pilotDays} day{pilotDays !== 1 ? 's' : ''} remaining.</strong>{' '}
            Pilot ends {fmtSGTdate(pilot.ends_at)}. Your S$99 pilot fee will credit to your first month if you continue.
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
        {/* ─── Left Column ───────────────────────── */}
        <div>
          {/* Current Plan */}
          <Card>
            <CardHeader
              title="Current Plan"
              subtitle={isExempt ? 'Internal workspace, no charges' : 'Your active subscription'}
              action={canManageBilling && !isExempt && (
                <Button size="sm" variant="secondary" onClick={() => setShowAllPlans(!showAllPlans)}>
                  {showAllPlans ? 'Hide plans' : 'Change plan'}
                </Button>
              )}
            />
            {plan ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f' }}>{plan.display_name}</div>
                  {!isExempt && !plan.is_custom && (
                    <div style={{ fontSize: 13, color: '#6e6a63' }}>
                      <strong style={{ color: '#14130f' }}>{fmtSGD(plan.monthly_price_cents)}</strong>
                      <span style={{ fontSize: 11, color: '#9a958c' }}>/month</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 16 }}>
                  Wallet markup: {plan.markup_percent}% on Meta costs
                </div>

                <UsageBar label="Users" used={0} max={plan.max_users} />
                <UsageBar label="Phone numbers" used={0} max={plan.max_phone_numbers} />
                <UsageBar label="Conversations this month" used={0} max={plan.max_conversations_per_month} />
                <UsageBar label="Contacts" used={0} max={plan.max_contacts} />

                {subscription.current_period_end && !isExempt && (
                  <div style={{ marginTop: 14, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, fontSize: 11, color: '#6e6a63', lineHeight: 1.5 }}>
                    Current period ends <strong>{fmtSGTdate(subscription.current_period_end)}</strong>
                    {subscription.cancel_at_period_end && (
                      <span style={{ display: 'block', marginTop: 4, color: '#dc2626' }}>
                        ⚠ Subscription will cancel at the end of this period
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#9a958c' }}>No plan selected.</div>
            )}
          </Card>

          {/* Available Plans (toggle-revealed) */}
          {showAllPlans && !isExempt && (
            <Card style={{ background: '#faf9f7' }}>
              <CardHeader title="Available Plans" subtitle="Switch any time. Annual billing saves 15%." />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 16, padding: 4, background: '#fff', borderRadius: 8, border: '0.5px solid #dcd8d0', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
                {[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'annual', label: 'Annual', save: '−15%' },
                ].map(c => (
                  <button key={c.value} onClick={() => setBillingCycle(c.value)}
                    style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: 'none', background: billingCycle === c.value ? ACCENT : 'transparent', color: billingCycle === c.value ? '#fff' : '#6e6a63', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s' }}>
                    {c.label} {c.save && <span style={{ fontSize: 9, marginLeft: 4, opacity: billingCycle === c.value ? 1 : 0.7 }}>{c.save}</span>}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {plans.map(p => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    isCurrent={plan?.slug === p.slug}
                    billingCycle={billingCycle}
                    onSelect={handleSelectPlan}
                    disabled={!canManageBilling}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Wallet */}
          <Card>
            <CardHeader title="Wallet" subtitle={isExempt ? 'Tracks Meta cost passthrough at 0% markup' : `Top-up balance, ${plan?.markup_percent || 20}% markup applied to Meta costs`} />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current balance</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#14130f', lineHeight: 1 }}>
                {fmtSGD(wallet.balance_cents)}
              </div>
              <div style={{ fontSize: 11, color: '#9a958c', marginTop: 6 }}>
                Spent this month: <strong style={{ color: '#4a4742' }}>{fmtSGD(usage.spent_cents)}</strong> across {usage.transactions} transaction{usage.transactions !== 1 ? 's' : ''}
              </div>
            </div>

            {canManageBilling && (
              <Button onClick={handleTopup} style={{ width: '100%', marginBottom: 14 }}>
                Top up wallet
              </Button>
            )}

            <div style={{ paddingTop: 8, borderTop: '0.5px solid #f5f3ef' }}>
              <Field label="Low balance alert" hint="We'll notify you when your balance falls below this">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#6e6a63' }}>S$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={walletForm.low_balance_threshold_dollars ?? ''}
                    onChange={e => {
                      // Allow empty string, partial inputs like "50.", or valid decimals
                      const v = e.target.value
                      if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                        setWalletForm(p => ({
                          ...p,
                          low_balance_threshold_dollars: v,
                          low_balance_threshold_cents: v === '' ? 0 : Math.round(parseFloat(v) * 100)
                        }))
                      }
                    }}
                    onBlur={() => {
                      // On blur, normalize empty to "0"
                      if (walletForm.low_balance_threshold_dollars === '') {
                        setWalletForm(p => ({ ...p, low_balance_threshold_dollars: '0' }))
                      }
                    }}
                    disabled={!canManageBilling}
                    placeholder="10.00"
                    style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: canManageBilling ? '#fff' : '#faf9f7', color: '#14130f', boxSizing: 'border-box' }}
                  />
                </div>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                <div style={{ flex: 1, marginRight: 16 }}>
                  <div style={{ fontSize: 13, color: '#14130f', fontWeight: 500 }}>Auto top-up</div>
                  <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>Automatically top up when balance is low</div>
                </div>
                <Toggle
                  value={walletForm.auto_topup_enabled}
                  onChange={v => setWalletForm(p => ({ ...p, auto_topup_enabled: v }))}
                  disabled={!canManageBilling}
                />
              </div>

              {walletForm.auto_topup_enabled && (
                <div style={{ padding: '10px 12px', background: '#faf9f7', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: '#92400e', marginBottom: 8 }}>
                    ⚠ Auto top-up requires payment method (Stripe pending)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Top up by</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={walletForm.auto_topup_amount_dollars ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                            setWalletForm(p => ({
                              ...p,
                              auto_topup_amount_dollars: v,
                              auto_topup_amount_cents: v === '' ? null : Math.round(parseFloat(v) * 100)
                            }))
                          }
                        }}
                        disabled={!canManageBilling}
                        placeholder="50.00"
                        style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>When below</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={walletForm.auto_topup_threshold_dollars ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                            setWalletForm(p => ({
                              ...p,
                              auto_topup_threshold_dollars: v,
                              auto_topup_threshold_cents: v === '' ? null : Math.round(parseFloat(v) * 100)
                            }))
                          }
                        }}
                        disabled={!canManageBilling}
                        placeholder="10.00"
                        style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ─── Right Column ──────────────────────── */}
        <div>
          {/* Recent Wallet Activity */}
          {canManageBilling && (
            <Card>
              <CardHeader
                title="Recent Wallet Activity"
                subtitle="Last 5 transactions"
              />
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9a958c' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  <div style={{ fontSize: 12 }}>No transactions yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Wallet activity will appear here once you top up or send messages</div>
                </div>
              ) : (
                <div>
                  {transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
                </div>
              )}
            </Card>
          )}

          {/* Payment Method */}
          {canManageBilling && (
            <Card>
              <CardHeader title="Payment Method" subtitle="Card on file for top-ups and subscription" />
              {paymentMethod?.has_payment_method ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#faf9f7', borderRadius: 9, border: '0.5px solid #dcd8d0' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6e6a63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>•••• •••• •••• ••••</div>
                    <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>Card details will appear once Stripe is connected</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#faf9f7', borderRadius: 9, border: '0.5px dashed #dcd8d0' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#14130f' }}>No payment method on file</div>
                    <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{paymentMethod?.message || 'Connect Stripe to add a card'}</div>
                  </div>
                  <Button size="sm" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Add card</Button>
                </div>
              )}
              {paymentMethod?.stripe_customer_id && (
                <div style={{ fontSize: 10, color: '#c2bdb3', marginTop: 8, fontFamily: 'monospace' }}>
                  Stripe customer: {paymentMethod.stripe_customer_id}
                </div>
              )}
            </Card>
          )}

          {/* Invoices */}
          {canManageBilling && (
            <Card>
              <CardHeader title="Invoices" subtitle="Billing history" />
              {invoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9a958c' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <div style={{ fontSize: 12 }}>No invoices yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>{isExempt ? 'Billing-exempt workspaces do not generate invoices' : 'Invoices will appear here once your subscription becomes active'}</div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 80px 1fr 1fr 60px', gap: 12, padding: '8px 0', borderBottom: '0.5px solid #f5f3ef' }}>
                    {['Invoice', 'Status', 'Amount', 'Due Date', ''].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                    ))}
                  </div>
                  {invoices.map(inv => <InvoiceRow key={inv.id} inv={inv} />)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Save button (only for managers) */}
      {canManageBilling && (
        <>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 12, marginBottom: 8 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>鉁?Wallet settings saved</div>}
            <Button onClick={saveWalletSettings} loading={saving}>{saving ? 'Saving...' : 'Save Wallet Settings'}</Button>
          </div>
        </>
      )}
      {/* Top-up modal — opens when Top up wallet button is clicked */}
      {topupOpen && (
        <div onClick={() => !topupLoading && setTopupOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Top up wallet</div>
            <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 18 }}>Choose an amount. You'll be redirected to Stripe to complete payment.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              {[5000, 10000, 25000, 50000].map(cents => (
                <button key={cents}
                  onClick={() => setTopupAmount(cents)}
                  disabled={topupLoading}
                  style={{
                    padding: '10px 6px', borderRadius: 8,
                    border: topupAmount === cents ? '1px solid #14130f' : '0.5px solid #dcd8d0',
                    background: topupAmount === cents ? '#14130f' : '#fff',
                    color: topupAmount === cents ? '#fff' : '#4a4742',
                    fontSize: 13, fontWeight: 600, cursor: topupLoading ? 'not-allowed' : 'pointer',
                  }}>
                  S${cents / 100}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Custom amount (S$)</div>
              <input type="number" min="10" max="10000" step="1"
                value={(topupAmount / 100).toFixed(2)}
                onChange={e => {
                  const sgd = parseFloat(e.target.value)
                  if (!isNaN(sgd) && sgd >= 0) setTopupAmount(Math.round(sgd * 100))
                }}
                disabled={topupLoading}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '0.5px solid #dcd8d0', fontSize: 14, color: '#14130f',
                  outline: 'none', boxSizing: 'border-box',
                }} />
              <div style={{ fontSize: 11, color: '#9a958c', marginTop: 4 }}>Min S$10, max S$10,000</div>
            </div>
            {topupError && (
              <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                {topupError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button onClick={() => setTopupOpen(false)} disabled={topupLoading}
                style={{ background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' }}>
                Cancel
              </Button>
              <Button onClick={startTopupCheckout} loading={topupLoading} disabled={topupLoading}>
                {topupLoading ? 'Redirecting...' : `Pay S$${(topupAmount / 100).toFixed(2)}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}