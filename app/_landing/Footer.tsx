'use client'

import { BookOpen } from 'lucide-react'

const LINKS = {
  Product: ['Features', 'How it works', 'Pricing', 'Library', 'Changelog'],
  Learn: ['For students', 'For professionals', 'For independent learners', 'Blog'],
  Company: ['About', 'Contact', 'Privacy Policy', 'Terms of Service'],
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#060a18] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <BookOpen className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">ChapterFlow</span>
            </a>
            <p className="text-[13.5px] text-slate-500 leading-relaxed max-w-[260px]">
              Guided reading for people who want depth, momentum, and real retention.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-4">{group}</p>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-[13.5px] text-slate-500 hover:text-slate-300 transition-colors font-medium"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[13px] text-slate-600">© 2026 ChapterFlow. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (
              <a key={l} href="#" className="text-[13px] text-slate-600 hover:text-slate-400 transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
