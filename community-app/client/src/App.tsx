import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "./pages/Home";
import AdminPanel from "./pages/AdminPanel";
import EditPostPage from "./pages/EditPostPage";
import SearchPage from "./pages/SearchPage";
import PostPage from "@/pages/PostPage";
import WritePostPage from "@/pages/WritePostPage";
import BoardPage from "@/pages/BoardPage";
import ChatList from "@/pages/ChatList";
import ChatRoom from "@/pages/ChatRoom";
import LoginPage from "@/pages/LoginPage";
import CompleteSignupPage from "@/pages/CompleteSignupPage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeColorProvider } from "./contexts/ThemeColorContext";
import { MenuProvider } from "./contexts/MenuContext";
import TopLeftMenu from "./components/TopLeftMenu";
import AnimatedBackground from "./components/AnimatedBackground";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/signup/complete"} component={CompleteSignupPage} />
      <Route path={"/board/:slug"} component={BoardPage} />
      <Route path={"/board/:slug/write"} component={WritePostPage} />
      <Route path={"/post/:id"} component={PostPage} />
      <Route path={"/post/:id/edit"} component={EditPostPage} />
      <Route path={"/search"} component={SearchPage} />
      <Route path={"/chat"} component={ChatList} />
      <Route path={"/chat/:id"} component={ChatRoom} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeColorProvider>
        <ThemeProvider defaultTheme="light">
          <MenuProvider>
            <TooltipProvider>
              <AnimatedBackground />
              <Toaster />
              <Router />
              {/* 메뉴 패널은 전역으로 마운트하되, 떠있는 버튼은 끄고 헤더 인라인 버튼(HeaderMenuButton)으로 여다 */}
              <TopLeftMenu showFloatingButton={false} />
            </TooltipProvider>
          </MenuProvider>
        </ThemeProvider>
      </ThemeColorProvider>
    </ErrorBoundary>
  );
}

export default App;
