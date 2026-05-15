import { Outlet } from 'react-router-dom'
import Nav from './components/layout/Nav.jsx'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Outlet />
      </main>
    </>
  )
}
