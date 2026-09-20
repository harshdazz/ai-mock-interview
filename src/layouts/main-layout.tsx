import Container from "@/components/ui/conatiner"
import { Footer } from "@/components/ui/footer"
import Header from "@/components/ui/header"
import { Outlet } from "react-router-dom"



const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen">
       
        <Header />

        <Container className="flex-grow">
          <main className="flex-grow">
          <Outlet />
          </main>
        </Container>

        <Footer />
    </div>
  )
}

export default MainLayout