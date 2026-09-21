import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/providers/auth-context"
import { Menu } from "lucide-react"
import { NavigationRoutes } from "./ui/navigation-routes"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"



const ToggleContainer = () => {
  const {userId} = useAuth()
  return (
   <Sheet>
  <SheetTrigger className= "block md:hidden">
    <Menu />
    </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle />
     
    </SheetHeader>
   <nav className= "gap-6 flex flex-col items-start">
     <NavigationRoutes  isMobile/>
          {userId && (<NavLink  to={"/generate"} className={({isActive}) => cn("text-base text-ink-muted",  isActive && "text-ink font-semibold")}>
    Take an Interview
   </NavLink>)}
   </nav>
  </SheetContent>
</Sheet>
  )
}

export default ToggleContainer