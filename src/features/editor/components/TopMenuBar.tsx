import type { RefObject } from 'react'
import appLogo from '../../../assets/app-logo.svg'

export type MenuAction = {
  label: string
  shortcut?: string
  onClick: () => void
}

type TopMenuBarProps = {
  menuBarRef: RefObject<HTMLDivElement | null>
  menuOrder: string[]
  openMenu: string | null
  onToggleMenu: (menu: string) => void
  onCloseMenu: () => void
  menuModel: Record<string, MenuAction[]>
  onHome: () => void
}

export const TopMenuBar = ({
  menuBarRef,
  menuOrder,
  openMenu,
  onToggleMenu,
  onCloseMenu,
  menuModel,
  onHome,
}: TopMenuBarProps) => (
  <div ref={menuBarRef} className="flex h-10 items-center border-b border-slate-800 bg-slate-900 px-2 text-sm">
    {menuOrder.map((menu) => (
      <div key={menu} className="relative">
        <button className={`rounded px-2 py-1 ${openMenu === menu ? 'bg-slate-800' : 'hover:bg-slate-800'}`} onClick={() => onToggleMenu(menu)}>
          <span className="inline-flex items-center gap-1.5">
            {menu === 'File' && <img src={appLogo} alt="" aria-hidden="true" className="h-3.5 w-3.5" />}
            <span>{menu}</span>
          </span>
        </button>
        {openMenu === menu && (
          <div className="absolute left-0 top-8 z-40 min-w-[220px] rounded border border-slate-700 bg-slate-900 p-1 shadow-xl">
            {menuModel[menu].map((item) => (
              <button
                key={`${menu}_${item.label}`}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-800"
                onClick={() => {
                  item.onClick()
                  onCloseMenu()
                }}
              >
                <span>{item.label}</span>
                <span className="text-slate-500">{item.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ))}
    <div className="ml-auto">
      <button
        className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
        onClick={onHome}
        title="Home"
      >
        Home
      </button>
    </div>
  </div>
)
