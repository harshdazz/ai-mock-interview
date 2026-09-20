import { BrowserRouter as Router , Routes , Route} from 'react-router-dom'

import PublicLayout from '@/layouts/public-layout'
import HomePage from '@/Routes/home'
import AuthenticationLayout from '@/layouts/auth-layout'
import SignUpPage from './Routes/sign-up'
import SignInPage from './Routes/sign-in'
import ProtectRoutes from './layouts/protected-routes'
import MainLayout from './layouts/main-layout'
import { Generate } from './components/generate'
import Dashboard from './Routes/dashboard'
import CreateEditPage from './Routes/create-edit-page'
import MockLoadPage from './Routes/mock-load-page'
import MockInterviewPage from './Routes/mock-interview-page'
import { Feedback } from './Routes/feedback'
const App = () => {
  return (
    <Router>
      <Routes>
        {/* public routes */}
        <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        </Route>

        {/* authentication layout */}
 <Route element={<AuthenticationLayout />}>
        <Route path="/signin/*" element={<SignInPage />} />
        <Route path="/signup/*" element={<SignUpPage />} />
        </Route>

        {/* protected routes */}
        <Route element={<ProtectRoutes><MainLayout /></ProtectRoutes>} >
        {/* add all the protected routes */}
        <Route element={<Generate />} path= "/generate">
        <Route index element={<Dashboard />} />
        <Route path=":interviewId" element= {<CreateEditPage />} />
        <Route path="interview/:interviewId" element={<MockLoadPage />} />
        <Route path="interview/:interviewId/start" element={<MockInterviewPage />} />
         <Route path="feedback/:interviewId" element={<Feedback />} />
        </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
// change 1