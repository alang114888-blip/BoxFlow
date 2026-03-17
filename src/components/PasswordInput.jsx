import { useState, useMemo } from 'react'

const RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter (a-z)', test: (p) => /[a-zA-Z]/.test(p) },
  { id: 'number', label: 'At least one number (0-9)', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'At least one special character (!@#$...)', test: (p) => /[^a-zA-Z0-9]/.test(p) },
]

export function validatePassword(password) {
  const results = RULES.map((r) => ({ ...r, passed: r.test(password) }))
  const allPassed = results.every((r) => r.passed)
  return { results, allPassed }
}

export function validatePasswordMatch(password, confirm) {
  if (!confirm) return null
  return password === confirm
}

export default function PasswordInput({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showRules = true,
  showConfirm = true,
  disabled = false,
}) {
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const { results, allPassed } = useMemo(() => validatePassword(password), [password])
  const matchResult = useMemo(
    () => (showConfirm ? validatePasswordMatch(password, confirmPassword) : null),
    [password, confirmPassword, showConfirm]
  )

  const strength = results.filter((r) => r.passed).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] || ''
  const strengthColor = ['bg-slate-700', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'][strength] || 'bg-slate-700'

  return (
    <div className="space-y-4">
      {/* Password field */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 ml-1">New Password</label>
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
          <input
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            disabled={disabled}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">{showPw ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>

        {/* Strength bar */}
        {password && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? strengthColor : 'bg-slate-700'}`} />
                ))}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${strength >= 4 ? 'text-emerald-400' : strength >= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                {strengthLabel}
              </span>
            </div>
          </div>
        )}

        {/* Rules checklist */}
        {showRules && password && (
          <div className="grid grid-cols-2 gap-1 mt-1">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-[14px] ${r.passed ? 'text-emerald-400' : 'text-slate-600'}`}
                  style={r.passed ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {r.passed ? 'check_circle' : 'circle'}
                </span>
                <span className={`text-[10px] ${r.passed ? 'text-slate-300' : 'text-slate-500'}`}>{r.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm password field */}
      {showConfirm && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 ml-1">Confirm Password</label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock_reset</span>
            <input
              type={showConfirmPw ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={disabled}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3.5 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw(!showConfirmPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xl">{showConfirmPw ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          {matchResult === false && (
            <p className="text-xs text-red-400 ml-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              Passwords do not match
            </p>
          )}
          {matchResult === true && confirmPassword && (
            <p className="text-xs text-emerald-400 ml-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Passwords match
            </p>
          )}
        </div>
      )}
    </div>
  )
}
