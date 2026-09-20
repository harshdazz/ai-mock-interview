import { cn } from "@/lib/utils"
import { useAuth } from "@clerk/clerk-react"
import { LogoContainer } from "./logo-container"
import { NavigationRoutes } from "./navigation-routes"
import { NavLink } from "react-router-dom"
import ProfileContainer from "./profile-container"
import ToggleContainer from "../toggle-container"
import Container from "./conatiner"
import { ThemeToggle } from "../theme-toggle"


const Header = () => {
  const {userId} = useAuth()
  return (
    <header className= {cn("w-full border-b duration-150 transition-all ease-in-out")}>
      <Container>
        <div className ="flex items-center gap-4 w-full">
          {/* logo section  */}
          <LogoContainer />

          {/* navigation section */}
           <nav className="hidden md:flex items-center gap-3">
          <NavigationRoutes />
          {userId && (<NavLink  to={"/generate"} className={({isActive}) => cn("text-base text-ink-muted",  isActive && "text-ink font-semibold")}>
    Take an Interview
   </NavLink>)}
          </nav>
          {/* profile section */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <ProfileContainer />
            {/* mobile toggle section */}
            <ToggleContainer />
        </div >
        </div>
      </Container>
    </header>
  )
}

export default Header