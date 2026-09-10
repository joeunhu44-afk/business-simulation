import { createContext, useContext, useState, type ReactNode } from "react";

/** 슬라이드 메뉴를 열 때 바로 보여줄 화면. 지정하지 않으면 기본 메뉴("root"). */
export type MenuTarget = "root" | "profile" | "chat" | "search" | "settings" | "notifications";

type MenuContextValue = {
  isOpen: boolean;
  /** 상단바 알림 아이콘처럼 특정 화면으로 바로 열어야 할 때 target을 넘긴다. */
  openMenu: (target?: MenuTarget) => void;
  closeMenu: () => void;
  setOpen: (open: boolean) => void;
  /** TopLeftMenu가 열릴 때 어떤 화면을 띄울지 읽어가는 값. */
  pendingTarget: MenuTarget | null;
  clearPendingTarget: () => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<MenuTarget | null>(null);

  return (
    <MenuContext.Provider
      value={{
        isOpen,
        openMenu: (target?: MenuTarget) => {
          setPendingTarget(target ?? null);
          setOpen(true);
        },
        closeMenu: () => setOpen(false),
        setOpen,
        pendingTarget,
        clearPendingTarget: () => setPendingTarget(null),
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) {
    // Provider 밖에서 호출되어도 앱이 깨지지 않도록 no-op 폴백 제공
    return {
      isOpen: false,
      openMenu: () => {},
      closeMenu: () => {},
      setOpen: () => {},
      pendingTarget: null,
      clearPendingTarget: () => {},
    };
  }
  return ctx;
}
