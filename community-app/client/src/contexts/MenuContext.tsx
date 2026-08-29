import { createContext, useContext, useState, type ReactNode } from "react";

type MenuContextValue = {
  isOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  setOpen: (open: boolean) => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <MenuContext.Provider
      value={{
        isOpen,
        openMenu: () => setOpen(true),
        closeMenu: () => setOpen(false),
        setOpen,
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
    };
  }
  return ctx;
}
